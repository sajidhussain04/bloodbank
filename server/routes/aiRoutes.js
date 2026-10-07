// AI routes backed by Supabase PostgreSQL.
const express = require("express");
const router = express.Router();
const DonorRecommender = require("../ai/donorRecommender");
const BloodBankChatbot = require("../ai/chatbot");
const DemandPredictor = require("../ai/demandPredictor");

const simpleCache = new Map();
const CACHE_TTL = { DONORS: 120000, DEMAND: 300000, STATS: 300000 };
const chatRequests = new Map();

const getCached = (key, ttl) => {
  const item = simpleCache.get(key);
  return item && Date.now() - item.timestamp < ttl ? item.data : null;
};
const setCached = (key, data) => simpleCache.set(key, { data, timestamp: Date.now() });
const validUUID = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
const validateDays = (value) => { const n = Number.parseInt(value, 10); return Number.isInteger(n) && n >= 1 && n <= 365; };

function mapDonor(row) {
  return {
    _id: row.id, id: row.id, name: row.name, age: row.age, bloodGroup: row.blood_group,
    phone: row.phone, email: row.email || "", location: row.location,
    lastDonationDate: row.last_donation_date, isAvailable: row.is_available, createdAt: row.created_at,
  };
}
function mapRequest(row) {
  return {
    _id: row.id, id: row.id, patientName: row.patient_name, bloodGroup: row.blood_group,
    unitsRequired: row.units_required, hospitalName: row.hospital_name, hospitalAddress: row.hospital_address,
    city: row.city, requiredDate: row.required_date, requesterName: row.requester_name,
    requesterPhone: row.requester_phone, requesterEmail: row.requester_email || "", status: row.status,
    priority: row.priority, notes: row.notes || "", createdAt: row.created_at,
  };
}

function initAIRoutes(supabase, verifyAdmin) {
  router.get("/recommend-donors/:requestId", verifyAdmin, async (req, res) => {
    try {
      if (!validUUID(req.params.requestId)) return res.status(400).json({ success: false, message: "Invalid request ID format" });
      const cacheKey = `donors_${req.params.requestId}`;
      const cached = getCached(cacheKey, CACHE_TTL.DONORS);
      if (cached) return res.json({ ...cached, cached: true, timestamp: new Date().toISOString() });

      const { data: requestRow, error: requestError } = await supabase.from("blood_requests").select("*").eq("id", req.params.requestId).maybeSingle();
      if (requestError) throw requestError;
      if (!requestRow) return res.status(404).json({ success: false, message: "Blood request not found" });
      if (["Completed", "Rejected"].includes(requestRow.status)) return res.status(400).json({ success: false, message: "This blood request has already been fulfilled or closed" });

      const request = mapRequest(requestRow);
      const { data: donorRows, error: donorError } = await supabase.from("donors").select("*").eq("blood_group", request.bloodGroup).eq("is_available", true);
      if (donorError) throw donorError;
      const donors = (donorRows || []).map(mapDonor);
      const recommended = DonorRecommender.getTopDonors(request, donors);

      const response = {
        success: true, requestId: request.id,
        requestDetails: { bloodGroup: request.bloodGroup, city: request.city, priority: request.priority, unitsRequired: request.unitsRequired || 1, createdAt: request.createdAt },
        recommendedDonors: recommended.map((donor) => ({
          id: donor.id, name: donor.name, phone: donor.phone, bloodGroup: donor.bloodGroup,
          location: donor.location, lastDonationDate: donor.lastDonationDate, score: donor.score,
          contactPriority: donor.score >= 80 ? "High" : donor.score >= 60 ? "Medium" : "Low",
        })),
        totalEligible: donors.length, topDonorsCount: recommended.length,
        message: recommended.length ? `Found ${recommended.length} highly suitable donors out of ${donors.length} eligible donors` : "No eligible donors found at this time.",
        aiInsights: { recommendedAction: recommended.length ? "Contact top donors immediately via SMS/call" : "Broadcast request to all donors in the area", estimatedResponseTime: recommended.length >= 3 ? "30-60 minutes" : "2-4 hours" },
      };
      setCached(cacheKey, response);
      return res.json(response);
    } catch (error) {
      console.error("Donor recommendation error:", error);
      return res.status(500).json({ success: false, message: "Error fetching donor recommendations" });
    }
  });

  router.post("/chat", async (req, res) => {
    try {
      const question = req.body.message || req.body.question;
      const sessionId = String(req.body.sessionId || req.ip || "default");
      if (!question || typeof question !== "string" || question.trim().length < 3 || question.trim().length > 500) {
        return res.status(400).json({ success: false, message: "Please ask a question", answer: "Please ask something like 'How to donate blood?'" });
      }
      const now = Date.now();
      const validRequests = (chatRequests.get(sessionId) || []).filter((time) => now - time < 15 * 60 * 1000);
      if (validRequests.length >= 50) return res.status(429).json({ success: false, message: "Too many requests, please try again later.", answer: "Please try again in a few minutes." });
      validRequests.push(now); chatRequests.set(sessionId, validRequests);
      const response = await BloodBankChatbot.getResponse(question.trim());
      return res.json({ success: true, message: response.answer, answer: response.answer, intent: response.intent, suggestedQuestions: response.suggestedQuestions || [], timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("Chatbot error:", error);
      return res.status(500).json({ success: false, message: "Unable to process your question.", answer: "I'm having trouble processing your request. Please call our helpline at 9523627889." });
    }
  });

  async function getRequestsForDemand(days) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const previousCutoff = new Date(); previousCutoff.setDate(previousCutoff.getDate() - days * 2);
    const [{ data: current, error: currentError }, { data: previous, error: previousError }] = await Promise.all([
      supabase.from("blood_requests").select("blood_group,units_required,status,priority,created_at").gte("created_at", cutoff.toISOString()),
      supabase.from("blood_requests").select("blood_group,units_required,status,priority,created_at").gte("created_at", previousCutoff.toISOString()).lt("created_at", cutoff.toISOString()),
    ]);
    if (currentError) throw currentError;
    if (previousError) throw previousError;
    return { current: (current || []).map(mapRequest), previous: (previous || []).map(mapRequest) };
  }

  router.get("/demand-prediction", verifyAdmin, async (req, res) => {
    try {
      const days = validateDays(req.query.days) ? Number.parseInt(req.query.days, 10) : 30;
      const cacheKey = `demand_${days}`;
      const cached = getCached(cacheKey, CACHE_TTL.DEMAND);
      if (cached) return res.json({ success: true, prediction: cached, cached: true, generatedAt: new Date().toISOString() });
      const rows = await getRequestsForDemand(days);
      const prediction = await DemandPredictor.analyzeDemand(days, rows.current, rows.previous);
      setCached(cacheKey, prediction);
      return res.json({ success: true, prediction, generatedAt: new Date().toISOString() });
    } catch (error) {
      console.error("Demand prediction error:", error);
      return res.status(500).json({ success: false, message: "Error analyzing demand trends" });
    }
  });

  async function getAIStats() {
    const rows = await getRequestsForDemand(30);
    return DemandPredictor.analyzeDemand(30, rows.current, rows.previous);
  }

  router.get("/ai-stats", verifyAdmin, async (_req, res) => {
    try {
      const cached = getCached("stats", CACHE_TTL.STATS);
      const prediction = cached || await getAIStats();
      if (!cached) setCached("stats", prediction);
      return res.json({ success: true, generatedAt: new Date().toISOString(), aiStats: {
        topDemandingBloodGroup: prediction.topDemand || "O+", totalDemandScore: prediction.totalRequests || 0,
        demandTrend: prediction.trend || "stable", urgentDemandCount: prediction.urgentRequests || 0,
        recommendation: prediction.recommendation || "Monitor demand patterns", insights: prediction.insights || [],
      }});
    } catch (error) {
      console.error("AI stats error:", error);
      return res.status(500).json({ success: false, message: "Error fetching AI insights" });
    }
  });

  router.get("/quick-stats", verifyAdmin, async (_req, res) => {
    try {
      const prediction = await getAIStats();
      return res.json({ success: true, topDemandingBloodGroup: prediction.topDemand, totalDemandScore: prediction.totalRequests, demandTrend: prediction.trend, urgentDemandCount: prediction.urgentRequests, recommendation: prediction.recommendation });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Error fetching AI insights" });
    }
  });

  router.get("/health", (_req, res) => res.json({
    status: "healthy",
    database: "Supabase",
    services: { donorRecommender: true, demandPredictor: true, chatbot: true },
    endpoints: { chat: "POST /api/ai/chat", aiStats: "GET /api/ai/ai-stats", demandPrediction: "GET /api/ai/demand-prediction", recommendDonors: "GET /api/ai/recommend-donors/:requestId", quickStats: "GET /api/ai/quick-stats", health: "GET /api/ai/health" },
    cacheSize: simpleCache.size, timestamp: new Date().toISOString(),
  }));

  router.delete("/cache", verifyAdmin, (_req, res) => { simpleCache.clear(); chatRequests.clear(); res.json({ success: true, message: "AI cache cleared successfully" }); });

  return router;
}

module.exports = { initAIRoutes };

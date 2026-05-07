// AI Routes for Blood Bank System - Simplified Version (No extra dependencies)
const express = require("express");
const router = express.Router();

// Import AI modules
const DonorRecommender = require("../ai/donorRecommender");
const BloodBankChatbot = require("../ai/chatbot");
const DemandPredictor = require("../ai/demandPredictor");

// Models reference
let DonorModel, BloodRequestModel;

// Simple in-memory cache
const simpleCache = new Map();
const CACHE_TTL = {
  DONORS: 120000, // 2 minutes
  DEMAND: 3600000, // 1 hour
  STATS: 300000 // 5 minutes
};

function getCached(key, ttl) {
  const cached = simpleCache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  return null;
}

function setCached(key, data) {
  simpleCache.set(key, { data, timestamp: Date.now() });
}

// Simple validation functions
function isValidMongoId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

function validateQuestion(question) {
  return question && typeof question === 'string' && question.trim().length >= 3 && question.trim().length <= 500;
}

function validateDays(days) {
  const num = parseInt(days);
  return !isNaN(num) && num >= 1 && num <= 365;
}

// Function to initialize routes with models
function initAIRoutes(donorModel, bloodRequestModel) {
  DonorModel = donorModel;
  BloodRequestModel = bloodRequestModel;
  console.log("🤖 AI Routes Initialized with models");
  return router;
}

// Helper to create validation error response
function validationError(res, message) {
  return res.status(400).json({
    success: false,
    message: message
  });
}

// Rate limiting for chat
const chatRequests = new Map();

// 1. Smart Donor Recommendation API
router.get("/recommend-donors/:requestId", async (req, res) => {
  try {
    if (!isValidMongoId(req.params.requestId)) {
      return validationError(res, "Invalid request ID format");
    }

    if (!BloodRequestModel || !DonorModel) {
      return res.status(503).json({
        success: false,
        message: "AI services are currently unavailable"
      });
    }

    const cacheKey = `donors_${req.params.requestId}`;
    const cachedResult = getCached(cacheKey, CACHE_TTL.DONORS);
    
    if (cachedResult) {
      return res.json({
        ...cachedResult,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    const request = await BloodRequestModel.findById(req.params.requestId)
      .lean()
      .select("-__v");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Blood request not found"
      });
    }

    if (request.status === "Fulfilled" || request.status === "Completed") {
      return res.status(400).json({
        success: false,
        message: "This blood request has already been fulfilled"
      });
    }

    const recommendedDonors = await DonorRecommender.getTopDonors(request, DonorModel);
    
    const totalEligible = await DonorModel.countDocuments({
      bloodGroup: request.bloodGroup,
      isAvailable: true
    });

    const response = {
      success: true,
      requestId: request._id,
      requestDetails: {
        bloodGroup: request.bloodGroup,
        city: request.city,
        priority: request.priority,
        unitsRequired: request.unitsRequired || 1,
        createdAt: request.createdAt
      },
      recommendedDonors: recommendedDonors.map(donor => ({
        id: donor._id,
        name: donor.name,
        phone: donor.phone,
        bloodGroup: donor.bloodGroup,
        location: donor.location,
        lastDonationDate: donor.lastDonationDate,
        score: donor.score,
        contactPriority: donor.score >= 80 ? "High" : donor.score >= 60 ? "Medium" : "Low"
      })),
      totalEligible,
      topDonorsCount: recommendedDonors.length,
      message: recommendedDonors.length > 0 
        ? `Found ${recommendedDonors.length} highly suitable donors out of ${totalEligible} eligible donors` 
        : "No eligible donors found at this time. Consider reaching out to other blood groups.",
      aiInsights: {
        recommendedAction: recommendedDonors.length > 0 
          ? "Contact top donors immediately via SMS/call"
          : "Broadcast request to all donors in the area",
        estimatedResponseTime: recommendedDonors.length >= 3 ? "30-60 minutes" : "2-4 hours"
      }
    };

    setCached(cacheKey, response);
    res.json(response);
    
  } catch (error) {
    console.error("Donor recommendation error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching donor recommendations",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// 2. AI Chatbot API - FIXED: This is the main chat endpoint
router.post("/chat", async (req, res) => {
  try {
    console.log("Chat request received:", req.body);
    
    const { message, question } = req.body;
    const userQuestion = message || question;
    const sessionId = req.body.sessionId || "default";
    
    if (!userQuestion || userQuestion.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please ask a question",
        answer: "I couldn't understand your question. Please try asking something like 'How to donate blood?' or 'Am I eligible to donate?'"
      });
    }
    
    // Simple rate limiting
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const maxRequests = 50;
    
    if (!chatRequests.has(sessionId)) {
      chatRequests.set(sessionId, []);
    }
    
    const sessionRequests = chatRequests.get(sessionId);
    const validRequests = sessionRequests.filter(timestamp => now - timestamp < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: "Too many requests, please try again later.",
        answer: "You've reached the rate limit. Please try again in a few minutes."
      });
    }
    
    validRequests.push(now);
    chatRequests.set(sessionId, validRequests);
    
    // Get response from chatbot
    const response = await BloodBankChatbot.getResponse(userQuestion);
    
    res.json({
      success: true,
      message: response.answer,
      answer: response.answer,
      intent: response.intent,
      suggestedQuestions: response.suggestedQuestions || [],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Chatbot error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to process your question. Please try again or call our helpline.",
      answer: "I'm having trouble processing your request. Please call our helpline at 9523627889 for immediate assistance."
    });
  }
});

// 3. Demand Prediction API
router.get("/demand-prediction", async (req, res) => {
  try {
    if (!BloodRequestModel) {
      return res.status(503).json({
        success: false,
        message: "AI services are currently unavailable"
      });
    }

    let days = req.query.days || 30;
    if (!validateDays(days)) {
      days = 30;
    }

    const cacheKey = `demand_${days}`;
    const cachedResult = getCached(cacheKey, CACHE_TTL.DEMAND);
    
    if (cachedResult) {
      return res.json({ ...cachedResult, cached: true });
    }

    const prediction = await DemandPredictor.analyzeDemand(parseInt(days), BloodRequestModel);
    
    setCached(cacheKey, prediction);
    
    res.json({
      success: true,
      prediction: prediction,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Demand prediction error:", error);
    res.status(500).json({
      success: false,
      message: "Error analyzing demand trends"
    });
  }
});

// 4. AI Stats Dashboard - FIXED: This endpoint was missing
router.get("/ai-stats", async (req, res) => {
  try {
    console.log("AI Stats endpoint called");
    
    if (!BloodRequestModel) {
      return res.status(503).json({
        success: false,
        message: "AI services are currently unavailable"
      });
    }

    const cacheKey = `stats`;
    const cachedResult = getCached(cacheKey, CACHE_TTL.STATS);
    
    if (cachedResult) {
      return res.json({ ...cachedResult, cached: true });
    }

    const demandPrediction = await DemandPredictor.analyzeDemand(30, BloodRequestModel);
    
    const response = {
      success: true,
      generatedAt: new Date().toISOString(),
      aiStats: {
        topDemandingBloodGroup: demandPrediction.topDemand || "O+",
        totalDemandScore: demandPrediction.totalRequests || 0,
        demandTrend: demandPrediction.trend || "stable",
        urgentDemandCount: demandPrediction.urgentRequests || 0,
        recommendation: demandPrediction.recommendation || "Monitor demand patterns",
        insights: demandPrediction.insights || []
      }
    };
    
    setCached(cacheKey, response);
    res.json(response);
    
  } catch (error) {
    console.error("AI stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching AI insights",
      aiStats: {
        topDemandingBloodGroup: "O+",
        totalDemandScore: 0,
        demandTrend: "stable",
        urgentDemandCount: 0,
        recommendation: "Data is being collected for AI predictions",
        insights: ["System is collecting data for better predictions"]
      }
    });
  }
});

// 5. Quick Stats endpoint (alias for ai-stats)
router.get("/quick-stats", async (req, res) => {
  try {
    if (!BloodRequestModel) {
      return res.status(503).json({
        success: false,
        message: "AI services are currently unavailable"
      });
    }

    const demandPrediction = await DemandPredictor.analyzeDemand(30, BloodRequestModel);
    
    res.json({
      success: true,
      topDemandingBloodGroup: demandPrediction.topDemand,
      totalDemandScore: demandPrediction.totalRequests,
      demandTrend: demandPrediction.trend,
      urgentDemandCount: demandPrediction.urgentRequests,
      recommendation: demandPrediction.recommendation
    });
    
  } catch (error) {
    console.error("Quick stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching AI insights"
    });
  }
});

// 6. Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    services: {
      donorRecommender: !!DonorModel,
      demandPredictor: !!BloodRequestModel,
      chatbot: true
    },
    endpoints: {
      chat: "POST /api/ai/chat",
      aiStats: "GET /api/ai/ai-stats",
      demandPrediction: "GET /api/ai/demand-prediction",
      recommendDonors: "GET /api/ai/recommend-donors/:requestId",
      quickStats: "GET /api/ai/quick-stats",
      health: "GET /api/ai/health"
    },
    cacheSize: simpleCache.size,
    timestamp: new Date().toISOString()
  });
});

// 7. Clear cache endpoint
router.delete("/cache", async (req, res) => {
  try {
    simpleCache.clear();
    chatRequests.clear();
    res.json({
      success: true,
      message: "AI cache cleared successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error clearing cache"
    });
  }
});

module.exports = { initAIRoutes };
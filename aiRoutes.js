// AI Routes for Blood Bank System
const express = require("express");
const router = express.Router();
const DonorRecommender = require("../ai/donorRecommender");
const BloodBankChatbot = require("../ai/chatbot");
const DemandPredictor = require("../ai/demandPredictor");

// Note: Models will be passed from server.js
let DonorModel, BloodRequestModel;

// Function to initialize routes with models
function initAIRoutes(donorModel, bloodRequestModel) {
  DonorModel = donorModel;
  BloodRequestModel = bloodRequestModel;
  return router;
}

// 1. Smart Donor Recommendation API
router.get("/recommend-donors/:requestId", async (req, res) => {
  try {
    if (!BloodRequestModel || !DonorModel) {
      return res.status(500).json({
        success: false,
        message: "AI models not initialized"
      });
    }

    const request = await BloodRequestModel.findById(req.params.requestId);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Blood request not found"
      });
    }
    
    const recommendedDonors = await DonorRecommender.getTopDonors(request, DonorModel);
    
    res.json({
      success: true,
      requestId: request._id,
      bloodGroup: request.bloodGroup,
      city: request.city,
      recommendedDonors: recommendedDonors,
      totalEligible: recommendedDonors.length,
      message: recommendedDonors.length > 0 ? 
        `Found ${recommendedDonors.length} suitable donors` : 
        "No eligible donors found at this time"
    });
    
  } catch (error) {
    console.error("Donor recommendation error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching donor recommendations"
    });
  }
});

// 2. AI Chatbot API (public - no auth needed for basic queries)
router.post("/chat", async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question || question.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please ask a question"
      });
    }
    
    const response = await BloodBankChatbot.getResponse(question);
    
    res.json({
      success: true,
      question: question,
      answer: response.answer,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Chatbot error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing your question"
    });
  }
});

// 3. Demand Prediction API (for Admin Dashboard)
router.get("/demand-prediction", async (req, res) => {
  try {
    if (!BloodRequestModel) {
      return res.status(500).json({
        success: false,
        message: "AI models not initialized"
      });
    }

    const days = parseInt(req.query.days) || 30;
    const prediction = await DemandPredictor.analyzeDemand(days, BloodRequestModel);
    
    res.json({
      success: true,
      prediction: prediction
    });
    
  } catch (error) {
    console.error("Demand prediction error:", error);
    res.status(500).json({
      success: false,
      message: "Error analyzing demand trends"
    });
  }
});

// 4. Quick Stats for Dashboard
router.get("/ai-stats", async (req, res) => {
  try {
    if (!BloodRequestModel) {
      return res.status(500).json({
        success: false,
        message: "AI models not initialized"
      });
    }

    const demandPrediction = await DemandPredictor.analyzeDemand(30, BloodRequestModel);
    
    res.json({
      success: true,
      aiStats: {
        topDemandingBloodGroup: demandPrediction.topDemand,
        totalDemandScore: demandPrediction.totalRequests,
        demandTrend: demandPrediction.trend,
        urgentDemandCount: demandPrediction.urgentRequests,
        recommendation: demandPrediction.recommendation
      }
    });
    
  } catch (error) {
    console.error("AI stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching AI insights"
    });
  }
});

module.exports = { initAIRoutes };
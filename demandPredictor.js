// AI-Powered Blood Demand Prediction

class DemandPredictor {
  /**
   * Analyze blood demand trends
   * @param {number} days - Number of days to analyze (default 30)
   * @param {Object} BloodRequestModel - Mongoose BloodRequest model
   * @returns {object} Demand analysis results
   */
  static async analyzeDemand(days = 30, BloodRequestModel) {
    try {
      if (!BloodRequestModel) {
        console.error("BloodRequestModel not provided");
        return {
          success: false,
          message: "Model not available",
          topDemand: "O+",
          demandData: this.getEmptyDemandData(),
          totalRequests: 0
        };
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get all requests in last N days
      const requests = await BloodRequestModel.find({
        createdAt: { $gte: startDate }
      });

      if (requests.length === 0) {
        return {
          success: true,
          message: "Not enough data for prediction",
          topDemand: "O+",
          demandData: this.getEmptyDemandData(),
          totalRequests: 0
        };
      }

      // Calculate demand by blood group
      const demandMap = new Map();
      const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
      
      bloodGroups.forEach(bg => {
        demandMap.set(bg, { total: 0, urgent: 0, approved: 0, pending: 0 });
      });

      requests.forEach(request => {
        const bg = request.bloodGroup;
        const stats = demandMap.get(bg);
        
        stats.total += request.unitsRequired || 1;
        
        if (request.priority === "Urgent") {
          stats.urgent += request.unitsRequired || 1;
        }
        
        if (request.status === "Approved") {
          stats.approved += request.unitsRequired || 1;
        }
        
        if (request.status === "Pending") {
          stats.pending += request.unitsRequired || 1;
        }
        
        demandMap.set(bg, stats);
      });

      // Find highest demand blood group
      let topDemand = "O+";
      let maxDemand = 0;
      
      for (const [bg, stats] of demandMap) {
        // Weighted score: total demand + urgent*2
        const weightedScore = stats.total + (stats.urgent * 2);
        if (weightedScore > maxDemand) {
          maxDemand = weightedScore;
          topDemand = bg;
        }
      }

      // Calculate trends (increase/decrease vs previous period)
      const previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - days);
      
      const previousRequests = await BloodRequestModel.find({
        createdAt: { $gte: previousStartDate, $lt: startDate }
      });
      
      const previousTotal = previousRequests.length;
      const currentTotal = requests.length;
      const trend = currentTotal > previousTotal ? "increasing" : 
                    currentTotal < previousTotal ? "decreasing" : "stable";
      const trendPercentage = previousTotal === 0 ? 100 : 
        Math.round(((currentTotal - previousTotal) / previousTotal) * 100);

      // Prepare output
      const demandData = {};
      for (const [bg, stats] of demandMap) {
        demandData[bg] = stats;
      }

      return {
        success: true,
        topDemand: topDemand,
        demandData: demandData,
        totalRequests: requests.length,
        timeFrame: `${days} days`,
        trend: trend,
        trendPercentage: Math.abs(trendPercentage),
        urgentRequests: requests.filter(r => r.priority === "Urgent").length,
        recommendation: this.getRecommendation(topDemand, demandData[topDemand])
      };
      
    } catch (error) {
      console.error("Demand prediction error:", error);
      return {
        success: false,
        message: "Error analyzing demand",
        topDemand: "O+",
        demandData: this.getEmptyDemandData()
      };
    }
  }

  static getEmptyDemandData() {
    const data = {};
    const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    bloodGroups.forEach(bg => {
      data[bg] = { total: 0, urgent: 0, approved: 0, pending: 0 };
    });
    return data;
  }

  static getRecommendation(bloodGroup, stats) {
    if (stats.total > 20) {
      return `⚠️ HIGH DEMAND for ${bloodGroup} blood. Urgently need more donors. Organize a donation camp!`;
    } else if (stats.total > 10) {
      return `📈 ${bloodGroup} blood demand is rising. Consider reaching out to ${bloodGroup} donors.`;
    } else if (stats.urgent > 5) {
      return `🚨 Immediate action needed! Multiple urgent requests for ${bloodGroup}.`;
    } else {
      return `✅ Current demand is manageable. Keep maintaining regular donor outreach for ${bloodGroup}.`;
    }
  }
}

module.exports = DemandPredictor;
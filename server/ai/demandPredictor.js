// AI-Powered Blood Demand Prediction
class DemandPredictor {
  static async analyzeDemand(days = 30, BloodRequestModel) {
    try {
      if (!BloodRequestModel) {
        return {
          success: false,
          message: "Model not available",
          topDemand: "O+",
          demandData: this.getEmptyDemandData(),
          totalRequests: 0,
          trend: "stable",
          urgentRequests: 0,
          recommendation: "Start collecting data to enable predictions"
        };
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const requests = await BloodRequestModel.find({
        createdAt: { $gte: startDate }
      }).lean();

      if (requests.length === 0) {
        return {
          success: true,
          message: "Not enough data for prediction",
          topDemand: "O+",
          demandData: this.getEmptyDemandData(),
          totalRequests: 0,
          trend: "stable",
          urgentRequests: 0,
          recommendation: "Need more request data for accurate predictions"
        };
      }

      const demandMap = this.calculateDemandMap(requests);
      const topDemand = this.findHighestDemand(demandMap);
      const trend = await this.analyzeTrend(days, BloodRequestModel);
      const urgentRequests = requests.filter(r => r.priority === "Urgent").length;

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
        trend: trend.direction,
        trendPercentage: Math.abs(trend.percentage),
        urgentRequests: urgentRequests,
        recommendation: this.getRecommendation(topDemand, demandMap.get(topDemand)),
        insights: this.generateInsights(demandMap, trend)
      };
      
    } catch (error) {
      console.error("Demand prediction error:", error);
      return {
        success: false,
        message: "Error analyzing demand",
        topDemand: "O+",
        demandData: this.getEmptyDemandData(),
        totalRequests: 0,
        trend: "stable",
        urgentRequests: 0
      };
    }
  }

  static calculateDemandMap(requests) {
    const demandMap = new Map();
    const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    
    bloodGroups.forEach(bg => {
      demandMap.set(bg, { total: 0, urgent: 0, approved: 0, pending: 0, requestCount: 0 });
    });

    requests.forEach(request => {
      const bg = request.bloodGroup;
      const stats = demandMap.get(bg);
      const units = request.unitsRequired || 1;
      
      stats.total += units;
      stats.requestCount++;
      if (request.priority === "Urgent") stats.urgent += units;
      if (request.status === "Approved") stats.approved += units;
      if (request.status === "Pending") stats.pending += units;
      
      demandMap.set(bg, stats);
    });
    
    return demandMap;
  }

  static findHighestDemand(demandMap) {
    let topBloodGroup = "O+";
    let maxScore = 0;
    
    for (const [bg, stats] of demandMap) {
      const weightedScore = stats.total + (stats.urgent * 2);
      if (weightedScore > maxScore) {
        maxScore = weightedScore;
        topBloodGroup = bg;
      }
    }
    
    return topBloodGroup;
  }

  static async analyzeTrend(days, BloodRequestModel) {
    try {
      const currentStart = new Date();
      currentStart.setDate(currentStart.getDate() - days);
      
      const previousStart = new Date(currentStart);
      previousStart.setDate(previousStart.getDate() - days);
      
      const [currentCount, previousCount] = await Promise.all([
        BloodRequestModel.countDocuments({ createdAt: { $gte: currentStart } }),
        BloodRequestModel.countDocuments({ 
          createdAt: { $gte: previousStart, $lt: currentStart } 
        })
      ]);
      
      if (previousCount === 0) {
        return { direction: "stable", percentage: 0 };
      }
      
      const percentage = ((currentCount - previousCount) / previousCount) * 100;
      const direction = percentage > 10 ? "increasing" : percentage < -10 ? "decreasing" : "stable";
      
      return { direction, percentage: Math.round(percentage) };
    } catch (error) {
      return { direction: "stable", percentage: 0 };
    }
  }

  static getRecommendation(bloodGroup, stats) {
    if (!stats) return "Monitor demand patterns for better predictions";
    
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

  static generateInsights(demandMap, trend) {
    const insights = [];
    
    const urgentGroups = [];
    for (const [bg, stats] of demandMap) {
      if (stats.urgent > 3) {
        urgentGroups.push(bg);
      }
    }
    
    if (urgentGroups.length > 0) {
      insights.push(`🚨 ${urgentGroups.join(", ")} blood urgently needed`);
    }
    
    if (trend.direction === "increasing" && trend.percentage > 20) {
      insights.push(`📈 Demand increasing ${trend.percentage}% - expand donor outreach`);
    }
    
    return insights;
  }

  static getEmptyDemandData() {
    const data = {};
    const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    bloodGroups.forEach(bg => {
      data[bg] = { total: 0, urgent: 0, approved: 0, pending: 0, requestCount: 0 };
    });
    return data;
  }
}

module.exports = DemandPredictor;
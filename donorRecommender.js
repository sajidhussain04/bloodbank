// AI-Powered Donor Recommendation System
// Note: Donor model is accessed via mongoose model (defined in server.js)

class DonorRecommender {
  /**
   * Find top 5 most suitable donors for a blood request
   * @param {Object} request - Blood request object
   * @param {Object} DonorModel - Mongoose Donor model
   * @returns {Array} Ranked list of donors with scores
   */
  static async getTopDonors(request, DonorModel) {
    try {
      if (!DonorModel) {
        console.error("DonorModel not provided");
        return [];
      }

      // Find all eligible donors (matching blood group + available)
      const eligibleDonors = await DonorModel.find({
        bloodGroup: request.bloodGroup,
        isAvailable: true
      });

      if (eligibleDonors.length === 0) {
        return [];
      }

      // Score each donor
      const scoredDonors = eligibleDonors.map(donor => ({
        ...donor.toObject(),
        score: this.calculateScore(donor, request)
      }));

      // Sort by score (highest first) and take top 5
      const topDonors = scoredDonors
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      return topDonors;
    } catch (error) {
      console.error("Error in donor recommendation:", error);
      return [];
    }
  }

  /**
   * Calculate compatibility score for a donor
   * Weightage:
   * - Blood group match: 50 points (already filtered)
   * - Location match: 30 points
   * - Recent donation: 20 points (recent = higher score)
   */
  static calculateScore(donor, request) {
    let score = 50; // Base score for blood group match

    // Location match (30 points max)
    if (donor.location && request.city) {
      const donorCity = donor.location.toLowerCase();
      const requestCity = request.city.toLowerCase();
      
      if (donorCity.includes(requestCity) || requestCity.includes(donorCity)) {
        score += 30;
      } else if (donorCity.split(',')[0].trim() === requestCity) {
        score += 25;
      } else {
        score += 10; // Partial match
      }
    } else {
      score += 15; // Neutral if no location data
    }

    // Recent donation activity (20 points)
    if (donor.lastDonationDate) {
      const daysSinceLastDonation = Math.floor(
        (Date.now() - new Date(donor.lastDonationDate)) / (1000 * 60 * 60 * 24)
      );
      
      // More recent = higher score (encourages active donors)
      if (daysSinceLastDonation < 30) {
        score += 20; // Very active
      } else if (daysSinceLastDonation < 90) {
        score += 15; // Recently donated
      } else if (daysSinceLastDonation < 180) {
        score += 10; // Somewhat active
      } else {
        score += 5; // Long time ago
      }
    } else {
      score += 10; // New donor, no history
    }

    // Bonus: Donors who haven't donated in 90+ days get slight boost
    if (donor.lastDonationDate) {
      const daysSinceLastDonation = Math.floor(
        (Date.now() - new Date(donor.lastDonationDate)) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastDonation >= 90) {
        score += 5; // Eligible to donate again
      }
    }

    return Math.min(score, 100); // Cap at 100
  }
}

module.exports = DonorRecommender;
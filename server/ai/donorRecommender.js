// AI-Powered Donor Recommendation System
class DonorRecommender {
  static async getTopDonors(request, DonorModel) {
    try {
      if (!DonorModel) {
        console.error("DonorModel not provided");
        return [];
      }

      const eligibleDonors = await DonorModel.find({
        bloodGroup: request.bloodGroup,
        isAvailable: true
      }).lean();

      if (eligibleDonors.length === 0) {
        return [];
      }

      const scoredDonors = eligibleDonors.map(donor => ({
        ...donor,
        score: this.calculateScore(donor, request)
      }));

      const topDonors = scoredDonors
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      return topDonors;
    } catch (error) {
      console.error("Error in donor recommendation:", error);
      return [];
    }
  }

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
        score += 10;
      }
    } else {
      score += 15;
    }

    // Recent donation activity (20 points)
    if (donor.lastDonationDate) {
      const daysSinceLastDonation = Math.floor(
        (Date.now() - new Date(donor.lastDonationDate)) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceLastDonation < 30) {
        score += 20;
      } else if (daysSinceLastDonation < 90) {
        score += 15;
      } else if (daysSinceLastDonation < 180) {
        score += 10;
      } else {
        score += 5;
      }
    } else {
      score += 10;
    }

    // Bonus for eligible donors
    if (donor.lastDonationDate) {
      const daysSinceLastDonation = Math.floor(
        (Date.now() - new Date(donor.lastDonationDate)) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastDonation >= 90) {
        score += 5;
      }
    }

    return Math.min(score, 100);
  }
}

module.exports = DonorRecommender;
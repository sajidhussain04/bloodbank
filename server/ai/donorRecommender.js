// AI-powered donor recommendation. Database access is handled by the Supabase route.
class DonorRecommender {
  static getTopDonors(request, donors) {
    const eligibleDonors = (donors || []).filter(
      (donor) => donor.bloodGroup === request.bloodGroup && donor.isAvailable === true,
    );

    return eligibleDonors
      .map((donor) => ({ ...donor, score: this.calculateScore(donor, request) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  static calculateScore(donor, request) {
    let score = 50;

    if (donor.location && request.city) {
      const donorCity = donor.location.toLowerCase();
      const requestCity = request.city.toLowerCase();
      if (donorCity.includes(requestCity) || requestCity.includes(donorCity)) score += 30;
      else if (donorCity.split(",")[0].trim() === requestCity) score += 25;
      else score += 10;
    } else {
      score += 15;
    }

    if (donor.lastDonationDate) {
      const days = Math.floor((Date.now() - new Date(donor.lastDonationDate).getTime()) / 86400000);
      if (days < 30) score += 20;
      else if (days < 90) score += 15;
      else if (days < 180) score += 10;
      else score += 5;
      if (days >= 90) score += 5;
    } else {
      score += 10;
    }

    return Math.min(score, 100);
  }
}

module.exports = DonorRecommender;

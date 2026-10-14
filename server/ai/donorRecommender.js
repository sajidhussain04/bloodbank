// Preliminary red-cell ABO/Rh compatibility matching.
// Final donor eligibility and compatibility must be confirmed by the blood bank.
class DonorRecommender {
  static compatibility = {
    "O-":  ["O-"],
    "O+":  ["O-", "O+"],
    "A-":  ["O-", "A-"],
    "A+":  ["O-", "O+", "A-", "A+"],
    "B-":  ["O-", "B-"],
    "B+":  ["O-", "O+", "B-", "B+"],
    "AB-": ["O-", "A-", "B-", "AB-"],
    "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"]
  };

  static getTopDonors(request, donors) {
    const requestedGroup = String(request?.bloodGroup || "").trim().toUpperCase();
    const compatibleGroups = this.compatibility[requestedGroup];

    if (!compatibleGroups) return [];

    return (donors || [])
      .filter((donor) =>
        donor &&
        donor.isAvailable === true &&
        compatibleGroups.includes(
          String(donor.bloodGroup || "").trim().toUpperCase()
        )
      )
      .map((donor) => ({
        ...donor,
        score: this.calculateScore(donor, request)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  static calculateScore(donor, request) {
    let score = 50;

    const donorLocation = String(donor.location || "").trim().toLowerCase();
    const requestCity = String(request.city || "").trim().toLowerCase();

    if (donorLocation && requestCity) {
      if (donorLocation === requestCity) {
        score += 40;
      } else if (
        donorLocation.includes(requestCity) ||
        requestCity.includes(donorLocation)
      ) {
        score += 30;
      } else if (
        donorLocation.split(",")[0].trim() === requestCity.split(",")[0].trim()
      ) {
        score += 20;
      }
    } else {
      // Missing location is not evidence of a local match.
      score += 0;
    }

    return Math.max(0, Math.min(score, 90));
  }
}

module.exports = DonorRecommender;

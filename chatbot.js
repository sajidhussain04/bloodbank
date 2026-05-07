// AI Chatbot for Blood Bank FAQs
class BloodBankChatbot {
  /**
   * Get response to user question
   * @param {string} question - User's question
   * @returns {object} Response with answer
   */
  static async getResponse(question) {
    const q = question.toLowerCase().trim();
    
    // Blood Donation Eligibility
    if (this.matchKeywords(q, ['eligible', 'eligibility', 'can i donate', 'who can donate', 'am i eligible', 'criteria'])) {
      return {
        answer: "✅ **Blood Donation Eligibility Criteria:**\n\n• Age: 18-65 years\n• Weight: Minimum 50 kg\n• Hemoglobin: Minimum 12.5 g/dL\n• No major illnesses (HIV, Hepatitis, etc.)\n• Not pregnant or breastfeeding\n• Last donation was at least 90 days ago\n• No tattoos/piercings in last 6 months\n\nVisit our center for a free health checkup!"
      };
    }
    
    // How to donate blood
    if (this.matchKeywords(q, ['how to donate', 'donation process', 'donate blood', 'become donor', 'register donor', 'donor registration'])) {
      return {
        answer: "🩸 **How to Donate Blood:**\n\n1️⃣ Register as a donor on our website (Donate Blood section)\n2️⃣ Visit our blood bank with valid ID proof\n3️⃣ Complete a simple health screening\n4️⃣ Donation takes only 10-15 minutes\n5️⃣ Rest and enjoy refreshments\n6️⃣ You'll receive a donor certificate\n\n📍 Visit: JharJeevan Blood Bank, Giridih\n📞 Call: 9523627889 for appointment"
      };
    }
    
    // How to request blood
    if (this.matchKeywords(q, ['request blood', 'need blood', 'how to request', 'blood request process', 'emergency request', 'urgent blood'])) {
      return {
        answer: "🚨 **Blood Request Process:**\n\n1️⃣ Fill the blood request form on our website\n2️⃣ Provide patient details and blood group\n3️⃣ Our team verifies within 30 minutes\n4️⃣ We match with available donors/inventory\n5️⃣ You receive confirmation with collection details\n\n⚠️ For emergency, call us directly at 9523627889"
      };
    }
    
    // Blood groups
    if (this.matchKeywords(q, ['blood group', 'blood type', 'compatibility', 'matching', 'which blood'])) {
      return {
        answer: "🩸 **Blood Group Compatibility:**\n\n• **O-** : Universal Donor (can donate to all)\n• **AB+** : Universal Recipient (can receive from all)\n• **A+** : Can receive A+, A-, O+, O-\n• **A-** : Can receive A-, O-\n• **B+** : Can receive B+, B-, O+, O-\n• **B-** : Can receive B-, O-\n• **O+** : Can receive O+, O-\n• **AB-** : Can receive AB-, A-, B-, O-\n• **AB+** : Can receive from all blood groups\n\n⚠️ Always check compatibility before transfusion!"
      };
    }
    
    // Center timings
    if (this.matchKeywords(q, ['timing', 'hours', 'open', 'working hours', 'when open', 'location', 'address'])) {
      return {
        answer: "⏰ **JharJeevan Working Hours:**\n\n📅 Monday-Saturday: 8:00 AM - 8:00 PM\n📅 Sunday: 9:00 AM - 3:00 PM\n🚨 Emergency Services: 24x7\n\n📍 Main Center: 123 Health Street, Giridih, Jharkhand - 834001\n📞 Emergency Helpline: 9523627889"
      };
    }
    
    // Contact info
    if (this.matchKeywords(q, ['contact', 'phone', 'email', 'reach', 'call', 'helpline', 'number'])) {
      return {
        answer: "📞 **Contact JharJeevan:**\n\n📍 Address: 123 Health Street, Giridih, Jharkhand - 834001\n📱 Phone: 9523627889\n📧 Email: contact@jharjeevan.org\n🚨 Emergency: 9523627889 (24x7)\n\n💬 Follow us on social media for updates!"
      };
    }
    
    // After donation care
    if (this.matchKeywords(q, ['after donation', 'post donation', 'care after', 'what to do after', 'recovery', 'donation care'])) {
      return {
        answer: "💪 **After Blood Donation Tips:**\n\n✅ Rest for 10-15 minutes\n✅ Drink plenty of fluids (water/juice)\n✅ Eat iron-rich foods (spinach, nuts, red meat)\n✅ Avoid heavy lifting for 24 hours\n✅ No smoking/alcohol for 4 hours\n✅ Remove bandage after 4 hours\n\n📅 You can donate again after 90 days!"
      };
    }
    
    // Benefits of donation
    if (this.matchKeywords(q, ['benefits', 'advantage', 'why donate', 'health benefits', 'save life'])) {
      return {
        answer: "🎁 **Benefits of Blood Donation:**\n\n❤️ Saves up to 3 lives per donation\n🩸 Free health checkup & blood grouping\n💝 Reduces risk of heart disease\n🔄 Stimulates new blood cell production\n🆓 Free refreshments after donation\n📜 Donor certificate & ID card\n⭐ Priority access during emergencies"
      };
    }
    
    // Inventory/stock
    if (this.matchKeywords(q, ['inventory', 'stock', 'available blood', 'blood available', 'shortage'])) {
      return {
        answer: "📊 **Blood Inventory Information:**\n\nOur blood inventory updates in real-time. For current stock levels:\n\n1️⃣ Check the 'Blood Inventory' section on our website\n2️⃣ Call our 24x7 helpline: 9523627889\n3️⃣ Visit our center directly\n\n⚠️ Critical shortages: O- and AB- are often in high demand.\n\nWe recommend calling before visiting for urgent requirements."
      };
    }
    
    // Default response
    return {
      answer: "🤖 **JharJeevan Blood Bank Assistant**\n\nI can help you with:\n• Blood donation eligibility\n• How to donate blood\n• Blood request process\n• Blood group compatibility\n• Center timings & contact\n• Post-donation care\n• Blood inventory status\n\n💬 Ask me anything about blood donation!\n\n📞 For emergencies, call 9523627889 directly."
    };
  }
  
  /**
   * Check if question matches any keywords
   */
  static matchKeywords(question, keywords) {
    return keywords.some(keyword => question.includes(keyword));
  }
}

module.exports = BloodBankChatbot;
// AI Chatbot for Blood Bank FAQs
class BloodBankChatbot {
  static INTENTS = {
    ELIGIBILITY: "eligibility",
    DONATION_PROCESS: "donation_process",
    REQUEST_PROCESS: "request_process",
    BLOOD_GROUPS: "blood_groups",
    CONTACT: "contact",
    AFTER_CARE: "after_care",
    BENEFITS: "benefits",
    INVENTORY: "inventory",
    GREETING: "greeting",
    UNKNOWN: "unknown"
  };

  static async getResponse(question, history = []) {
    try {
      const q = question.toLowerCase().trim();
      console.log("Processing question:", q);
      
      const intent = this.detectIntent(q);
      console.log("Detected intent:", intent);
      
      const response = this.generateResponse(intent);
      response.suggestedQuestions = this.getSuggestedQuestions(intent);
      response.intent = intent;
      
      return response;
    } catch (error) {
      console.error("Chatbot error:", error);
      return {
        answer: "I'm here to help with blood donation! You can ask me about eligibility, how to donate, blood request process, blood groups, or contact information. What would you like to know?",
        intent: "unknown",
        suggestedQuestions: ["How to donate blood?", "Am I eligible to donate?", "Blood request process"]
      };
    }
  }

  static detectIntent(question) {
    const intentMap = [
      { intent: this.INTENTS.ELIGIBILITY, keywords: ['eligible', 'eligibility', 'can i donate', 'who can donate', 'am i eligible', 'criteria', 'qualify', 'requirements'] },
      { intent: this.INTENTS.DONATION_PROCESS, keywords: ['how to donate', 'donation process', 'donate blood', 'become donor', 'register donor', 'donor registration', 'where to donate', 'how can i donate', 'process of donation'] },
      { intent: this.INTENTS.REQUEST_PROCESS, keywords: ['request blood', 'need blood', 'how to request', 'blood request process', 'emergency request', 'urgent blood', 'get blood', 'request for blood'] },
      { intent: this.INTENTS.BLOOD_GROUPS, keywords: ['blood group', 'blood type', 'compatibility', 'matching', 'which blood', 'universal donor', 'universal recipient', 'blood group compatibility'] },
      { intent: this.INTENTS.CONTACT, keywords: ['contact', 'phone', 'email', 'reach', 'call', 'helpline', 'number', 'address', 'location', 'where are you'] },
      { intent: this.INTENTS.AFTER_CARE, keywords: ['after donation', 'post donation', 'care after', 'what to do after', 'recovery', 'donation care', 'side effects', 'after donating'] },
      { intent: this.INTENTS.BENEFITS, keywords: ['benefits', 'advantage', 'why donate', 'health benefits', 'save life', 'rewards', 'why should i donate'] },
      { intent: this.INTENTS.INVENTORY, keywords: ['inventory', 'stock', 'available blood', 'blood available', 'shortage', 'supply', 'blood stock'] },
      { intent: this.INTENTS.GREETING, keywords: ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good evening', 'namaste', 'hola'] }
    ];
    
    for (const { intent, keywords } of intentMap) {
      if (this.matchKeywords(question, keywords)) {
        return intent;
      }
    }
    
    return this.INTENTS.UNKNOWN;
  }

  static generateResponse(intent) {
    const responses = {
      [this.INTENTS.ELIGIBILITY]: {
        answer: "✅ **Blood Donation Eligibility Criteria:**\n\n**Basic Requirements:**\n• Age: 18-65 years\n• Weight: Minimum 50 kg\n• Hemoglobin: Minimum 12.5 g/dL\n\n**Health Conditions:**\n• No major illnesses (HIV, Hepatitis B/C, Tuberculosis)\n• No active infections or fever\n• Not pregnant or breastfeeding (6 months after delivery)\n• No major surgery in last 6 months\n\n**Lifestyle:**\n• No high-risk behaviors\n• No tattoos/piercings in last 6 months\n• No alcohol 24 hours before donation\n\n📍 Visit our center for a free health checkup before your first donation!"
      },
      [this.INTENTS.DONATION_PROCESS]: {
        answer: "🩸 **How to Donate Blood - Simple Process:**\n\n1️⃣ **Register** - Fill online form at jharjeevan.org/donate or visit our center\n2️⃣ **Health Screening** - Quick check of weight, BP, hemoglobin (10 min)\n3️⃣ **Medical History** - Brief discussion with our doctor (5 min)\n4️⃣ **Donation** - Takes only 10-15 minutes, collect 350ml blood\n5️⃣ **Rest & Refresh** - Enjoy free snacks and drinks (15 min)\n6️⃣ **Recovery** - Return to normal activities, stay hydrated\n\n📍 **Visit:** JharJeevan Blood Bank, 123 Health Street, Giridih\n📞 **Appointment:** 9523627889\n\n⏱️ **Total time:** 45-60 minutes"
      },
      [this.INTENTS.REQUEST_PROCESS]: {
        answer: "🚨 **Emergency Blood Request Process:**\n\n**Step 1:** Fill online request form at jharjeevan.org/request or call our helpline\n**Step 2:** Provide patient name, blood group, hospital details\n**Step 3:** Our team verifies the request (15-30 minutes)\n**Step 4:** We match with available donors/inventory\n**Step 5:** You receive confirmation with collection details\n\n**Required Documents:**\n• Doctor's prescription/blood requisition form\n• Patient ID proof (Aadhar, Voter ID, etc.)\n• Hospital admission papers (if any)\n\n⚠️ **Emergency Helpline:** 9523627889 (24x7)\n📧 **Email:** emergency@jharjeevan.org"
      },
      [this.INTENTS.BLOOD_GROUPS]: {
        answer: "🩸 **Blood Group Compatibility:**\n\n• **O-** : Universal Donor (can donate to ALL blood types)\n• **AB+** : Universal Recipient (can receive from ALL blood types)\n• **A+** : Can receive A+, A-, O+, O-\n• **A-** : Can receive A-, O-\n• **B+** : Can receive B+, B-, O+, O-\n• **B-** : Can receive B-, O-\n• **O+** : Can receive O+, O-\n• **AB-** : Can receive AB-, A-, B-, O-\n\n**Quick Facts:**\n• Most common blood group in India: O+ (37%), B+ (31%), A+ (22%)\n• Rarest blood group: AB- (less than 1%)\n• O- is always in high demand for emergencies\n\n⚠️ Always check compatibility before transfusion!"
      },
      [this.INTENTS.CONTACT]: {
        answer: "📞 **JharJeevan Blood Bank Contact Information:**\n\n📍 **Main Center Address:**\n123 Health Street, Near City Hospital\nGiridih, Jharkhand - 834001\n\n📱 **Phone Numbers:**\n• Emergency Helpline: **9523627889** (24x7, Toll-free)\n• Appointment/Registration: 9523627880 (9 AM - 6 PM)\n• Admin Office: 9523627881 (10 AM - 5 PM)\n\n📧 **Email Addresses:**\n• General Inquiries: contact@jharjeevan.org\n• Emergency Requests: emergency@jharjeevan.org\n• Donor Support: donors@jharjeevan.org\n\n⏰ **Working Hours:**\n• Monday-Saturday: 8:00 AM - 8:00 PM\n• Sunday: 9:00 AM - 3:00 PM\n• Emergency Services: 24x7\n\n🌐 **Follow us:**\n• Facebook: @JharJeevanBloodBank\n• Twitter: @JharJeevanBB"
      },
      [this.INTENTS.AFTER_CARE]: {
        answer: "💪 **Post-Donation Care Guide:**\n\n**Immediately After (First Hour):**\n✅ Rest for 15 minutes at our center\n✅ Drink 2-3 glasses of water or juice\n✅ Eat the provided snacks\n✅ Keep bandage on for 4 hours\n✅ Avoid lifting heavy objects with donation arm\n\n**Next 24 Hours:**\n🍎 Eat iron-rich foods: Spinach, dates, nuts, lean meat, beans\n💧 Drink extra fluids (avoid alcohol & caffeine for 4 hours)\n🏋️ Avoid heavy lifting or strenuous exercise\n🚭 No smoking for 4 hours\n❌ No driving for 2 hours if you feel dizzy\n\n**When to Call Doctor:**\n• Dizziness lasting more than 1 hour\n• Bleeding from puncture site\n• Feeling feverish or unwell\n• Severe pain at injection site\n\n📅 **Next Donation:** After 90 days (minimum gap)"
      },
      [this.INTENTS.BENEFITS]: {
        answer: "🎁 **10 Amazing Benefits of Blood Donation:**\n\n1. 💝 **Saves Lives** - One donation can save up to 3 lives\n2. 🩺 **Free Health Checkup** - Includes BP, hemoglobin, disease screening (value ₹1500+)\n3. ❤️ **Heart Health** - Reduces risk of heart attacks by 30%\n4. 🩸 **Iron Balance** - Prevents iron overload disorders\n5. 🔄 **New Blood Cells** - Stimulates production of fresh blood cells\n6. 🎁 **Donor Benefits** - Free ID card, priority during emergencies\n7. 📜 **Certificate** - Receive donor certificate of appreciation\n8. 🍪 **Free Refreshments** - Snacks and drinks at our center\n9. 🌟 **Community Service** - Contribute to society and save lives\n10. 📊 **Track Record** - Maintain lifetime donation history\n\n🎯 **Goal:** One donation = Three lives saved. Be a hero today!"
      },
      [this.INTENTS.INVENTORY]: {
        answer: "📊 **Blood Inventory Information:**\n\nOur blood inventory updates in real-time. For current stock levels:\n\n1️⃣ **Online:** Check 'Blood Inventory' section on our website\n2️⃣ **Phone:** Call our 24x7 helpline: 9523627889\n3️⃣ **Visit:** Come directly to our center\n\n**Typically in High Demand:**\n🩸 O- (Universal Donor) - Often critical shortage\n🩸 O+ (Most common blood type in India)\n🩸 Platelets - Short shelf life (only 5 days)\n\n**Shelf Life by Component:**\n• Whole Blood: 35 days\n• Red Blood Cells: 42 days\n• Platelets: 5 days\n• Plasma: 1 year (frozen)\n\n💡 **Tip:** Schedule elective surgeries early morning when supply is typically better."
      },
      [this.INTENTS.GREETING]: {
        answer: "👋 **Welcome to JharJeevan Blood Bank Assistant!**\n\nI'm here to help you 24x7 with everything about blood donation.\n\n**You can ask me about:**\n• 📋 **Donation eligibility** - \"Am I eligible to donate?\"\n• 🩸 **How to donate blood** - \"How can I donate blood?\"\n• 🚨 **Requesting blood** - \"Need urgent blood for patient\"\n• 📊 **Blood group compatibility** - \"Which blood group is compatible?\"\n• 📍 **Center timings & location** - \"Where is the blood bank?\"\n• 💪 **Post-donation care** - \"What to do after donation?\"\n• 🎁 **Benefits of donating** - \"Why should I donate?\"\n\n💬 **Just type your question below!** For emergencies, call 9523627889."
      },
      [this.INTENTS.UNKNOWN]: {
        answer: "🤖 **I'm your JharJeevan Blood Bank Assistant!**\n\nI can help you with:\n• ✅ Eligibility & criteria to donate blood\n• 🩸 Donation process and how to register\n• 🚨 Blood request process for emergencies\n• 📊 Blood group compatibility guide\n• 📞 Contact information and location\n• 💪 After-donation care tips\n• 🎁 Benefits of blood donation\n\n**Please rephrase your question** or type one of these:\n• \"How to donate blood?\"\n• \"Am I eligible to donate?\"\n• \"Need urgent blood\"\n• \"Blood bank contact number\"\n\n📞 **For immediate help, call:** 9523627889"
      }
    };
    
    return responses[intent] || responses[this.INTENTS.UNKNOWN];
  }

  static getSuggestedQuestions(intent) {
    const suggestions = {
      [this.INTENTS.ELIGIBILITY]: ["What are the age requirements?", "Can diabetics donate blood?", "How often can I donate blood?"],
      [this.INTENTS.DONATION_PROCESS]: ["Where is your center located?", "How long does donation take?", "Do I need an appointment?"],
      [this.INTENTS.REQUEST_PROCESS]: ["How to request emergency blood?", "What documents are needed?", "How long does it take to get blood?"],
      [this.INTENTS.BLOOD_GROUPS]: ["Which blood group is universal donor?", "Can O+ receive any blood?", "What is Rh factor?"],
      [this.INTENTS.CONTACT]: ["What are your working hours?", "Emergency helpline number?", "How to reach by public transport?"],
      [this.INTENTS.AFTER_CARE]: ["What should I eat after donation?", "When can I exercise again?", "How soon can I donate again?"],
      [this.INTENTS.BENEFITS]: ["How many lives can I save?", "What health checkups are free?", "Do donors get priority?"],
      [this.INTENTS.INVENTORY]: ["Which blood group is most needed?", "How to check current stock?", "What is the shelf life of blood?"],
      [this.INTENTS.GREETING]: ["How to donate blood?", "Am I eligible to donate?", "Emergency blood request"],
      [this.INTENTS.UNKNOWN]: ["How to donate blood?", "Blood donation eligibility", "Blood bank contact number"]
    };
    
    return suggestions[intent] || suggestions[this.INTENTS.UNKNOWN];
  }

  static matchKeywords(question, keywords) {
    return keywords.some(keyword => question.includes(keyword));
  }
}

module.exports = BloodBankChatbot;
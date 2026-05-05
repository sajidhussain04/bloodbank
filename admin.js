// Admin Dashboard JavaScript
const API_URL = "https://your-backend-url.onrender.com";

// Make functions globally accessible for inline onclick handlers
window.deleteDonor = deleteDonor;
window.deleteRequest = deleteRequest;
window.approveRequest = approveRequest;
window.showDonorRecommendations = showDonorRecommendations;
window.askChatbot = askChatbot;

// Helper function to get token safely
function getToken() {
  return localStorage.getItem("adminToken");
}

// Verify token with server before loading dashboard
async function verifyAdminToken() {
  const token = getToken();

  if (!token || token === "null" || token === "undefined") {
    redirectToLogin();
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/api/admin/verify`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      localStorage.removeItem("adminToken");
      redirectToLogin();
      return false;
    }

    return true;
  } catch (error) {
    console.error("Token verification failed:", error);
    redirectToLogin();
    return false;
  }
}

function redirectToLogin() {
  if (!window.location.href.includes("admin-login.html")) {
    window.location.href = "admin-login.html";
  }
}

async function fetchData(endpoint, method = "GET", body = null) {
  const token = getToken();

  if (!token || token === "null" || token === "undefined") {
    showToast("Session expired. Please login again.", "error");
    redirectToLogin();
    return null;
  }

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : null,
    });

    let data;
    try {
      data = await res.json();
    } catch (e) {
      console.error("❌ Invalid JSON from server");
      return { success: false, message: "Server error" };
    }

    if (!res.ok) {
      console.error("❌ API Error:", data);
      return data;
    }

    return data;
  } catch (err) {
    console.error("❌ Fetch failed:", err);
    return { success: false, message: "Server connection failed" };
  }
}

// FIXED logout function with session clear and toast notification
function logout() {
  localStorage.removeItem("adminToken");
  sessionStorage.clear();

  showToast("Logged out successfully", "success");

  setTimeout(() => {
    window.location.href = "admin-login.html";
  }, 800);
}

let inventoryChart = null;

async function loadInventory() {
  const data = await fetchData("/api/inventory");
  if (!data) return;

  const ctx = document.getElementById("inventoryChart");
  if (!ctx) return;

  if (inventoryChart) {
    inventoryChart.destroy();
  }

  const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  const units = bloodGroups.map((bg) => data[bg] || 0);

  inventoryChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: bloodGroups,
      datasets: [
        {
          label: "Available Units",
          data: units,
          backgroundColor: "#d32f2f",
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "top",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.raw} units available`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Number of Units",
          },
        },
        x: {
          title: {
            display: true,
            text: "Blood Group",
          },
        },
      },
    },
  });
}

async function loadDonors() {
  const donors = await fetchData("/api/donors");
  const tbody = document.querySelector("#donorTable tbody");
  const donorCount = document.getElementById("donorCount");

  if (!donors || !donors.donors || !donors.donors.length) {
    if (tbody)
      tbody.innerHTML = '<tr><td colspan="5">No donors registered yet</td></tr>';
    if (donorCount) donorCount.textContent = "0";
    return;
  }

  const donorsList = donors.donors;
  if (donorCount) donorCount.textContent = donorsList.length;

  if (tbody) {
    tbody.innerHTML = donorsList
      .map(
        (d) => `
      <tr>
        <td>${escapeHtml(d.name)}</td>
        <td>${d.bloodGroup}</td>
        <td>${d.phone}</td>
        <td>${escapeHtml(d.location)}</td>
        <td>
          <button class="action-btn delete-btn" onclick="window.deleteDonor('${d._id}')">
            <i class="fas fa-trash"></i> Delete
          </button>
         </td>
       </tr>
    `,
      )
      .join("");
  }
}

async function loadRequests() {
  const requests = await fetchData("/api/requests");
  const tbody = document.querySelector("#requestTable tbody");
  const requestCount = document.getElementById("requestCount");

  if (!requests || !requests.requests || !requests.requests.length) {
    if (tbody)
      tbody.innerHTML = '<tr><td colspan="7">No requests yet</td></tr>';
    if (requestCount) requestCount.textContent = "0";
    return;
  }

  const requestsList = requests.requests;
  if (requestCount) requestCount.textContent = requestsList.length;

  if (tbody) {
    tbody.innerHTML = requestsList
      .map(
        (r) => `
      <tr>
        <td>${escapeHtml(r.patientName)}</td>
        <td><strong>${r.bloodGroup}</strong></td>
        <td>${r.unitsRequired}</td>
        <td>${escapeHtml(r.hospitalName)}</td>
        <td>${escapeHtml(r.city)}</td>
        <td>
          <span class="status-badge ${r.status === "Approved" ? "status-approved" : "status-pending"}">
            ${r.status}
          </span>
         </td>
        <td>
          ${
            r.status === "Pending"
              ? `<button class="action-btn approve-btn" onclick="window.approveRequest('${r._id}')">
            <i class="fas fa-check"></i> Approve
          </button>`
              : ""
          }
          <button class="action-btn ai-match-btn" onclick="window.showDonorRecommendations('${r._id}')">
            <i class="fas fa-robot"></i> AI Match
          </button>
          <button class="action-btn delete-btn" onclick="window.deleteRequest('${r._id}')">
            <i class="fas fa-trash"></i> Delete
          </button>
          </td>
        </tr>
    `,
      )
      .join("");
  }
}

async function deleteDonor(id) {
  if (!confirm("Are you sure you want to delete this donor?")) return;

  const res = await fetchData(`/api/donors/${id}`, "DELETE");

  if (res && res.success) {
    loadDonors();
    loadInventory();
    showToast("Donor deleted successfully", "success");
  } else {
    showToast(res?.message || "Failed to delete donor", "error");
  }
}

async function deleteRequest(id) {
  if (!confirm("Are you sure you want to delete this request?")) return;

  const res = await fetchData(`/api/requests/${id}`, "DELETE");

  if (res && res.success) {
    loadRequests();
    showToast("Request deleted successfully", "success");
  } else {
    showToast(res?.message || "Failed to delete request", "error");
  }
}

async function approveRequest(id) {
  console.log("Approve clicked for:", id);

  const res = await fetchData(`/api/requests/${id}/approve`, "PATCH");

  console.log("Response:", res);

  if (res && res.success) {
    loadRequests();
    loadInventory();
    showToast("Request approved successfully", "success");
  } else {
    showToast(res?.message || "Failed to approve request", "error");
  }
}

// ============ AI FEATURES ============

// Fetch AI-powered demand prediction
async function loadAIDemandPrediction() {
  try {
    const response = await fetchData("/api/ai/ai-stats");
    
    if (response && response.success) {
      const stats = response.aiStats;
      const aiPredictionElement = document.getElementById("aiPrediction");
      
      if (aiPredictionElement) {
        aiPredictionElement.innerHTML = `
          <strong>Top Demand: ${stats.topDemandingBloodGroup}</strong><br>
          <small>${stats.recommendation.substring(0, 60)}...</small><br>
          <span style="font-size: 11px;">Trend: ${stats.demandTrend === 'increasing' ? '📈 Rising' : '📉 Stable'}</span>
        `;
      }
    }
  } catch (error) {
    console.error("Failed to load AI prediction:", error);
    const aiPredictionElement = document.getElementById("aiPrediction");
    if (aiPredictionElement) {
      aiPredictionElement.innerHTML = "AI insights ready<br><small>Data loading...</small>";
    }
  }
}

// Function to show donor recommendations for a request
async function showDonorRecommendations(requestId) {
  showToast("🔍 AI is finding suitable donors...", "info");
  
  const response = await fetchData(`/api/ai/recommend-donors/${requestId}`);
  
  if (response && response.success && response.recommendedDonors && response.recommendedDonors.length > 0) {
    let message = `✅ AI Found ${response.recommendedDonors.length} Suitable Donors:\n\n`;
    response.recommendedDonors.forEach((donor, index) => {
      message += `${index + 1}. ${donor.name} (${donor.bloodGroup})\n`;
      message += `   📍 ${donor.location}\n`;
      message += `   📞 ${donor.phone}\n`;
      message += `   🎯 Match Score: ${Math.round(donor.score)}%\n\n`;
    });
    message += `💡 Tip: Contact donors in order of match score for best results.`;
    alert(message);
  } else {
    showToast("No eligible donors found at this time. Try reaching out to nearby blood banks.", "error");
  }
}

// Chatbot function
async function askChatbot(question) {
  try {
    const token = getToken();
    const response = await fetch(`${API_URL}/api/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ question })
    });
    
    const data = await response.json();
    
    if (data.success) {
      return data.answer;
    } else {
      return "Sorry, I couldn't process your question. Please try again.";
    }
  } catch (error) {
    console.error("Chatbot error:", error);
    return "Connection error. Please check your internet connection.";
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showToast(message, type = "info") {
  const toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas ${type === "success" ? "fa-check-circle" : type === "error" ? "fa-exclamation-circle" : "fa-info-circle"}"></i>
    <span>${escapeHtml(message)}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 3000);
}

// scrollToSection function for sidebar navigation
function scrollToSection(sectionId) {
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ behavior: "smooth" });
  }
}

// Initialize chatbot functionality
function initChatbot() {
  const chatbotToggle = document.getElementById("chatbotToggle");
  const chatbotWindow = document.getElementById("chatbotWindow");
  const closeChatbot = document.getElementById("closeChatbot");
  const sendChat = document.getElementById("sendChat");
  const chatInput = document.getElementById("chatInput");
  const chatMessages = document.getElementById("chatMessages");

  if (chatbotToggle) {
    chatbotToggle.addEventListener("click", () => {
      chatbotWindow.style.display = chatbotWindow.style.display === "none" ? "block" : "none";
    });
  }

  if (closeChatbot) {
    closeChatbot.addEventListener("click", () => {
      chatbotWindow.style.display = "none";
    });
  }

  if (sendChat && chatInput) {
    sendChat.addEventListener("click", async () => {
      const question = chatInput.value.trim();
      if (!question) return;

      // Add user message
      chatMessages.innerHTML += `
        <div class="chatbot-message user-message" style="margin-left: auto; text-align: right;">
          <strong>You:</strong> ${escapeHtml(question)}
        </div>
      `;
      chatInput.value = "";
      chatMessages.scrollTop = chatMessages.scrollHeight;

      // Get bot response
      showToast("🤖 Thinking...", "info");
      const answer = await askChatbot(question);
      
      // Add bot message
      chatMessages.innerHTML += `
        <div class="chatbot-message bot-message">
          <strong>🤖 AI:</strong> ${escapeHtml(answer)}
        </div>
      `;
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        sendChat.click();
      }
    });
  }
}

// DOMContentLoaded block
document.addEventListener("DOMContentLoaded", async () => {
  const isValid = await verifyAdminToken();

  if (isValid) {
    loadInventory();
    loadDonors();
    loadRequests();
    loadAIDemandPrediction();

    // Refresh data every 10 seconds
    setInterval(() => {
      loadRequests();
      loadInventory();
      loadAIDemandPrediction();
    }, 10000);
  }

  // Logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  // Sidebar navigation
  document.querySelectorAll("[data-section]").forEach(link => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const section = this.getAttribute("data-section");
      scrollToSection(section);
    });
  });

  // Initialize chatbot
  initChatbot();
});
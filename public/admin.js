// Admin Dashboard JavaScript
const API_URL = (window.JHARJEEVAN_API_BASE || "http://localhost:5000").replace(/\/+$/, "");

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
      console.error("âŒ Invalid JSON from server");
      return { success: false, message: "Server error" };
    }

    if (!res.ok) {
      console.error("âŒ API Error:", data);
      return data;
    }

    return data;
  } catch (err) {
    console.error("âŒ Fetch failed:", err);
    return { success: false, message: "Server connection failed" };
  }
}

// FIXED logout function with session clear and toast notification
function logout() {
  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminEmail");
  sessionStorage.clear();

  window.location.href = "index.html";
}

let inventoryChart = null;

async function loadInventory() {
  const canvas = document.getElementById("inventoryChart");
  if (!canvas) return;

  let status = document.getElementById("inventoryChartStatus");

  if (!status) {
    status = document.createElement("div");
    status.id = "inventoryChartStatus";
    status.setAttribute("role", "status");
    status.style.cssText =
      "padding:12px 16px;margin:12px 0;border-radius:10px;" +
      "font-size:13px;line-height:1.6;display:none;";
    const chartFrame = document.getElementById("inventoryChartWrap") || canvas;
    chartFrame.parentNode.insertBefore(status, chartFrame);
  }

  const showStatus = (message, type) => {
    const styles = {
      info: ["#eff6ff", "#1d4ed8"],
      warning: ["#fff7ed", "#9a3412"],
      error: ["#fef2f2", "#b91c1c"],
      success: ["#f0fdf4", "#166534"]
    };

    const selected = styles[type] || styles.info;
    status.textContent = message;
    status.style.backgroundColor = selected[0];
    status.style.color = selected[1];
    status.style.display = "block";
  };

  try {
    const data = await fetchData("/api/inventory");

    if (!data || data.success === false) {
      if (inventoryChart) {
        inventoryChart.destroy();
        inventoryChart = null;
      }

      canvas.style.display = "none";
      showStatus(
        data?.message || "Inventory could not be loaded. Check the server connection and inventory migration.",
        "error"
      );
      return;
    }

    const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

    const units = bloodGroups.map((group) => {
      const value = Number(data[group] ?? 0);

      if (!Number.isFinite(value) || value < 0) {
        throw new Error("Invalid inventory quantity returned for " + group);
      }

      return value;
    });

    const totalUnits = units.reduce((sum, value) => sum + value, 0);
    const highestUnits = Math.max(...units);
    const chartMaximum = highestUnits > 0
      ? Math.ceil(highestUnits * 1.15)
      : 5;

    canvas.style.display = "block";

    if (inventoryChart) {
      inventoryChart.destroy();
      inventoryChart = null;
    }

    inventoryChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: bloodGroups,
        datasets: [{
          label: "Available Units",
          data: units,
          backgroundColor: units.map((value) =>
            value === 0 ? "#cbd5e1" :
            value <= 5 ? "#f97316" : "#e11d48"
          ),
          borderRadius: 7,
          borderSkipped: false,
          maxBarThickness: 42
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 650,
          easing: "easeOutQuart"
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.raw} units available`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: chartMaximum,
            ticks: {
              precision: 0
            },
            title: {
              display: true,
              text: "Available Units"
            }
          },
          x: {
            title: {
              display: true,
              text: "Blood Group"
            },
            grid: {
              display: false
            }
          }
        }
      }
    });

    if (totalUnits === 0) {
      showStatus(
        "No physical blood stock is currently recorded. Add verified received units to update the inventory.",
        "warning"
      );
    } else {
      showStatus(
        `Live inventory loaded: ${totalUnits} physical units across ${units.filter(value => value > 0).length} blood groups.`,
        "success"
      );
    }
  } catch (error) {
    console.error("Inventory chart error:", error);

    if (inventoryChart) {
      inventoryChart.destroy();
      inventoryChart = null;
    }

    canvas.style.display = "none";
    showStatus(
      "Inventory data could not be displayed. Check the API response and try refreshing.",
      "error"
    );
  }
}
async function addInventoryStock() {
  // INVENTORY SUBMISSION UX V2
  const groupInput = document.getElementById("stockBloodGroup");
  const unitsInput = document.getElementById("stockUnits");
  const noteInput = document.getElementById("stockNote");
  const button = document.querySelector("#inventory .inventory-stock-controls button");

  if (!groupInput || !unitsInput || !button) {
    showToast("Inventory form is unavailable. Refresh the page and try again.", "error");
    return;
  }

  if (button.disabled) return;

  const bloodGroup = groupInput.value;
  const rawUnits = unitsInput.value.trim();
  const units = Number(rawUnits);
  const note = noteInput?.value?.trim() || null;

  if (!["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].includes(bloodGroup)) {
    groupInput.focus();
    showToast("Select a valid blood group.", "error");
    return;
  }

  if (rawUnits === "" || !Number.isSafeInteger(units) || units < 1 || units > 10000) {
    unitsInput.focus();
    showToast("Enter a whole number of units between 1 and 10000.", "error");
    return;
  }

  const originalContent = button.innerHTML;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Adding stock…';

  try {
    const result = await fetchData("/api/inventory/add", "POST", {
      bloodGroup,
      units,
      note
    });

    if (!result || result.success !== true) {
      showToast(result?.message || "Stock could not be saved. Please try again.", "error");
      return;
    }

    if (unitsInput) unitsInput.value = "1";
    if (noteInput) noteInput.value = "";

    showToast(
      result.message || `${units} unit(s) of ${bloodGroup} stock added successfully.`,
      "success"
    );

    try {
      await loadInventory();
    } catch (refreshError) {
      console.error("Stock was saved, but inventory refresh failed:", refreshError);
      showToast("Stock was saved, but the inventory display could not refresh.", "error");
    }
  } catch (error) {
    console.error("Add inventory stock failed:", error);
    showToast("Could not add stock. Check your connection and try again.", "error");
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.innerHTML = originalContent;
  }
}
window.addInventoryStock = addInventoryStock;
async function issueBloodRequest(id) {
  if (!id) return;

  if (!confirm("Confirm that the requested blood units have actually been issued? This will deduct stock and complete the request.")) {
    return;
  }

  try {
    const result = await fetchData(
      `/api/requests/${encodeURIComponent(id)}/issue`,
      "POST"
    );

    if (result?.success) {
      await Promise.all([loadRequests(), loadInventory()]);
      showToast("Blood issuance recorded and request completed", "success");
    } else {
      showToast(result?.message || "Blood issuance failed", "error");
    }
  } catch (error) {
    console.error("Issue blood request failed:", error);
    showToast("Could not record issuance. Please try again.", "error");
  }
}
window.issueBloodRequest = issueBloodRequest;
async function loadDonors() {
  const donors = await fetchData("/api/donors");
  const tbody = document.querySelector("#donorTable tbody");
  const donorCount = document.getElementById("donorCount");

  if (!donors || donors.success === false || !Array.isArray(donors.donors)) {
    console.error("Donor list could not be loaded:", donors?.message || "Invalid API response");
    if (donorCount && donorCount.textContent === "Loading…") {
      donorCount.textContent = "Unavailable";
      donorCount.title = "Could not load donor count. Retry or check the API.";
    }
    if (tbody)
      tbody.innerHTML = '<tr><td colspan="5">Unable to load donors. Please retry.</td></tr>';
    return;
  }

  if (donors.donors.length === 0) {
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
        <td><span class="donor-blood-badge donor-blood-${String(d.bloodGroup || "").replace(/[^A-Za-z0-9]/g, "").toLowerCase()}">${escapeHtml(d.bloodGroup || "—")}</span></td>
        <td>${d.phone}</td>
        <td>${escapeHtml(d.location)}</td>
        <td>
          <button class="action-btn delete-btn" onclick="window.deleteDonor('${d.id}')">
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
  // JHARJEEVAN COUNTER REFRESH FIX V1: preserve last successful data during refresh.
  const requests = await fetchData("/api/requests");
  const tbody = document.querySelector("#requestTable tbody");
  const requestCount = document.getElementById("requestCount");

  if (!requests || requests.success === false || !Array.isArray(requests.requests)) {
    console.error("Request list could not be loaded:", requests?.message || "Invalid API response");
    if (requestCount && requestCount.textContent === "Loading…") {
      requestCount.textContent = "Unavailable";
      requestCount.title = "Could not load request count. Retry or check the API.";
    }
    if (tbody)
      tbody.innerHTML = '<tr><td colspan="8">Unable to load requests. Please retry.</td></tr>';
    return;
  }

  if (requests.requests.length === 0) {
    window.jharjeevanRequestsForAI = [];
    if (tbody)
      tbody.innerHTML = '<tr><td colspan="8">No requests yet</td></tr>';
    if (requestCount) requestCount.textContent = "0";
    return;
  }

  const requestsList = requests.requests;
  window.jharjeevanRequestsForAI = requestsList;
  if (requestCount) requestCount.textContent = requestsList.length;

  if (tbody) {
    tbody.innerHTML = requestsList
      .map(
        (r) => `
      <tr>
        <td>${escapeHtml(r.patientName)}</td>
        <td><span class="request-blood-badge">${escapeHtml(r.bloodGroup || "—")}</span></td>
        <td>${escapeHtml(String(r.unitsRequired ?? ""))}</td>
        <td>
          <span class="request-priority ${(String(r.priority || "Normal").toLowerCase() === "urgent") ? "status-pending" : ""}">
            ${escapeHtml(String(r.priority || "Normal"))}
          </span>
        </td>
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
              ? `<button class="action-btn approve-btn" onclick="window.approveRequest('${r.id}')">
            <i class="fas fa-check"></i> Approve
          </button>`
              : ""
          }
          ${
            r.status === "Approved"
              ? `<button class="action-btn approve-btn" onclick="window.issueBloodRequest('${r.id}')">
                  <i class="fas fa-hand-holding-medical"></i> Issue Blood
                </button>`
              : ""
          }
          ${!["Completed", "Rejected"].includes(String(r.status || "").trim()) ? `<button class="action-btn ai-match-btn" onclick="window.showDonorRecommendations('${r.id}')">
            <i class="fas fa-robot"></i> AI Match
          </button>` : ""}
          <button class="action-btn delete-btn" onclick="window.deleteRequest('${r.id}')">
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
          <span style="font-size: 11px;">Trend: ${stats.demandTrend === 'increasing' ? 'ðŸ“ˆ Rising' : 'ðŸ“‰ Stable'}</span>
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
  const normalizedId = String(requestId || "").trim();

  if (!normalizedId) {
    showToast("Cannot find the blood request ID. Refresh the requests list.", "error");
    return;
  }

  if (showDonorRecommendations.running) {
    showToast("A donor recommendation request is already running.", "info");
    return;
  }

  showDonorRecommendations.running = true;
  const loadingToast = showToast("AI is checking compatible donor records...", "info");

  try {
    const response = await fetchData(
      `/api/ai/recommend-donors/${encodeURIComponent(normalizedId)}`
    );

    if (!response) {
      showToast("No response from the server. Check your admin session and connection.", "error");
      return;
    }

    if (response.success !== true) {
      const errorMessage =
        typeof response.message === "string" && response.message.trim()
          ? response.message.trim()
          : "The recommendation service returned an unknown error.";

      showToast(`AI Match failed: ${errorMessage}`, "error");
      console.error("AI donor recommendation failed:", {
        requestId: normalizedId,
        message: errorMessage
      });
      return;
    }

    const donors = Array.isArray(response.recommendedDonors)
      ? response.recommendedDonors
      : [];

    if (donors.length === 0) {
      showToast(
        response.message || "No preliminarily compatible available donors were found.",
        "info"
      );
      return;
    }

    const lines = [
      `AI found ${donors.length} preliminary donor matches:`,
      "",
      "Important: These are preliminary matches only. The blood bank must verify donor eligibility, blood type, and compatibility before transfusion."
    ];

    donors.forEach((donor, index) => {
      lines.push("");
      lines.push(`${index + 1}. ${donor.name || "Name unavailable"} (${donor.bloodGroup || "Blood group unavailable"})`);
      lines.push(`   Location: ${donor.location || "Not provided"}`);
      lines.push(`   Phone: ${donor.phone || "Not provided"}`);

      if (Number.isFinite(Number(donor.score))) {
        lines.push(`   Location-based ranking score: ${Math.round(Number(donor.score))}%`);
      }
    });

    alert(lines.join("\n"));
  } catch (error) {
    console.error("AI donor recommendation exception:", error);
    showToast("AI Match could not complete the request. Check the browser console.", "error");
  } finally {
    if (loadingToast) loadingToast.remove();
    showDonorRecommendations.running = false;
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

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`The AI server returned an invalid response (${response.status}).`);
    }

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        (response.status === 429
          ? "Too many questions. Please wait a moment and try again."
          : `The AI assistant request failed (${response.status}).`)
      );
    }

    return {
      answer: String(data.answer || data.message || "I couldn't find an answer. Please try asking another way."),
      suggestedQuestions: Array.isArray(data.suggestedQuestions)
        ? data.suggestedQuestions.filter((item) => typeof item === "string" && item.trim()).slice(0, 4)
        : []
    };
  } catch (error) {
    console.error("Chatbot error:", error);

    if (error.name === "TypeError") {
      return { answer: "Unable to connect to the AI assistant. Please check your connection and try again.", suggestedQuestions: [] };
    }

    return { answer: error.message || "Something went wrong. Please try again.", suggestedQuestions: [] };
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
  return toast;
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

  if (!chatbotWindow || !chatMessages || !chatInput || !sendChat) {
    console.warn("AI Assistant could not initialize: required elements are missing.");
    return;
  }

  let isSending = false;

  function scrollChatToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function renderAssistantText(container, message) {
    const lines = String(message ?? "").split(/\r?\n/);

    function appendInline(parent, text) {
      const parts = text.split(/(\*\*[^*]+\*\*)/g);

      parts.forEach((part) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          const strong = document.createElement("strong");
          strong.textContent = part.slice(2, -2);
          parent.appendChild(strong);
        } else if (part) {
          parent.appendChild(document.createTextNode(part));
        }
      });
    }

    lines.forEach((line, index) => {
      if (index > 0) {
        container.appendChild(document.createElement("br"));
      }

      const cleanLine = line.replace(/^\s*[-•]\s+/, "• ");

      if (!cleanLine.trim()) {
        return;
      }

      appendInline(container, cleanLine);
    });
  }

  function renderChatSuggestions(suggestions) {
    if (!Array.isArray(suggestions) || !suggestions.length) return;

    const wrapper = document.createElement("div");
    wrapper.className = "chatbot-suggestions";
    wrapper.setAttribute("aria-label", "Suggested questions");

    suggestions.forEach((question) => {
      if (typeof question !== "string" || !question.trim()) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "chatbot-suggestion";
      button.textContent = question.trim();
      button.addEventListener("click", () => {
        if (isSending) return;
        chatInput.value = question.trim();
        sendQuestion();
      });

      wrapper.appendChild(button);
    });

    if (wrapper.childElementCount) {
      chatMessages.appendChild(wrapper);
      scrollChatToBottom();
    }
  }

  function appendChatMessage(label, message, type) {
    const bubble = document.createElement("div");
    bubble.className = `chatbot-message ${type}-message`;

    const heading = document.createElement("strong");
    heading.textContent = label;

    const body = document.createElement("span");
    if (type === "bot") {
      renderAssistantText(body, message);
    } else {
      body.textContent = message;
    }

    bubble.appendChild(heading);
    bubble.appendChild(document.createTextNode(" "));
    bubble.appendChild(body);
    chatMessages.appendChild(bubble);

    scrollChatToBottom();
    return bubble;
  }

  function setSending(busy) {
    isSending = busy;
    sendChat.disabled = busy;
    chatInput.disabled = busy;
    sendChat.setAttribute("aria-busy", String(busy));
    chatInput.setAttribute("aria-busy", String(busy));

    sendChat.innerHTML = busy
      ? '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>'
      : '<i class="fas fa-paper-plane" aria-hidden="true"></i>';

    sendChat.setAttribute("aria-label", busy ? "Waiting for AI response" : "Send message");
    sendChat.title = busy ? "Waiting for AI response" : "Send message";
  }

  if (chatbotToggle) {
    chatbotToggle.setAttribute("aria-controls", "chatbotWindow");
    chatbotToggle.setAttribute("aria-expanded", "false");

    chatbotToggle.addEventListener("click", () => {
      const isOpen = window.getComputedStyle(chatbotWindow).display !== "none";
      chatbotWindow.style.display = isOpen ? "none" : "flex";
      chatbotToggle.setAttribute("aria-expanded", String(!isOpen));
      chatbotToggle.setAttribute(
        "aria-label",
        isOpen ? "Open AI Assistant" : "Close AI Assistant"
      );

      if (!isOpen) {
        chatInput.focus();
        scrollChatToBottom();
      }
    });
  }

  if (closeChatbot) {
    closeChatbot.setAttribute("aria-label", "Close AI Assistant");

    closeChatbot.addEventListener("click", () => {
      chatbotWindow.style.display = "none";
      if (chatbotToggle) {
        chatbotToggle.setAttribute("aria-expanded", "false");
        chatbotToggle.focus();
      }
    });
  }

  async function sendQuestion() {
    if (isSending) return;

    const question = chatInput.value.trim();
    if (!question) {
      chatInput.focus();
      return;
    }

    if (question.length > 500) {
      appendChatMessage("AI:", "Please keep your question to 500 characters or fewer.", "bot");
      return;
    }

    appendChatMessage("You:", question, "user");
    chatInput.value = "";
    setSending(true);

    const typingBubble = document.createElement("div");
    typingBubble.className = "chatbot-message bot-message chatbot-typing";
    typingBubble.setAttribute("role", "status");
    typingBubble.setAttribute("aria-live", "polite");
    typingBubble.textContent = "AI is thinking…";
    chatMessages.appendChild(typingBubble);
    scrollChatToBottom();

    try {
      const result = await askChatbot(question);
      typingBubble.remove();
      appendChatMessage("AI:", result.answer, "bot");
      renderChatSuggestions(result.suggestedQuestions);
    } catch (error) {
      typingBubble.remove();
      console.error("AI Assistant send error:", error);
      appendChatMessage("AI:", "Something went wrong. Please try again.", "bot");
    } finally {
      setSending(false);
      chatInput.focus();
    }
  }

  sendChat.addEventListener("click", sendQuestion);

  chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendQuestion();
    }
  });
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
      loadDonors();
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

  // JHARJEEVAN SIDEBAR LOGOUT BINDING START
  const sidebarLogout = document.getElementById("sidebarLogout");
  if (sidebarLogout) {
    sidebarLogout.addEventListener("click", function (event) {
      event.preventDefault();
      if (typeof logout === "function") {
        logout();
      } else {
        console.error("Logout function is unavailable.");
      }
    });
  }
  // JHARJEEVAN SIDEBAR LOGOUT BINDING END
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




















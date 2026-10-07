(() => {
    "use strict";

    const API_BASE = window.location.origin;
    const TOKEN_KEY = "jharjeevan_client_token";
    const CLIENT_KEY = "jharjeevan_client";

    const $ = (selector) => document.querySelector(selector);

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function saveSession(token, client) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(CLIENT_KEY, JSON.stringify(client || {}));
    }

    function clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(CLIENT_KEY);
    }

    function getStoredClient() {
        try {
            return JSON.parse(localStorage.getItem(CLIENT_KEY) || "{}");
        } catch {
            return {};
        }
    }

    async function api(path, options = {}) {
        const headers = {
            "Content-Type": "application/json",
            ...(options.headers || {})
        };

        const token = getToken();

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

    /* ========================================================
       GLOBAL API BRIDGE
       Used by dashboard modules defined outside the IIFE.
       ======================================================== */
const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers
        });

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            const error = new Error(
                data.message || `Request failed (${response.status})`
            );

            error.status = response.status;
            error.data = data;
            throw error;
        }

        return data;
    }

    function setMessage(element, message, type = "") {
        if (!element) return;

        element.textContent = message || "";
        element.className = `form-message ${type}`.trim();
    }

    function setLoading(button, loading) {
        if (!button) return;

        button.disabled = loading;
        button.classList.toggle("is-loading", loading);
    }

    function redirectToDashboard() {
        window.location.href = "client.html";
    }

    function redirectToLogin() {
        window.location.href = "client-login.html";
    }

    async function handleLogin() {
        const form = $("#clientLoginForm");
        if (!form) return;

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            const email = $("#email")?.value.trim().toLowerCase();
            const password = $("#password")?.value || "";
            const button = $("#loginButton");
            const message = $("#loginMessage");

            setMessage(message, "");

            if (!email || !password) {
                setMessage(message, "Email and password are required.", "error");
                return;
            }

            setLoading(button, true);

            try {
                const result = await window.jharjeevanApi("/api/client/login", {
                    method: "POST",
                    body: JSON.stringify({
                        email,
                        password
                    })
                });

                if (!result.success || !result.token) {
                    throw new Error(result.message || "Login failed.");
                }

                saveSession(result.token, result.client);

                setMessage(
                    message,
                    "Login successful. Opening your dashboard...",
                    "success"
                );

                setTimeout(redirectToDashboard, 450);
            } catch (error) {
                setMessage(
                    message,
                    error.message || "Unable to sign in. Please try again.",
                    "error"
                );
            } finally {
                setLoading(button, false);
            }
        });
    }

    async function handleRegister() {
        const form = $("#clientRegisterForm");
        if (!form) return;

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            const name = $("#name")?.value.trim();
            const email = $("#email")?.value.trim().toLowerCase();
            const phone = $("#phone")?.value.trim();
            const bloodGroup = $("#bloodGroup")?.value || "";
            const location = $("#location")?.value.trim();
            const password = $("#password")?.value || "";
            const confirmPassword = $("#confirmPassword")?.value || "";

            const button = $("#registerButton");
            const message = $("#registerMessage");

            setMessage(message, "");

            if (!name || !email || !password || !confirmPassword) {
                setMessage(
                    message,
                    "Please complete all required fields.",
                    "error"
                );
                return;
            }

            if (password.length < 8) {
                setMessage(
                    message,
                    "Password must contain at least 8 characters.",
                    "error"
                );
                return;
            }

            if (password !== confirmPassword) {
                setMessage(
                    message,
                    "Passwords do not match.",
                    "error"
                );
                return;
            }

            setLoading(button, true);

            try {
                const result = await window.jharjeevanApi("/api/client/register", {
                    method: "POST",
                    body: JSON.stringify({
                        name,
                        email,
                        password,
                        phone,
                        bloodGroup,
                        location
                    })
                });

                if (!result.success || !result.token) {
                    throw new Error(
                        result.message || "Account creation failed."
                    );
                }

                saveSession(result.token, result.client);

                setMessage(
                    message,
                    "Account created successfully. Opening your dashboard...",
                    "success"
                );

                setTimeout(redirectToDashboard, 550);
            } catch (error) {
                setMessage(
                    message,
                    error.message || "Unable to create your account.",
                    "error"
                );
            } finally {
                setLoading(button, false);
            }
        });
    }

    async function verifySession() {
        const token = getToken();

        if (!token) {
            redirectToLogin();
            return false;
        }

        try {
            const result = await window.jharjeevanApi("/api/client/verify");

            if (!result.success) {
                throw new Error("Session verification failed.");
            }

            if (result.client) {
                localStorage.setItem(
                    CLIENT_KEY,
                    JSON.stringify(result.client)
                );
            }

            return true;
        } catch (error) {
            clearSession();
            redirectToLogin();
            return false;
        }
    }

    async function loadProfile() {
        try {
            const result = await window.jharjeevanApi("/api/client/profile");

            if (!result.success || !result.client) {
                return;
            }

            const client = result.client;

            localStorage.setItem(
                CLIENT_KEY,
                JSON.stringify(client)
            );

            updateProfileUI(client);
        } catch (error) {
            if (error.status === 401) {
                clearSession();
                redirectToLogin();
            }
        }
    }

    function updateProfileUI(client) {
        const name = client.name || "Client";
        const email = client.email || "No email";
        const initial = name.trim().charAt(0).toUpperCase() || "C";

        const welcomeTitle = $("#welcomeTitle");
        const profileInitial = $("#profileInitial");
        const profileName = $("#profileName");
        const profileEmail = $("#profileEmail");

        if (welcomeTitle) {
            welcomeTitle.textContent = `Welcome back, ${name.split(" ")[0]}`;
        }

        if (profileInitial) {
            profileInitial.textContent = initial;
        }

        if (profileName) {
            profileName.textContent = name;
        }

        if (profileEmail) {
            profileEmail.textContent = email;
        }

        const details = {
            "#profileDetailName": name,
            "#profileDetailEmail": email,
            "#profileDetailPhone": client.phone || "Not provided",
            "#profileDetailBlood": client.blood_group || "Not provided",
            "#profileDetailLocation": client.location || "Not provided"
        };

        Object.entries(details).forEach(([selector, value]) => {
            const element = $(selector);
            if (element) element.textContent = value;
        });
    }

    async function loadInventory() {
        try {
            const result = await window.jharjeevanApi("/api/inventory");

            if (!result || typeof result !== "object") {
                return;
            }

            renderInventory(result);
        } catch {
            renderInventoryError();
        }
    }

    let clientBloodInventory = {};

    function renderInventory(inventory) {
        clientBloodInventory = inventory || {};

        renderFindBloodResults();

        const groupFilter = $("#bloodGroupFilter");
        const locationFilter = $("#bloodLocationFilter");
        const searchButton = $("#bloodSearchButton");

        if (searchButton && !searchButton.dataset.bound) {
            searchButton.dataset.bound = "true";

            searchButton.addEventListener("click", renderFindBloodResults);

            if (locationFilter) {
                locationFilter.addEventListener("keydown", (event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        renderFindBloodResults();
                    }
                });
            }

            if (groupFilter) {
                groupFilter.addEventListener("change", renderFindBloodResults);
            }
        }
    }

    function renderFindBloodResults() {
        const results = $("#findBloodResults");
        const count = $("#bloodResultsCount");

        if (!results) return;

        const groupFilter = $("#bloodGroupFilter");
        const locationFilter = $("#bloodLocationFilter");

        const selectedGroup = groupFilter
            ? String(groupFilter.value || "").trim().toUpperCase()
            : "";

        const locationQuery = locationFilter
            ? String(locationFilter.value || "").trim().toLowerCase()
            : "";

        /*
         * The current /api/inventory endpoint provides blood-group
         * quantities only. It does not currently provide location
         * information, so location is handled gracefully instead
         * of pretending that inventory has location data.
         */
        const groups = [
            "A+",
            "A-",
            "B+",
            "B-",
            "AB+",
            "AB-",
            "O+",
            "O-"
        ];

        let availableGroups = groups.map((group) => ({
            group,
            units: Number(clientBloodInventory[group] || 0)
        }));

        if (selectedGroup) {
            availableGroups = availableGroups.filter(
                item => item.group === selectedGroup
            );
        }

        /*
         * Location filtering is intentionally not applied to the
         * inventory response because the current API has no
         * location field.
         */
        if (locationQuery) {
            const title = $("#bloodResultsTitle");

            if (title) {
                title.textContent = `Blood support near "${locationFilter.value.trim()}"`;
            }
        } else {
            const title = $("#bloodResultsTitle");

            if (title) {
                title.textContent = selectedGroup
                    ? `${selectedGroup} blood availability`
                    : "Available blood support";
            }
        }

        const totalAvailable = availableGroups.reduce(
            (sum, item) => sum + item.units,
            0
        );

        const availableTypes = availableGroups.filter(
            item => item.units > 0
        );

        if (count) {
            count.textContent =
                `${availableTypes.length} blood group${availableTypes.length === 1 ? "" : "s"} available • ${totalAvailable} unit${totalAvailable === 1 ? "" : "s"}`;
        }

        if (!availableGroups.length) {
            results.innerHTML = `
                <div class="find-blood-empty">
                    <div>
                        <div class="find-blood-empty-icon">🩸</div>
                        <h3>No matching blood group</h3>
                        <p>
                            Try another blood group or select
                            "All blood groups".
                        </p>
                    </div>
                </div>
            `;
            return;
        }

        results.innerHTML = availableGroups.map(({ group, units }) => {
            const available = units > 0;

            return `
                <article class="find-blood-result">
                    <div class="find-blood-result-top">
                        <span class="find-blood-group">${escapeHtml(group)}</span>

                        <span class="find-blood-availability"
                              style="${available ? "" : "background:#f1f5f9;color:#64748b;"}">
                            ${available ? "Available" : "Currently unavailable"}
                        </span>
                    </div>

                    <h3>${escapeHtml(group)} Blood</h3>

                    <p>
                        ${available
                            ? "Compatible blood stock is currently available."
                            : "No available units are currently recorded."
                        }
                    </p>

                    <div class="find-blood-meta">
                        <div class="find-blood-meta-item">
                            <span>Available</span>
                            <strong>
                                ${units} unit${units === 1 ? "" : "s"}
                            </strong>
                        </div>

                        <div class="find-blood-meta-item">
                            <span>Status</span>
                            <strong>
                                ${available ? "Ready" : "Waitlist"}
                            </strong>
                        </div>
                    </div>
                </article>
            `;
        }).join("");
    }

    let clientRequests = [];

    function getClientProfileData() {
        const cached = getStoredClient();

        return cached && typeof cached === "object"
            ? cached
            : {};
    }

    function bindBloodRequestActions() {
        const button = $("#openBloodRequestButton");

        if (button && !button.dataset.bound) {
            button.dataset.bound = "true";

            button.addEventListener("click", () => {
                const selectedGroup = $("#bloodGroupFilter")?.value || "";
                openBloodRequestModal(selectedGroup);
            });
        }
    }
    function openBloodRequestModal(prefillGroup = "") {
        if ($("#bloodRequestModal")) return;

        const client = getClientProfileData();

        const defaultName =
            client.name ||
            client.full_name ||
            "";

        const defaultEmail =
            client.email ||
            "";

        const defaultPhone =
            client.phone ||
            "";

        const defaultBlood =
            prefillGroup ||
            client.bloodGroup ||
            client.blood_group ||
            "";

        const defaultCity =
            client.location ||
            "";

        const modal = document.createElement("div");

        modal.id = "bloodRequestModal";
        modal.className = "blood-request-modal";

        modal.innerHTML = `
            <div class="blood-request-backdrop" data-close-request></div>

            <div
                class="blood-request-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="bloodRequestTitle"
            >

                <div class="blood-request-header">
                    <div>
                        <span class="panel-label">LIFE-SAVING REQUEST</span>
                        <h2 id="bloodRequestTitle">Create Blood Request</h2>
                        <p>
                            Provide accurate patient and hospital information.
                        </p>
                    </div>

                    <button
                        type="button"
                        class="blood-request-close"
                        data-close-request
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                <form id="bloodRequestForm" class="blood-request-form">

                    <div class="request-form-section">
                        <div class="request-form-section-title">
                            <span>01</span>
                            Patient details
                        </div>

                        <div class="request-form-grid">

                            <label>
                                <span>Patient name *</span>
                                <input
                                    id="requestPatientName"
                                    name="patientName"
                                    type="text"
                                    required
                                    maxlength="100"
                                    placeholder="Enter patient name"
                                >
                            </label>

                            <label>
                                <span>Blood group *</span>
                                <select
                                    id="requestBloodGroup"
                                    name="bloodGroup"
                                    required
                                >
                                    <option value="">Select blood group</option>
                                    <option value="A+">A+</option>
                                    <option value="A-">A-</option>
                                    <option value="B+">B+</option>
                                    <option value="B-">B-</option>
                                    <option value="AB+">AB+</option>
                                    <option value="AB-">AB-</option>
                                    <option value="O+">O+</option>
                                    <option value="O-">O-</option>
                                </select>
                            </label>

                            <label>
                                <span>Units required *</span>
                                <input
                                    name="unitsRequired"
                                    type="number"
                                    min="1"
                                    max="10"
                                    step="1"
                                    value="1"
                                    required
                                >
                            </label>

                            <label>
                                <span>Required by *</span>
                                <input
                                    name="requiredDate"
                                    type="date"
                                    required
                                >
                            </label>

                        </div>
                    </div>

                    <div class="request-form-section">
                        <div class="request-form-section-title">
                            <span>02</span>
                            Hospital details
                        </div>

                        <div class="request-form-grid">

                            <label>
                                <span>Hospital / medical center *</span>
                                <input
                                    name="hospitalName"
                                    type="text"
                                    required
                                    maxlength="150"
                                    placeholder="Hospital name"
                                >
                            </label>

                            <label>
                                <span>City *</span>
                                <input
                                    name="city"
                                    type="text"
                                    required
                                    maxlength="100"
                                    placeholder="City"
                                >
                            </label>

                            <label class="request-form-full">
                                <span>Hospital address *</span>
                                <input
                                    name="hospitalAddress"
                                    type="text"
                                    required
                                    maxlength="250"
                                    placeholder="Full hospital address"
                                >
                            </label>

                        </div>
                    </div>

                    <div class="request-form-section">
                        <div class="request-form-section-title">
                            <span>03</span>
                            Your contact details
                        </div>

                        <div class="request-form-grid">

                            <label>
                                <span>Your name *</span>
                                <input
                                    id="requesterName"
                                    name="requesterName"
                                    type="text"
                                    required
                                    maxlength="100"
                                    placeholder="Your name"
                                >
                            </label>

                            <label>
                                <span>Phone number *</span>
                                <input
                                    id="requesterPhone"
                                    name="requesterPhone"
                                    type="tel"
                                    inputmode="numeric"
                                    pattern="[0-9]{10}"
                                    maxlength="10"
                                    required
                                    placeholder="10-digit mobile number"
                                >
                            </label>

                            <label class="request-form-full">
                                <span>Email address *</span>
                                <input
                                    id="requesterEmail"
                                    name="requesterEmail"
                                    type="email"
                                    required
                                    maxlength="160"
                                    placeholder="you@example.com"
                                >
                            </label>

                        </div>
                    </div>

                    <div
                        id="bloodRequestMessage"
                        class="blood-request-message"
                        role="status"
                        aria-live="polite"
                    ></div>

                    <div class="blood-request-actions">

                        <button
                            type="button"
                            class="secondary-action"
                            data-close-request
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            class="primary-action"
                            id="submitBloodRequestButton"
                        >
                            Submit Blood Request →
                        </button>

                    </div>

                </form>

            </div>
        `;

        document.body.appendChild(modal);

        $("#requestPatientName").value = defaultName;
        $("#requesterName").value = defaultName;
        $("#requesterEmail").value = defaultEmail;
        $("#requesterPhone").value = defaultPhone;
        $("#requestBloodGroup").value = defaultBlood;

        const cityInput = modal.querySelector('[name="city"]');

        if (cityInput) {
            cityInput.value = defaultCity;
        }

        const requiredDate = modal.querySelector('[name="requiredDate"]');

        if (requiredDate) {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, "0");
            const day = String(today.getDate()).padStart(2, "0");

            requiredDate.min = `${year}-${month}-${day}`;
        }

        modal.querySelectorAll("[data-close-request]").forEach((button) => {
            button.addEventListener("click", closeBloodRequestModal);
        });

        const form = $("#bloodRequestForm");

        if (form) {
            form.addEventListener("submit", submitBloodRequest);
        }

        requestAnimationFrame(() => {
            modal.classList.add("is-visible");
        });

        setTimeout(() => {
            $("#requestPatientName")?.focus();
        }, 100);
    }

    function closeBloodRequestModal() {
        const modal = $("#bloodRequestModal");

        if (!modal) return;

        modal.classList.remove("is-visible");

        setTimeout(() => {
            modal.remove();
        }, 220);
    }

    async function submitBloodRequest(event) {
        event.preventDefault();

        const form = event.currentTarget;
        const button = $("#submitBloodRequestButton");
        const message = $("#bloodRequestMessage");

        const formData = new FormData(form);

        const payload = {
            patientName: String(formData.get("patientName") || "").trim(),
            bloodGroup: String(formData.get("bloodGroup") || "").trim(),
            unitsRequired: Number(formData.get("unitsRequired")),
            hospitalName: String(formData.get("hospitalName") || "").trim(),
            hospitalAddress: String(formData.get("hospitalAddress") || "").trim(),
            city: String(formData.get("city") || "").trim(),
            requiredDate: String(formData.get("requiredDate") || "").trim(),
            requesterName: String(formData.get("requesterName") || "").trim(),
            requesterPhone: String(formData.get("requesterPhone") || "").trim(),
            requesterEmail: String(formData.get("requesterEmail") || "").trim()
        };

        if (
            !payload.patientName ||
            !payload.bloodGroup ||
            !payload.unitsRequired ||
            !payload.hospitalName ||
            !payload.hospitalAddress ||
            !payload.city ||
            !payload.requiredDate ||
            !payload.requesterName ||
            !payload.requesterPhone ||
            !payload.requesterEmail
        ) {
            if (message) {
                message.className = "blood-request-message error";
                message.textContent = "Please complete all required fields.";
            }

            return;
        }

        if (!/^\d{10}$/.test(payload.requesterPhone)) {
            if (message) {
                message.className = "blood-request-message error";
                message.textContent =
                    "Please enter a valid 10-digit phone number.";
            }

            return;
        }

        if (payload.unitsRequired < 1 || payload.unitsRequired > 10) {
            if (message) {
                message.className = "blood-request-message error";
                message.textContent =
                    "Units required must be between 1 and 10.";
            }

            return;
        }

        try {
            if (button) {
                button.disabled = true;
                button.textContent = "Submitting…";
            }

            if (message) {
                message.className = "blood-request-message";
                message.textContent = "Submitting your blood request…";
            }

            const result = await window.jharjeevanApi("/api/requests", {
                method: "POST",
                body: payload
            });

            if (!result?.success) {
                throw new Error(
                    result?.message || "Unable to submit blood request."
                );
            }

            if (message) {
                message.className = "blood-request-message success";
                message.textContent =
                    "Blood request submitted successfully.";
            }

            storeClientRequest(result.request);

            setTimeout(() => {
                closeBloodRequestModal();

                const requestsSection = $("#requests");

                if (requestsSection) {
                    document
                        .querySelector('[data-section-target="requests"]')
                        ?.click();
                }
            }, 900);

        } catch (error) {

            if (message) {
                message.className = "blood-request-message error";
                message.textContent =
                    error?.message ||
                    "Something went wrong while submitting the request.";
            }

            if (button) {
                button.disabled = false;
                button.textContent = "Submit Blood Request →";
            }
        }
    }

    async function loadClientRequests() {
        const list = $("#requestsList");

        if (!list) return;

        /*
         * The existing backend currently exposes the general
         * request collection as an admin route. Do not fetch that
         * route from the client because it requires admin access.
         *
         * For now, retain requests submitted during this session
         * locally and render them immediately. The backend response
         * from POST /api/requests is used as the authoritative
         * newly-created request.
         */

        const stored =
            JSON.parse(
                sessionStorage.getItem("clientSubmittedRequests") || "[]"
            );

        clientRequests = Array.isArray(stored)
            ? stored
            : [];

        renderClientRequests();
    }

    function storeClientRequest(request) {
        const existing = Array.isArray(clientRequests)
            ? clientRequests
            : [];

        const updated = [
            request,
            ...existing.filter(
                item => item?.id !== request?.id
            )
        ];

        clientRequests = updated;

        sessionStorage.setItem(
            "clientSubmittedRequests",
            JSON.stringify(updated)
        );

        renderClientRequests();
    }

    function renderClientRequests() {
        const list = $("#requestsList");

        if (!list) return;

        if (!clientRequests.length) {
            list.innerHTML = `
                <div class="request-empty-state">
                    <div class="request-empty-icon">📋</div>
                    <h3>No blood requests yet</h3>
                    <p>
                        When you submit a blood request, its status
                        will appear here.
                    </p>

                    <button
                        type="button"
                        class="primary-action"
                        id="emptyCreateRequestButton"
                    >
                        Create Blood Request →
                    </button>
                </div>
            `;

            $("#emptyCreateRequestButton")?.addEventListener(
                "click",
                () => openBloodRequestModal()
            );

            return;
        }

        list.innerHTML = clientRequests.map((request) => {

            const status =
                String(request?.status || "Pending");

            const priority =
                String(request?.priority || "Normal");

            const statusClass =
                status.toLowerCase().replace(/\s+/g, "-");

            const priorityClass =
                priority.toLowerCase();

            const requestId =
                request?.id
                    ? String(request.id).slice(-8).toUpperCase()
                    : "PENDING";

            const createdAt =
                request?.created_at ||
                request?.createdAt;

            const dateText =
                createdAt
                    ? new Date(createdAt).toLocaleDateString(
                        undefined,
                        {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                        }
                    )
                    : "Just now";

            return `
                <article class="client-request-card">

                    <div class="client-request-card-top">

                        <div class="client-request-identity">

                            <span class="request-blood-badge">
                                ${escapeHtml(request?.blood_group || request?.bloodGroup || "—")}
                            </span>

                            <div>
                                <h3>
                                    ${escapeHtml(
                                        request?.patient_name ||
                                        request?.patientName ||
                                        "Blood Request"
                                    )}
                                </h3>

                                <span>
                                    Request #${escapeHtml(requestId)}
                                </span>
                            </div>

                        </div>

                        <div class="request-status-stack">

                            <span class="request-status status-${escapeHtml(statusClass)}">
                                ${escapeHtml(status)}
                            </span>

                            <span class="request-priority priority-${escapeHtml(priorityClass)}">
                                ${escapeHtml(priority)}
                            </span>

                        </div>

                    </div>

                    <div class="client-request-details">

                        <div>
                            <span>Units</span>
                            <strong>
                                ${escapeHtml(
                                    request?.units_required ??
                                    request?.unitsRequired ??
                                    "—"
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>Hospital</span>
                            <strong>
                                ${escapeHtml(
                                    request?.hospital_name ||
                                    request?.hospitalName ||
                                    "—"
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>City</span>
                            <strong>
                                ${escapeHtml(request?.city || "—")}
                            </strong>
                        </div>

                        <div>
                            <span>Required by</span>
                            <strong>
                                ${escapeHtml(
                                    request?.required_date
                                        ? new Date(
                                            request.required_date
                                        ).toLocaleDateString(
                                            undefined,
                                            {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric"
                                            }
                                        )
                                        : "—"
                                )}
                            </strong>
                        </div>

                    </div>

                    <div class="client-request-footer">
                        <span>Submitted ${escapeHtml(dateText)}</span>
                        <span>
                            ${status === "Approved"
                                ? "Your request has been approved."
                                : status === "Rejected"
                                    ? "Your request was not approved."
                                    : "Your request is being reviewed."
                            }
                        </span>
                    </div>

                </article>
            `;
        }).join("");
    }

    function syncOverviewMiniStats() {
        const pairs = [
            ["overviewPendingMini", "pendingCount"],
            ["overviewApprovedMini", "approvedCount"],
            ["overviewNotificationMini", "notificationCount"]
        ];

        pairs.forEach(([miniId, sourceId]) => {
            const mini = $("#" + miniId);
            const source = $("#" + sourceId);

            if (mini && source) {
                mini.textContent = source.textContent || "0";
            }
        });
    }

    function animateOverviewCounters() {
        const ids = [
            "requestCount",
            "pendingCount",
            "approvedCount",
            "notificationCount"
        ];

        ids.forEach((id, index) => {
            const element = $("#" + id);

            if (!element || element.dataset.counterAnimated === "true") {
                return;
            }

            const target = parseInt(
                String(element.textContent || "0").replace(/[^\d-]/g, ""),
                10
            ) || 0;

            element.dataset.counterAnimated = "true";

            if (target <= 0) {
                element.textContent = "0";
                return;
            }

            const duration = 650;
            const start = performance.now();

            element.textContent = "0";

            function tick(now) {
                const progress = Math.min(
                    (now - start) / duration,
                    1
                );

                const eased =
                    1 - Math.pow(1 - progress, 3);

                element.textContent =
                    String(Math.round(target * eased));

                if (progress < 1) {
                    requestAnimationFrame(tick);
                }
            }

            setTimeout(() => {
                requestAnimationFrame(tick);
            }, index * 90);
        });

        const miniPairs = [
            ["overviewPendingMini", "pendingCount"],
            ["overviewApprovedMini", "approvedCount"],
            ["overviewNotificationMini", "notificationCount"]
        ];

        miniPairs.forEach(([miniId, sourceId]) => {
            const mini = $("#" + miniId);
            const source = $("#" + sourceId);

            if (mini && source) {
                mini.textContent = source.textContent || "0";
            }
        });
    }


    document.querySelectorAll(".nav-item[data-section]").forEach((navButton) => {
        navButton.addEventListener("click", () => {
            if (navButton.dataset.section === "overview") {
                setTimeout(() => {
                    animateOverviewCounters();
                }, 80);
            }
        });
    });

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }
    function renderInventoryError() {
        const section = $("#find-blood");
        if (!section) return;

        const panel = section.querySelector(".panel");

        if (!panel) return;

        const existing = panel.querySelector(".blood-inventory");

        if (existing) {
            existing.remove();
        }
    }
/* ============================================================
       FINAL MOBILE/DESKTOP NAVIGATION CONTROLLER
       ONE SOURCE OF TRUTH
       ============================================================ */

    function setupNavigationController() {

        if (window.__jharjeevanNavigationReady) {
            return;
        }

        window.__jharjeevanNavigationReady = true;

        const activateSection = (sectionId) => {

            if (!sectionId) {
                return;
            }

            const target =
                document.getElementById(sectionId);

            if (!target) {
                console.warn(
                    "Dashboard section not found:",
                    sectionId
                );
                return;
            }

            const sections =
                document.querySelectorAll(
                    ".dashboard-section"
                );

            const navItems =
                document.querySelectorAll(
                    ".nav-item[data-section]"
                );


            /* ---------- SWITCH SECTION ---------- */

            sections.forEach((section) => {

                section.classList.toggle(
                    "active",
                    section.id === sectionId
                );

            });


            /* ---------- SWITCH ACTIVE NAV ---------- */

            navItems.forEach((item) => {

                const active =
                    item.dataset.section === sectionId;

                item.classList.toggle(
                    "active",
                    active
                );

                if (active) {
                    item.setAttribute(
                        "aria-current",
                        "page"
                    );
                } else {
                    item.removeAttribute(
                        "aria-current"
                    );
                }

            });


            /* ---------- CLOSE MOBILE SIDEBAR ---------- */

            document.body.classList.remove(
                "sidebar-open"
            );

            document.body.style.overflow = "";


            /* ---------- SCROLL DASHBOARD TO TOP ---------- */

            const main =
                document.querySelector(
                    ".dashboard-main"
                );

            if (main) {
                main.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

        };


        /*
         * CAPTURE PHASE
         *
         * This runs before the mobile drawer's other
         * click handlers, so no mobile handler can
         * accidentally send every click back to Overview.
         */

        document.addEventListener(
            "click",
            (event) => {

                const navButton =
                    event.target.closest(
                        ".nav-item[data-section]"
                    );

                if (!navButton) {
                    return;
                }

                const sectionId =
                    navButton.dataset.section;

                if (!sectionId) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                activateSection(sectionId);

            },
            true
        );


        /*
         * Dashboard buttons such as:
         * Find Blood →
         * View My Requests
         */

        document.addEventListener(
            "click",
            (event) => {

                const action =
                    event.target.closest(
                        "[data-section-target]"
                    );

                if (!action) {
                    return;
                }

                const sectionId =
                    action.dataset.sectionTarget;

                if (!sectionId) {
                    return;
                }

                event.preventDefault();

                activateSection(sectionId);

            }
        );


        window.activateDashboardSection =
            activateSection;

    }

    function setupLogout() {
        const button = $("#logoutButton");

        if (!button) return;

        button.addEventListener("click", () => {
            clearSession();

            button.classList.add("is-loading");

            setTimeout(() => {
                window.location.href = "client-login.html";
            }, 250);
        });
    }

    function setupAuthPageGuard() {
        const page = window.location.pathname.toLowerCase();

        const isLoginPage = page.endsWith("client-login.html");
        const isRegisterPage = page.endsWith("client-register.html");

        if (!isLoginPage && !isRegisterPage) {
            return;
        }

        if (getToken()) {
            window.location.href = "client.html";
        }
    }

    async function initDashboard() {
        const dashboard = document.querySelector(".dashboard-shell");

        if (!dashboard) return;

        const valid = await verifySession();

        if (!valid) return;

        setupNavigationController();
        setupLogout();

        const storedClient = getStoredClient();

        if (storedClient && storedClient.name) {
            updateProfileUI(storedClient);
        }

        await Promise.all([
            loadProfile(),
            loadInventory(),
            loadClientNotifications()
        ]);
    }

    function addPageEffects() {
        document.querySelectorAll(".panel, .stat-card").forEach((element, index) => {
            element.style.setProperty(
                "--animation-delay",
                `${Math.min(index * 60, 360)}ms`
            );
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                document.body.classList.remove("sidebar-open");
            }
        });
    }

    async function init() {
        setupAuthPageGuard();

        await handleLogin();
        await handleRegister();
        await initDashboard();

        addPageEffects();
    }

    document.addEventListener("DOMContentLoaded", init);
})();

/* ============================================================
   PREMIUM AUTH UI ENHANCEMENTS
   ============================================================ */

function setupPasswordToggles() {
    document
        .querySelectorAll("[data-password-toggle]")
        .forEach((button) => {

            button.addEventListener("click", () => {

                const selector =
                    button.getAttribute("data-password-toggle");

                const input =
                    document.querySelector(selector);

                if (!input) return;

                const icon =
                    button.querySelector("i");

                const visible =
                    input.type === "text";

                input.type =
                    visible ? "password" : "text";

                button.setAttribute(
                    "aria-label",
                    visible
                        ? "Show password"
                        : "Hide password"
                );

                if (icon) {
                    icon.className =
                        visible
                            ? "fas fa-eye"
                            : "fas fa-eye-slash";
                }
            });
        });
}

function setupPasswordStrength() {

    const input =
        document.querySelector("#password");

    const wrapper =
        document.querySelector("#passwordStrength");

    const fill =
        document.querySelector("#strengthFill");

    const text =
        document.querySelector("#strengthText");

    if (!input || !wrapper || !fill || !text) {
        return;
    }

    input.addEventListener("input", () => {

        const password = input.value;

        if (!password) {
            wrapper.classList.remove("visible");
            fill.style.width = "0%";
            return;
        }

        wrapper.classList.add("visible");

        let score = 0;

        if (password.length >= 8) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        const levels = [
            {
                width: "20%",
                text: "Very weak"
            },
            {
                width: "40%",
                text: "Weak"
            },
            {
                width: "60%",
                text: "Fair"
            },
            {
                width: "80%",
                text: "Strong"
            },
            {
                width: "100%",
                text: "Very strong"
            }
        ];

        const level =
            levels[Math.max(0, score - 1)];

        fill.style.width =
            level.width;

        text.textContent =
            level.text;
    });
}

function setupAuthMicroInteractions() {

    document
        .querySelectorAll("input, select")
        .forEach((field) => {

            field.addEventListener("blur", () => {

                if (
                    field.required &&
                    !field.value.trim()
                ) {
                    field.setAttribute(
                        "aria-invalid",
                        "true"
                    );
                } else {
                    field.removeAttribute(
                        "aria-invalid"
                    );
                }
            });

            field.addEventListener("input", () => {
                field.removeAttribute(
                    "aria-invalid"
                );
            });
        });
}

/* ============================================================
   START PREMIUM AUTH UI
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupPasswordToggles();

        setupPasswordStrength();

        setupAuthMicroInteractions();

    }
);


/* ============================================================
   FINAL CLIENT AUTH VALIDATION
   ============================================================ */

function setupFinalRegistrationUX() {

    const form = document.querySelector("#clientRegisterForm");

    if (!form) return;

    const password =
        document.querySelector("#password");

    const confirmPassword =
        document.querySelector("#confirmPassword");

    const terms =
        document.querySelector("#terms");

    const strength =
        document.querySelector("#passwordStrength");

    const fill =
        document.querySelector("#strengthFill");

    const strengthText =
        document.querySelector("#strengthText");

    const rules = {
        length:
            document.querySelector('[data-rule="length"]'),

        upper:
            document.querySelector('[data-rule="upper"]'),

        number:
            document.querySelector('[data-rule="number"]'),

        special:
            document.querySelector('[data-rule="special"]')
    };

    function updatePassword() {

        if (!password) return;

        const value = password.value;

        if (strength) {
            strength.classList.toggle(
                "visible",
                value.length > 0
            );
        }

        const checks = {
            length: value.length >= 8,
            upper: /[A-Z]/.test(value),
            number: /[0-9]/.test(value),
            special: /[^A-Za-z0-9]/.test(value)
        };

        Object.entries(checks).forEach(
            ([key, valid]) => {

                rules[key]?.classList.toggle(
                    "valid",
                    valid
                );
            }
        );

        const score =
            Object.values(checks)
                .filter(Boolean)
                .length;

        const levels = [
            ["20%", "#d9304f", "Very weak"],
            ["40%", "#e67e22", "Weak"],
            ["65%", "#d9a400", "Fair"],
            ["82%", "#2d9d68", "Strong"],
            ["100%", "#159669", "Very strong"]
        ];

        if (score > 0 && fill && strengthText) {

            const level =
                levels[score - 1];

            fill.style.width =
                level[0];

            fill.style.background =
                level[1];

            strengthText.textContent =
                level[2];
        }
    }

    function validateEmail(value) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(value);
    }

    function validatePhone(value) {

        const digits =
            value.replace(/\D/g, "");

        return digits.length >= 10;
    }

    password?.addEventListener(
        "input",
        updatePassword
    );

    confirmPassword?.addEventListener(
        "input",
        () => {

            if (
                confirmPassword.value &&
                password.value ===
                confirmPassword.value
            ) {
                confirmPassword.setCustomValidity("");
            } else {
                confirmPassword.setCustomValidity(
                    "Passwords do not match"
                );
            }
        }
    );

    form.addEventListener(
        "submit",
        (event) => {

            const email =
                document.querySelector("#email")?.value
                    .trim();

            const phone =
                document.querySelector("#phone")?.value
                    .trim();

            if (!validateEmail(email || "")) {

                event.preventDefault();

                document
                    .querySelector("#registerMessage")
                    ?.classList.add("error");

                return;
            }

            if (
                phone &&
                !validatePhone(phone)
            ) {

                event.preventDefault();

                alert(
                    "Please enter a valid phone number."
                );

                return;
            }

            if (
                terms &&
                !terms.checked
            ) {

                event.preventDefault();

                const message =
                    document.querySelector(
                        "#registerMessage"
                    );

                setMessage(
                    message,
                    "Please confirm the consent checkbox before creating your account.",
                    "error"
                );

                terms.focus();

                return;
            }
        }
    );

    updatePassword();
}

document.addEventListener(
    "DOMContentLoaded",
    setupFinalRegistrationUX
);


/* ============================================================
   LIVE CLIENT NOTIFICATIONS
   ============================================================ */

async function loadClientNotifications() {

    const section =
        document.querySelector("#notifications");

    if (!section) return;

    try {

        const result =
            await window.jharjeevanApi(
                "/api/client/notifications"
            );

        if (!result.success) {
            throw new Error(
                "Unable to load notifications."
            );
        }

        renderClientNotifications(
            result.notifications || []
        );

    } catch (error) {

        console.error(
            "Notification loading failed:",
            error
        );
    }
}

function renderClientNotifications(
    notifications
) {

    const section =
        document.querySelector(
            "#notifications"
        );

    if (!section) return;

    const panel =
        section.querySelector(".panel");

    if (!panel) return;

    let container =
        panel.querySelector(
            ".live-client-notifications"
        );

    if (!container) {

        container =
            document.createElement("div");

        container.className =
            "live-client-notifications";

        panel.appendChild(container);
    }

    if (!notifications.length) {

        container.innerHTML = `
            <div class="notification-empty">
                <div>ðŸ””</div>
                <strong>No notifications yet</strong>
                <p>
                    Important account and blood-support
                    updates will appear here.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML = `

        <div class="notification-toolbar">

            <div>
                <strong>
                    Recent notifications
                </strong>

                <small>
                    ${notifications.length}
                    notification${notifications.length === 1 ? "" : "s"}
                </small>
            </div>

            <button
                type="button"
                id="markAllNotificationsRead"
            >
                Mark all as read
            </button>

        </div>

        <div class="notification-list">

            ${notifications.map(notification => `

                <article
                    class="
                        client-notification
                        ${notification.is_read ? "" : "unread"}
                    "
                    data-notification-id="${notification.id}"
                >

                    <div class="notification-icon">
                        ${getNotificationIcon(notification.type)}
                    </div>

                    <div class="notification-content">

                        <strong>
                            ${escapeNotificationText(
                                notification.title
                            )}
                        </strong>

                        <p>
                            ${escapeNotificationText(
                                notification.message
                            )}
                        </p>

                        <time>
                            ${formatNotificationTime(
                                notification.created_at
                            )}
                        </time>

                    </div>

                    ${
                        notification.is_read
                            ? ""
                            : `
                                <button
                                    class="notification-read"
                                    type="button"
                                    data-read-id="${notification.id}"
                                    aria-label="Mark notification as read"
                                >
                                    âœ“
                                </button>
                            `
                    }

                </article>

            `).join("")}

        </div>
    `;

    container
        .querySelectorAll(
            "[data-read-id]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    try {

                        await window.jharjeevanApi(
                            `/api/client/notifications/${button.dataset.readId}/read`,
                            {
                                method: "PATCH"
                            }
                        );

                        await loadClientNotifications();

                    } catch (error) {

                        console.error(
                            "Unable to mark notification read:",
                            error
                        );
                    }
                }
            );
        });

    const markAll =
        container.querySelector(
            "#markAllNotificationsRead"
        );

    markAll?.addEventListener(
        "click",
        async () => {

            await window.jharjeevanApi(
                "/api/client/notifications/read-all",
                {
                    method: "PATCH"
                }
            );

            await loadClientNotifications();
        }
    );
}

function getNotificationIcon(type) {

    if (
        type === "account_created"
    ) {
        return "â¤ï¸";
    }

    if (
        type?.includes("blood")
    ) {
        return "ðŸ©¸";
    }

    if (
        type?.includes("request")
    ) {
        return "ðŸ“‹";
    }

    if (
        type?.includes("approved")
    ) {
        return "âœ“";
    }

    if (
        type?.includes("rejected")
    ) {
        return "!";
    }

    return "ðŸ””";
}

function formatNotificationTime(
    timestamp
) {

    if (!timestamp) return "";

    const date =
        new Date(timestamp);

    if (
        Number.isNaN(date.getTime())
    ) {
        return "";
    }

    const seconds =
        Math.floor(
            (Date.now() - date.getTime()) /
            1000
        );

    if (seconds < 60) {
        return "Just now";
    }

    const minutes =
        Math.floor(seconds / 60);

    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    const hours =
        Math.floor(minutes / 60);

    if (hours < 24) {
        return `${hours}h ago`;
    }

    const days =
        Math.floor(hours / 24);

    if (days < 7) {
        return `${days}d ago`;
    }

    return date.toLocaleDateString();
}

function escapeNotificationText(
    value
) {

    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* ============================================================
   LOAD NOTIFICATIONS WITH DASHBOARD
   ============================================================ */

const originalInitDashboard =
    window.__jharjeevanInitDashboard;

/* ============================================================
   MOBILE SIDEBAR DRAWER
   ============================================================ */

(function setupMobileSidebar() {
    function initMobileSidebar() {

        const sidebar = document.querySelector(".client-sidebar");
        const header = document.querySelector(".dashboard-header");

        if (!sidebar || !header) return;

        if (document.querySelector("#mobileMenuButton")) return;

        /* ---------- MENU BUTTON ---------- */

        const menuButton = document.createElement("button");

        menuButton.id = "mobileMenuButton";
        menuButton.type = "button";
        menuButton.className = "mobile-menu-button";
        menuButton.setAttribute("aria-label", "Open navigation menu");
        menuButton.setAttribute("aria-expanded", "false");

        menuButton.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;


        /* Put hamburger before the header content */
        header.insertBefore(menuButton, header.firstChild);


        /* ---------- OVERLAY ---------- */

        const overlay = document.createElement("button");

        overlay.id = "mobileSidebarOverlay";
        overlay.type = "button";
        overlay.className = "mobile-sidebar-overlay";
        overlay.setAttribute("aria-label", "Close navigation menu");


        document.body.appendChild(overlay);


        /* ---------- OPEN ---------- */

        function openSidebar() {

            document.body.classList.add("sidebar-open");

            menuButton.setAttribute(
                "aria-expanded",
                "true"
            );

            menuButton.setAttribute(
                "aria-label",
                "Close navigation menu"
            );

            document.body.style.overflow = "hidden";
        }


        /* ---------- CLOSE ---------- */

        function closeSidebar() {

            document.body.classList.remove("sidebar-open");

            menuButton.setAttribute(
                "aria-expanded",
                "false"
            );

            menuButton.setAttribute(
                "aria-label",
                "Open navigation menu"
            );

            document.body.style.overflow = "";
        }


        /* ---------- TOGGLE ---------- */

        menuButton.addEventListener("click", () => {

            if (
                document.body.classList.contains(
                    "sidebar-open"
                )
            ) {
                closeSidebar();
            } else {
                openSidebar();
            }

        });


        /* ---------- OVERLAY ---------- */

        overlay.addEventListener(
            "click",
            closeSidebar
        );


        /* ---------- LOGOUT ---------- */

        const logoutButton =
            sidebar.querySelector("#logoutButton");

        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                closeSidebar
            );

        }


        /* ---------- ESCAPE ---------- */

        document.addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key === "Escape" &&
                    document.body.classList.contains(
                        "sidebar-open"
                    )
                ) {
                    closeSidebar();
                }

            }
        );


        /* ---------- RESIZE ---------- */

        window.addEventListener(
            "resize",
            () => {

                if (
                    window.innerWidth > 760
                ) {
                    closeSidebar();
                }

            }
        );

    }


    if (
        document.readyState === "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initMobileSidebar
        );
    } else {
        initMobileSidebar();
    }

    })();

/* ============================================================
   GLOBAL CLIENT API BRIDGE
   Used by dashboard modules outside the main IIFE.
   ============================================================ */

window.jharjeevanApi = async function (path, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    const token = localStorage.getItem("jharjeevan_client_token");

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
        `${window.location.origin}${path}`,
        {
            ...options,
            headers
        }
    );

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        const error = new Error(
            data.message || `Request failed (${response.status})`
        );

        error.status = response.status;
        error.data = data;

        throw error;
    }

    return data;
};



/* JHARJEEVAN FINAL REQUEST DISPLAY ENCODING */

(function () {

    function jjDecodeMojibake(value) {

        if (!value) {
            return value;
        }

        if (
            !value.includes("Ã") &&
            !value.includes("Â") &&
            !value.includes("â") &&
            !value.includes("ð") &&
            !value.includes("ƒ")
        ) {
            return value;
        }

        try {

            const bytes = [];

            for (let i = 0; i < value.length; i++) {

                const code = value.charCodeAt(i);

                if (code <= 255) {
                    bytes.push(code);
                }
                else {
                    return value;
                }
            }

            const decoded =
                new TextDecoder("utf-8", {
                    fatal: false
                }).decode(
                    new Uint8Array(bytes)
                );

            if (
                decoded &&
                decoded !== value &&
                !decoded.includes("\ufffd")
            ) {
                return decoded;
            }

        }
        catch (error) {
            return value;
        }

        return value;
    }


    function jjCleanRequestText() {

        const root = document.querySelector("#requests");

        if (!root) {
            return;
        }

        const walker =
            document.createTreeWalker(
                root,
                NodeFilter.SHOW_TEXT
            );

        const nodes = [];

        while (walker.nextNode()) {
            nodes.push(walker.currentNode);
        }

        for (const node of nodes) {

            const original = node.nodeValue;
            const cleaned = jjDecodeMojibake(original);

            if (cleaned !== original) {
                node.nodeValue = cleaned;
            }
        }
    }


    window.jjCleanRequestText =
        jjCleanRequestText;


    function jjStartRequestCleaner() {

        jjCleanRequestText();

        const root =
            document.querySelector("#requests");

        if (!root) {
            return;
        }

        if (root.dataset.jjEncodingObserver === "1") {
            return;
        }

        root.dataset.jjEncodingObserver = "1";

        const observer =
            new MutationObserver(function () {

                window.requestAnimationFrame(
                    jjCleanRequestText
                );

            });

        observer.observe(
            root,
            {
                childList: true,
                subtree: true,
                characterData: true
            }
        );
    }


    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            jjStartRequestCleaner,
            {
                once: true
            }
        );

    }
    else {

        jjStartRequestCleaner();

    }


    window.addEventListener(
        "load",
        jjStartRequestCleaner
    );

})();


/* JHARJEEVAN CANONICAL API BRIDGE BEGIN */
(() => {

    "use strict";

    /*
     * One API implementation for the entire client dashboard.
     *
     * IMPORTANT:
     * The browser dashboard may be served from Live Server,
     * localhost:5500, etc. The API itself always lives on
     * the JharJeevan Express server at localhost:5000.
     */

    window.JHARJEEVAN_API_BASE = "http://localhost:5000";

    const TOKEN_KEY =
        "jharjeevan_client_token";

    function getClientToken() {

        try {
            return (
                localStorage.getItem(
                    TOKEN_KEY
                ) || ""
            ).trim();

        } catch {

            return "";
        }
    }

    function buildApiUrl(path) {

        const cleanPath =
            String(path || "").startsWith("/")
                ? String(path || "")
                : `/${String(path || "")}`;

        return (
            window.JHARJEEVAN_API_BASE +
            cleanPath
        );
    }

    async function jharjeevanApi(
        path,
        options = {}
    ) {

        const url =
            buildApiUrl(path);

        const token =
            getClientToken();

        const headers = {
            "Content-Type":
                "application/json",

            ...(token
                ? {
                    Authorization:
                        `Bearer ${token}`
                }
                : {}),

            ...(options.headers || {})
        };

        let response;

        try {

            response =
                await fetch(
                    url,
                    {
                        ...options,
                        headers
                    }
                );

        } catch (networkError) {

            const error =
                new Error(
                    "Unable to connect to JharJeevan server. Make sure node server.js is running on port 5000."
                );

            error.code =
                "NETWORK_ERROR";

            error.url =
                url;

            error.cause =
                networkError;

            throw error;
        }

        let data = {};

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        if (
            contentType.includes(
                "application/json"
            )
        ) {

            try {

                data =
                    await response.json();

            } catch {

                data = {};
            }

        } else {

            const text =
                await response.text();

            data = {
                message:
                    text || ""
            };
        }

        if (!response.ok) {

            const message =
                data?.message ||
                data?.error ||
                `Request failed (${response.status})`;

            const error =
                new Error(
                    message
                );

            error.status =
                response.status;

            error.code =
                data?.code ||
                null;

            error.data =
                data;

            error.url =
                url;

            /*
             * 409 is a valid business response for operations
             * such as duplicate donor registration.
             *
             * Only unexpected server failures should be
             * printed as console errors.
             */

            if (response.status >= 500) {

                console.error(
                    "[JHARJEEVAN API ERROR]",
                    {
                        url,
                        status:
                            response.status,
                        message,
                        data
                    }
                );

            } else {

                console.info(
                    "[JHARJEEVAN API]",
                    {
                        url,
                        status:
                            response.status,
                        message
                    }
                );

            }

            throw error;
        }

        return data;
    }

    /*
     * Expose ONE canonical API bridge.
     *
     * Other dashboard modules already call:
     *
     * window.jharjeevanApi(...)
     */

    window.jharjeevanApi =
        jharjeevanApi;

    /*
     * Helpful debugging information.
     * No token is exposed.
     */

    window.jharjeevanApiBase =
        window.JHARJEEVAN_API_BASE;

})();
/* JHARJEEVAN CANONICAL API BRIDGE END */

(() => {
    "use strict";

    const API_BASE = window.JHARJEEVAN_API_BASE;
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
    /*
     * AUTH PROFILE HELPERS
     *
     * These helpers must live inside the same authentication
     * IIFE as verifySession(). The later LIVE PROFILE CONTROLLER
     * has its own copies, but those are not visible here.
     */

    function saveClient(client) {
        localStorage.setItem(
            CLIENT_KEY,
            JSON.stringify(client || {})
        );
    }

    function normalizeClientProfile(client) {
        const source = client || {};

        return {
            ...source,
            id: source.id ?? null,
            name: String(source.name ?? "").trim(),
            email: String(source.email ?? "").trim(),
            phone: String(source.phone ?? "").trim(),

            bloodGroup: String(
                source.bloodGroup ??
                source.blood_group ??
                ""
            ).trim().toUpperCase(),

            location: String(
                source.location ?? ""
            ).trim(),

            isActive:
                source.isActive ??
                source.is_active ??
                true,

            lastLoginAt:
                source.lastLoginAt ??
                source.last_login_at ??
                null,

            createdAt:
                source.createdAt ??
                source.created_at ??
                null,

            updatedAt:
                source.updatedAt ??
                source.updated_at ??
                null
        };
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

    /*
     * GLOBAL API BRIDGE
     * Dashboard modules defined outside the original scope
     * use api() directly.
     */
    window.api = api;

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
                const result = await api("/api/client/login", {
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
                sessionStorage.setItem("jharjeevanActiveSection", "overview");

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
                const result = await api("/api/client/register", {
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
                sessionStorage.setItem("jharjeevanActiveSection", "overview");

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

            const result =
                await api("/api/client/verify");

            if (!result.success) {
                throw new Error(
                    "Session verification failed."
                );
            }

            if (result.client) {

                /*
                 * IMPORTANT:
                 * Session verification is NOT the authoritative
                 * profile endpoint.
                 *
                 * Preserve the existing profile state and merge
                 * the session information into it.
                 */
                const existingClient =
                    normalizeClientProfile(
                        getStoredClient()
                    );

                const verifiedClient =
                    normalizeClientProfile(
                        result.client
                    );

                const mergedClient = {
                    ...existingClient,
                    ...verifiedClient
                };

                /*
                 * If the session endpoint does not provide
                 * blood-group data, preserve the existing value.
                 */
                if (
                    !verifiedClient.bloodGroup &&
                    existingClient.bloodGroup
                ) {
                    mergedClient.bloodGroup =
                        existingClient.bloodGroup;
                }

                saveClient(
                    normalizeClientProfile(
                        mergedClient
                    )
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

        /*
         * Hydrate the UI immediately from the locally stored
         * authenticated client. This prevents the Profile page
         * from appearing empty while the API request is running.
         */
        const storedClient = getStoredClient();

        if (storedClient) {
            updateProfileUI(storedClient);
        }

        try {

            const result = await api(
                "/api/client/profile"
            );

            if (!result.success || !result.client) {

                /*
                 * Keep the locally cached profile visible instead
                 * of replacing it with empty placeholders.
                 */
                if (storedClient) {
                    updateProfileUI(storedClient);
                }

                return;
            }

            const client = result.client;

            /*
             * Keep the local session/profile cache synchronized
             * with the latest server data.
             */
            localStorage.setItem(
                CLIENT_KEY,
                JSON.stringify(client)
            );

            updateProfileUI(client);

        } catch (error) {

            /*
             * Authentication failure still behaves exactly as
             * before.
             */
            if (error.status === 401) {
                clearSession();
                redirectToLogin();
                return;
            }

            /*
             * Network/API failure:
             * keep showing the cached profile instead of dashes.
             */
            if (storedClient) {
                updateProfileUI(storedClient);
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

        // ----------------------------------------------------
        // PROFILE HERO
        // Connect the new visual profile header to the same
        // authenticated client data already loaded above.
        // ----------------------------------------------------

        const jjProfileAvatarLetter = $("#jjProfileAvatarLetter");
        const jjProfileDisplayName = $("#jjProfileDisplayName");
        const jjProfileDisplayEmail = $("#jjProfileDisplayEmail");

        if (jjProfileAvatarLetter) {
            jjProfileAvatarLetter.textContent = initial;
        }

        if (jjProfileDisplayName) {
            jjProfileDisplayName.textContent = name;
        }

        if (jjProfileDisplayEmail) {
            jjProfileDisplayEmail.textContent = email;
        }

        const details = {
            "#profileDetailName": name || "Client",
            "#profileDetailEmail": email || "No email",
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

    const results = $("#findBloodResults");
    const count = $("#bloodResultsCount");
    const title = $("#bloodResultsTitle");

    if (!results) {
        return;
    }

    if (title) {
        title.textContent =
            "Available blood support";
    }

    if (count) {
        count.textContent =
            "Loading...";
    }

    results.innerHTML = `
        <div class="find-blood-empty">
            <div>
                <div class="find-blood-empty-icon">
                    \u{1FA78}
                </div>

                <h3>
                    Finding available blood...
                </h3>

                <p>
                    Please wait while we load the latest inventory.
                </p>
            </div>
        </div>
    `;

    try {

        const result =
            await api(
                "/api/inventory"
            );

        if (!result || typeof result !== "object") {
            throw new Error(
                "Invalid inventory response."
            );
        }

        renderInventory(result);

    } catch (error) {

        console.error(
            "Find Blood inventory loading failed:",
            error
        );

        renderInventoryError(
            error?.message ||
            "Unable to load blood availability right now."
        );
    }
}

let clientBloodInventory = {};

function renderInventory(inventory) {

    const results = $("#findBloodResults");
    const count = $("#bloodResultsCount");
    const title = $("#bloodResultsTitle");

    const groupFilter =
        $("#bloodGroupFilter");

    const locationFilter =
        $("#bloodLocationFilter");

    const searchButton =
        $("#bloodSearchButton");

    if (!results) {
        return;
    }

    clientBloodInventory =
        inventory || {};

    const selectedGroup =
        String(
            groupFilter?.value || ""
        )
            .trim()
            .toUpperCase();

    const location =
        String(
            locationFilter?.value || ""
        )
            .trim();

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

    let availableGroups =
        groups.map((group) => ({
            group,
            units: Number(
                clientBloodInventory[group] || 0
            )
        }));

    if (selectedGroup) {

        availableGroups =
            availableGroups.filter(
                item =>
                    item.group === selectedGroup
            );
    }

    const totalAvailable =
        availableGroups.reduce(
            (sum, item) =>
                sum + item.units,
            0
        );

    const availableTypes =
        availableGroups.filter(
            item => item.units > 0
        );

    if (title) {

        title.textContent =
            location
                ? `Blood support near "${location}"`
                : selectedGroup
                    ? `${selectedGroup} blood availability`
                    : "Available blood support";
    }

    if (count) {

        count.textContent =
            `${availableTypes.length} blood group` +
            `${availableTypes.length === 1 ? "" : "s"} available \u2022 ` +
            `${totalAvailable} unit` +
            `${totalAvailable === 1 ? "" : "s"}`;
    }

    /*
     * Bind controls once.
     */
    if (
        searchButton &&
        searchButton.dataset.bound !== "true"
    ) {

        searchButton.dataset.bound =
            "true";

        searchButton.addEventListener(
            "click",
            () => {
                renderInventory(clientBloodInventory);
            }
        );

        groupFilter?.addEventListener(
            "change",
            () => {
                renderInventory(clientBloodInventory);
            }
        );

        locationFilter?.addEventListener(
            "keydown",
            (event) => {

                if (event.key !== "Enter") {
                    return;
                }

                event.preventDefault();

                renderInventory(clientBloodInventory);
            }
        );
    }

    if (!availableGroups.length) {

        results.innerHTML = `
            <div class="find-blood-empty">

                <div>

                    <div class="find-blood-empty-icon">
                        \u{1FA78}
                    </div>

                    <h3>
                        No matching blood group
                    </h3>

                    <p>
                        Try another blood group or select
                        "All blood groups".
                    </p>

                </div>

            </div>
        `;

        return;
    }

    results.innerHTML =
        availableGroups.map(
            ({ group, units }) => {

                const available =
                    units > 0;

                return `
                    <article class="find-blood-result">

                        <div class="find-blood-result-top">

                            <span class="find-blood-group">
                                ${escapeHtml(group)}
                            </span>

                            <span
                                class="find-blood-availability"
                                style="${
                                    available
                                        ? ""
                                        : "background:#f1f5f9;color:#64748b;"
                                }"
                            >
                                ${
                                    available
                                        ? "Available"
                                        : "Currently unavailable"
                                }
                            </span>

                        </div>

                        <h3>
                            ${escapeHtml(group)} Blood
                        </h3>

                        <p>
                            ${
                                available
                                    ? "Compatible blood support is currently available."
                                    : "No available units are currently recorded."
                            }
                        </p>

                        <div class="find-blood-meta">

                            <div class="find-blood-meta-item">

                                <span>
                                    Available
                                </span>

                                <strong>
                                    ${units}
                                    unit${units === 1 ? "" : "s"}
                                </strong>

                            </div>

                            <div class="find-blood-meta-item">

                                <span>
                                    Status
                                </span>

                                <strong>
                                    ${
                                        available
                                            ? "Ready"
                                            : "Waitlist"
                                    }
                                </strong>

                            </div>

                        </div>

                        ${
                            available
                                ? `
                                    <button
                                        type="button"
                                        class="primary-action find-blood-request-button"
                                        data-request-blood="${escapeHtml(group)}"
                                    >
                                        Request ${escapeHtml(group)}
                                        <span aria-hidden="true">\u2192</span>
                                    </button>
                                `
                                : ""
                        }

                    </article>
                `;
            }
        ).join("");

    /*
     * Connect Request Blood buttons.
     */
    results
        .querySelectorAll(
            "[data-request-blood]"
        )
        .forEach((button) => {

            button.addEventListener(
                "click",
                () => {

                    const group =
                        button.getAttribute(
                            "data-request-blood"
                        );

                    if (
                        typeof openBloodRequestModal ===
                        "function"
                    ) {
                        openBloodRequestModal(
                            group
                        );
                    }
                }
            );
        });
}

function renderInventoryError(message) {

    const results = $("#findBloodResults");
    const count = $("#bloodResultsCount");
    const title = $("#bloodResultsTitle");

    if (!results) {
        return;
    }

    if (title) {
        title.textContent =
            "Blood availability unavailable";
    }

    if (count) {
        count.textContent =
            "Please try again";
    }

    results.innerHTML = `
        <div class="find-blood-empty">

            <div>

                <div class="find-blood-empty-icon">
                    !
                </div>

                <h3>
                    Unable to load blood support
                </h3>

                <p>
                    ${escapeHtml(
                        message ||
                        "Something went wrong while searching for available blood."
                    )}
                </p>

                <button
                    type="button"
                    class="primary-action"
                    id="findBloodRetryButton"
                >
                    Try Again
                    <span aria-hidden="true">\u21BB</span>
                </button>

            </div>

        </div>
    `;

    $("#findBloodRetryButton")?.addEventListener(
        "click",
        () => {
            void loadInventory();
        }
    );
}

function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
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

            /*
             * ---------------------------------------------------------
             * PERSIST ACTIVE DASHBOARD SECTION
             * ---------------------------------------------------------
             * Keep the user's current dashboard location across a
             * normal browser refresh.
             */
            try {
                sessionStorage.setItem(
                    "jharjeevanActiveSection",
                    sectionId
                );
            } catch {
                /* Ignore storage failures. Navigation must still work. */
            }

            const target =
                document.getElementById(sectionId);

            /*
             * ---------------------------------------------------------
             * MY REQUESTS
             * ---------------------------------------------------------
             * Load request data whenever the Requests section
             * becomes active.
             */
            if (sectionId === "requests") {
                void loadClientRequests();
            }

            if (sectionId === "donor") {
                void loadClientDonor();
            }

            /*
             * ---------------------------------------------------------
             * MY REQUESTS
             * ---------------------------------------------------------
             * Load request data whenever the Requests section
             * becomes active.
             */


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

        /*
 * LEGACY NAVIGATION DISABLED
 *
 * Navigation is now controlled exclusively by
 * activateDashboardSection().
 */


        /*
         * Dashboard buttons such as:
         * Find Blood \u2192
         * View My Requests
         */

        /*
 * LEGACY DASHBOARD ACTION NAVIGATION DISABLED
 *
 * All data-section-target navigation is now handled by
 * activateDashboardSection().
 */


        window.activateDashboardSection =
            activateSection;

    }

    function setupLogout() {
    /*
     * Legacy logout handler intentionally disabled.
     *
     * The capture-phase logout controller below is now
     * the single source of truth.
     */
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

    
    /* ========================================================
       CREATE BLOOD REQUEST BUTTON
       Connects the existing CTA to the existing modal.
       ======================================================== */

    function setupBloodRequestButton() {

        const button =
            $("#openBloodRequestButton");

        if (!button) {
            return;
        }

        if (
            button.dataset.requestButtonReady === "true"
        ) {
            return;
        }

        button.dataset.requestButtonReady = "true";

        button.addEventListener(
            "click",
            (event) => {

                event.preventDefault();
                event.stopPropagation();

                openBloodRequestModal();
            }
        );
    }

async function syncOverviewLiveStats() {

    const requests =
        Array.isArray(clientRequests)
            ? clientRequests
            : [];

    const normalizeStatus = (value) =>
        String(value || "")
            .trim()
            .toLowerCase();

    const pendingStatuses = new Set([
        "pending",
        "submitted",
        "processing",
        "in progress",
        "in_progress"
    ]);

    const approvedStatuses = new Set([
        "approved",
        "accepted"
    ]);

    const pendingRequests =
        requests.filter((request) =>
            pendingStatuses.has(
                normalizeStatus(request?.status)
            )
        );

    const approvedRequests =
        requests.filter((request) =>
            approvedStatuses.has(
                normalizeStatus(request?.status)
            )
        );

    let notificationCount = 0;

    if (Array.isArray(clientNotifications)) {

        notificationCount =
            clientNotifications.filter(
                notification =>
                    !Boolean(notification?.is_read)
            ).length;

    } else {

        const notificationElement =
            document.querySelector(
                "#notificationCount"
            );

        if (notificationElement) {

            notificationCount =
                parseInt(
                    String(
                        notificationElement.textContent || "0"
                    ).replace(/[^\d-]/g, ""),
                    10
                ) || 0;
        }
    }

    const values = {
        requestCount: requests.length,
        pendingCount: pendingRequests.length,
        approvedCount: approvedRequests.length,
        notificationCount
    };

    Object.entries(values).forEach(
        ([id, value]) => {

            const element =
                document.querySelector(
                    "#" + id
                );

            if (element) {
                element.textContent =
                    String(value);
            }
        }
    );
}

function openBloodRequestModal(prefillGroup = "") {

    if (document.querySelector("#bloodRequestModal")) {
        return;
    }

    const client =
        typeof getStoredClient === "function"
            ? getStoredClient()
            : {};

    const defaultName =
        client?.name ||
        client?.full_name ||
        "";

    const defaultEmail =
        client?.email ||
        "";

    const defaultPhone =
        client?.phone ||
        "";

    const defaultBlood =
        prefillGroup ||
        client?.bloodGroup ||
        client?.blood_group ||
        "";

    const defaultCity =
        client?.location ||
        "";

    const modal =
        document.createElement("div");

    modal.id =
        "bloodRequestModal";

    modal.className =
        "blood-request-modal";

    modal.innerHTML = `
        <div
            class="blood-request-backdrop"
            data-close-request
        ></div>

        <div
            class="blood-request-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bloodRequestTitle"
        >

            <div class="blood-request-header">

                <div>

                    <span class="panel-label">
                        LIFE-SAVING REQUEST
                    </span>

                    <h2 id="bloodRequestTitle">
                        Create Blood Request
                    </h2>

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
                    \u00D7
                </button>

            </div>

            <form
                id="bloodRequestForm"
                class="blood-request-form"
            >

                <div class="request-form-section">

                    <div class="request-form-section-title">
                        <span>01</span>
                        Patient details
                    </div>

                    <div class="request-form-grid">

                        <label>
                            Patient name

                            <input
                                id="requestPatientName"
                                name="patientName"
                                type="text"
                                required
                                autocomplete="name"
                                value="${escapeHtml(defaultName)}"
                            >
                        </label>

                        <label>
                            Blood group

                            <select
                                name="bloodGroup"
                                required
                            >
                                <option value="">
                                    Select blood group
                                </option>

                                ${[
                                    "A+",
                                    "A-",
                                    "B+",
                                    "B-",
                                    "AB+",
                                    "AB-",
                                    "O+",
                                    "O-"
                                ].map((group) => `
                                    <option
                                        value="${group}"
                                        ${defaultBlood === group ? "selected" : ""}
                                    >
                                        ${group}
                                    </option>
                                `).join("")}

                            </select>

                        </label>

                        <label>
                            Units required

                            <input
                                name="unitsRequired"
                                type="number"
                                min="1"
                                max="10"
                                value="1"
                                required
                            >
                        </label>

                        <label>
                            Required date

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
                            Hospital / medical center

                            <input
                                name="hospitalName"
                                type="text"
                                required
                            >
                        </label>

                        <label>
                            City

                            <input
                                name="city"
                                type="text"
                                required
                                value="${escapeHtml(defaultCity)}"
                            >
                        </label>

                        <label class="request-form-full">
                            Hospital address

                            <textarea
                                name="hospitalAddress"
                                rows="3"
                                required
                            ></textarea>
                        </label>

                    </div>

                </div>


                <div class="request-form-section">

                    <div class="request-form-section-title">
                        <span>03</span>
                        Contact details
                    </div>

                    <div class="request-form-grid">

                        <label>
                            Requester name

                            <input
                                name="requesterName"
                                type="text"
                                required
                                autocomplete="name"
                                value="${escapeHtml(defaultName)}"
                            >
                        </label>

                        <label>
                            Phone

                            <input
                                name="requesterPhone"
                                type="tel"
                                inputmode="numeric"
                                maxlength="10"
                                required
                                autocomplete="tel"
                                value="${escapeHtml(defaultPhone)}"
                            >
                        </label>

                        <label class="request-form-full">
                            Email

                            <input
                                name="requesterEmail"
                                type="email"
                                required
                                autocomplete="email"
                                value="${escapeHtml(defaultEmail)}"
                            >
                        </label>

                    </div>

                </div>


                <div
                    id="bloodRequestMessage"
                    class="blood-request-message"
                    aria-live="polite"
                ></div>


                <div class="blood-request-footer">

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
                        Submit Blood Request
                        <span aria-hidden="true">\u2192</span>
                    </button>

                </div>

            </form>

        </div>
    `;

    document.body.appendChild(modal);

    modal
        .querySelectorAll("[data-close-request]")
        .forEach((element) => {

            element.addEventListener(
                "click",
                closeBloodRequestModal
            );

        });


    const form =
        document.querySelector(
            "#bloodRequestForm"
        );

    if (form) {

        form.addEventListener(
            "submit",
            submitBloodRequest
        );
    }


    requestAnimationFrame(() => {

        modal.classList.add(
            "is-visible"
        );

    });


    setTimeout(() => {

        document
            .querySelector(
                "#requestPatientName"
            )
            ?.focus();

    }, 100);
}


function closeBloodRequestModal() {

    const modal =
        document.querySelector(
            "#bloodRequestModal"
        );

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "is-visible"
    );

    setTimeout(() => {

        modal.remove();

    }, 220);
}


async function submitBloodRequest(event) {

    event.preventDefault();

    const form =
        event.currentTarget;

    const button =
        document.querySelector(
            "#submitBloodRequestButton"
        );

    const message =
        document.querySelector(
            "#bloodRequestMessage"
        );

    const formData =
        new FormData(form);

    const payload = {

        patientName:
            String(
                formData.get("patientName") || ""
            ).trim(),

        bloodGroup:
            String(
                formData.get("bloodGroup") || ""
            ).trim(),

        unitsRequired:
            Number(
                formData.get("unitsRequired")
            ),

        hospitalName:
            String(
                formData.get("hospitalName") || ""
            ).trim(),

        hospitalAddress:
            String(
                formData.get("hospitalAddress") || ""
            ).trim(),

        city:
            String(
                formData.get("city") || ""
            ).trim(),

        requiredDate:
            String(
                formData.get("requiredDate") || ""
            ).trim(),

        requesterName:
            String(
                formData.get("requesterName") || ""
            ).trim(),

        requesterPhone:
            String(
                formData.get("requesterPhone") || ""
            ).trim(),

        requesterEmail:
            String(
                formData.get("requesterEmail") || ""
            ).trim()

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

            message.className =
                "blood-request-message error";

            message.textContent =
                "Please complete all required fields.";
        }

        return;
    }


    if (
        !/^\d{10}$/.test(
            payload.requesterPhone
        )
    ) {

        if (message) {

            message.className =
                "blood-request-message error";

            message.textContent =
                "Please enter a valid 10-digit phone number.";
        }

        return;
    }


    if (
        payload.unitsRequired < 1 ||
        payload.unitsRequired > 10
    ) {

        if (message) {

            message.className =
                "blood-request-message error";

            message.textContent =
                "Units required must be between 1 and 10.";
        }

        return;
    }


    try {

        if (button) {

            button.disabled =
                true;

            button.textContent =
                "Submitting\u2026";
        }


        if (message) {

            message.className =
                "blood-request-message";

            message.textContent =
                "Submitting your blood request\u2026";
        }


        const result =
            await api(
                "/api/requests",
                {
                    method: "POST",
                    body: JSON.stringify(payload)
                }
            );


        if (!result?.success) {

            throw new Error(
                result?.message ||
                "Unable to submit blood request."
            );
        }


        if (message) {

            message.className =
                "blood-request-message success";

            message.textContent =
                "Blood request submitted successfully.";
        }


        if (
            typeof storeClientRequest ===
            "function"
        ) {

            storeClientRequest(
                result.request
            );
        }


        setTimeout(() => {

            closeBloodRequestModal();

            const requestsSection =
                document.querySelector(
                    "#requests"
                );

            if (requestsSection) {

                document
                    .querySelector(
                        '[data-section-target="requests"]'
                    )
                    ?.click();

            }

        }, 900);


    }
    catch (error) {

        console.error(
            "Blood request submission failed:",
            error
        );


        if (message) {

            message.className =
                "blood-request-message error";

            message.textContent =
                error?.message ||
                "Something went wrong while submitting the request.";
        }


        if (button) {

            button.disabled =
                false;

            button.textContent =
                "Submit Blood Request \u2192";
        }

    }
}



/* ============================================================
   GLOBAL OVERVIEW LIVE-STATS BRIDGE
   Makes the existing synchronizer available to dashboard
   modules such as notification loading.
   ============================================================ */
window.syncOverviewLiveStats = syncOverviewLiveStats;


/* ============================================================
   JHARJEEVAN \u2014 CLIENT REQUEST CONTROLLER
   Server-backed request history + refresh + empty/error states
   ============================================================ */

let clientRequests = [];

function updateClientRequestCount() {

    const countElement = document.querySelector("#requestCount");

    if (!countElement) {
        return;
    }

    const count =
        Array.isArray(clientRequests)
            ? clientRequests.length
            : 0;

    countElement.textContent = String(count);
}

function setupRequestsRefreshButton() {

    const button =
        document.querySelector("#refreshRequestsButton");

    if (!button) {
        return;
    }

    if (button.dataset.refreshReady === "true") {
        return;
    }

    button.dataset.refreshReady = "true";

    button.addEventListener("click", async (event) => {

        event.preventDefault();

        if (button.disabled) {
            return;
        }

        button.disabled = true;
        button.classList.add("is-refreshing");

        const originalText =
            button.textContent;

        button.setAttribute(
            "aria-busy",
            "true"
        );

        try {

            await loadClientRequests();

        } finally {

            setTimeout(() => {

                button.disabled = false;
                button.classList.remove(
                    "is-refreshing"
                );

                button.removeAttribute(
                    "aria-busy"
                );

                button.textContent =
                    originalText || "Refresh";

            }, 350);
        }
    });
}

async function loadClientRequests(options = {}) {

    const list = document.querySelector("#requestsList");

    if (!list) {
        return;
    }

    /*
     * ---------------------------------------------------------
     * SINGLE-FLIGHT REQUEST LOADER
     * ---------------------------------------------------------
     * Multiple dashboard navigation systems can request the
     * same section during startup/refresh. Never allow another
     * request load to reset the loading state while one is
     * already running.
     */
    if (list.dataset.loading === "true") {
        return;
    }
    const silent = Boolean(options.silent);
    const timeoutMs = 10000;

    list.dataset.loading = "true";
    list.dataset.requestError = "false";

    /*
     * Immediately show cached data when available.
     * The server remains the source of truth.
     */
    let cachedRequests = [];

    try {

        const stored =
            JSON.parse(
                sessionStorage.getItem(
                    "clientSubmittedRequests"
                ) || "[]"
            );

        cachedRequests =
            Array.isArray(stored)
                ? stored
                : [];

    } catch {
        cachedRequests = [];
    }

    if (cachedRequests.length) {

        clientRequests = cachedRequests;

        list.dataset.loading = "false";

        renderClientRequests();

    } else if (!silent) {

        renderClientRequests();
    }

    /*
     * Never allow the request screen to remain stuck forever.
     */
    const timeoutPromise =
        new Promise((_, reject) => {

            setTimeout(() => {

                reject(
                    new Error(
                        "Request history is taking too long to respond."
                    )
                );

            }, timeoutMs);
        });

    try {

        /*
         * Use the primary dashboard API bridge.
         * Fall back to the shared API helper when available.
         */
        const requestApi =
            typeof window.jharjeevanApi === "function"
                ? window.jharjeevanApi
                : typeof window.api === "function"
                    ? window.api
                    : null;

        if (!requestApi) {
            throw new Error(
                "The dashboard API connection is unavailable."
            );
        }

        const apiPromise =
            requestApi(
                "/api/client/requests"
            );

        const result =
            await Promise.race([
                apiPromise,
                timeoutPromise
            ]);

        if (!result?.success) {

            throw new Error(
                result?.message ||
                "Unable to load your request history."
            );
        }

        clientRequests =
            Array.isArray(result.requests)
                ? result.requests
                : [];

        try {

            sessionStorage.setItem(
                "clientSubmittedRequests",
                JSON.stringify(clientRequests)
            );

        } catch {
            /* Storage is optional. */
        }

        list.dataset.requestError = "false";

        if (
            typeof syncOverviewLiveStats ===
            "function"
        ) {
            try {
                syncOverviewLiveStats();
            } catch {
                /* Overview sync must never break Requests. */
            }
        }

    } catch (error) {

        console.error(
            "My Requests loading failed:",
            error
        );

        /*
         * Preserve cached requests if the API failed.
         */
        if (
            !Array.isArray(clientRequests) ||
            !clientRequests.length
        ) {

            try {

                const stored =
                    JSON.parse(
                        sessionStorage.getItem(
                            "clientSubmittedRequests"
                        ) || "[]"
                    );

                clientRequests =
                    Array.isArray(stored)
                        ? stored
                        : [];

            } catch {

                clientRequests = [];
            }
        }

        list.dataset.requestError = "true";

        /*
         * Store a user-friendly diagnostic without
         * exposing technical internals.
         */
        list.dataset.requestErrorMessage =
            error?.message ||
            "Unable to load your request history.";

    } finally {

        list.dataset.loading = "false";

        renderClientRequests();
        updateClientRequestCount();

    }
}
function storeClientRequest(request) {

    if (!request) {
        return;
    }

    const existing =
        Array.isArray(clientRequests)
            ? clientRequests
            : [];

    clientRequests = [
        request,
        ...existing.filter(
            item =>
                item?.id !== request?.id
        )
    ];

    try {

        sessionStorage.setItem(
            "clientSubmittedRequests",
            JSON.stringify(
                clientRequests
            )
        );

    } catch {
        /* Ignore storage failures. */
    }

    renderClientRequests();
    updateClientRequestCount();

    if (
        typeof syncOverviewLiveStats ===
        "function"
    ) {
        syncOverviewLiveStats();
    }
}

function requestValue(
    request,
    ...keys
) {

    for (const key of keys) {

        const value =
            request?.[key];

        if (
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
        ) {
            return value;
        }
    }

    return "";
}

function requestEscapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function requestFormatDate(value) {

    if (!value) {
        return "\u2014";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "\u2014";
    }

    return date.toLocaleDateString(
        undefined,
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}

function requestFormatDateTime(value) {

    if (!value) {
        return "\u2014";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "\u2014";
    }

    return date.toLocaleString(
        undefined,
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}

function getRequestStatusMeta(status) {

    const value =
        String(status || "")
            .trim()
            .toLowerCase();

    if (
        value === "approved" ||
        value === "accepted"
    ) {
        return {
            label: "Approved",
            className: "approved",
            icon: "\u2713",
            message:
                "Your request has been approved."
        };
    }

    if (
        value === "completed" ||
        value === "fulfilled"
    ) {
        return {
            label: "Completed",
            className: "completed",
            icon: "\u2713",
            message:
                "Your blood request has been completed."
        };
    }

    if (
        value === "rejected" ||
        value === "declined"
    ) {
        return {
            label: "Rejected",
            className: "rejected",
            icon: "\u00D7",
            message:
                "This request was not approved."
        };
    }

    if (
        value === "cancelled" ||
        value === "canceled"
    ) {
        return {
            label: "Cancelled",
            className: "rejected",
            icon: "\u00D7",
            message:
                "This request has been cancelled."
        };
    }

    return {
        label: "Pending",
        className: "pending",
        icon: "\u2022",
        message:
            "Your request is being reviewed."
    };
}

function getRequestPriorityMeta(priority) {

    const value =
        String(priority || "")
            .trim()
            .toLowerCase();

    if (
        value === "urgent" ||
        value === "critical" ||
        value === "emergency"
    ) {
        return {
            label: "Urgent",
            className: "urgent",
            icon: "!"
        };
    }

    if (
        value === "high" ||
        value === "priority"
    ) {
        return {
            label: "High Priority",
            className: "high",
            icon: "\u2191"
        };
    }

    return {
        label: "Normal",
        className: "normal",
        icon: "\u2022"
    };
}

function renderClientRequests() {

    const list =
        document.querySelector(
            "#requestsList"
        );

    if (!list) {
        return;
    }

    const requests =
        Array.isArray(clientRequests)
            ? clientRequests
            : [];

    /*
     * ---------------------------------------------------------
     * HELPERS
     * ---------------------------------------------------------
     */

    const escapeHtml = (value) => {

        return String(
            value ?? ""
        )
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    };

    const value = (
        request,
        ...keys
    ) => {

        for (const key of keys) {

            const current =
                request?.[key];

            if (
                current !== undefined &&
                current !== null &&
                String(current).trim() !== ""
            ) {
                return current;
            }
        }

        return "";
    };

    const formatDate = (raw) => {

        if (!raw) {
            return "Date not specified";
        }

        const date =
            new Date(raw);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return String(raw);
        }

        return date.toLocaleDateString(
            undefined,
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );
    };

    const formatDateTime = (raw) => {

        if (!raw) {
            return "Recently submitted";
        }

        const date =
            new Date(raw);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return String(raw);
        }

        return date.toLocaleString(
            undefined,
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    };

    const normalizeStatus = (raw) => {

        const status =
            String(
                raw || "pending"
            )
                .trim()
                .toLowerCase();

        if (
            [
                "approved",
                "accepted",
                "fulfilled",
                "completed"
            ].includes(status)
        ) {
            return "approved";
        }

        if (
            [
                "rejected",
                "declined",
                "cancelled",
                "canceled"
            ].includes(status)
        ) {
            return "rejected";
        }

        if (
            [
                "matched",
                "processing",
                "in_progress"
            ].includes(status)
        ) {
            return "matched";
        }

        return "pending";
    };

    const statusMeta = (
        status
    ) => {

        const normalized =
            normalizeStatus(status);

        if (
            normalized === "approved"
        ) {
            return {
                label: "Approved",
                icon: "\u2713",
                className: "status-approved",
                message:
                    "Your blood request has been approved."
            };
        }

        if (
            normalized === "rejected"
        ) {
            return {
                label: "Rejected",
                icon: "\u00D7",
                className: "status-rejected",
                message:
                    "This request was not approved."
            };
        }

        if (
            normalized === "matched"
        ) {
            return {
                label: "Matched",
                                icon: "\u2197",
                className: "status-matched",
                message:
                    "A compatible blood match is being processed."
            };
        }

        return {
            label: "Pending",
            icon: "\u2022",
            className: "status-pending",
            message:
                "Your request is currently under review."
        };
    };

    const priorityMeta = (
        raw
    ) => {

        const priority =
            String(
                raw || "normal"
            )
                .trim()
                .toLowerCase();

        if (
            [
                "urgent",
                "critical",
                "high"
            ].includes(priority)
        ) {
            return {
                label: "Urgent",
                className: "priority-urgent"
            };
        }

        return {
            label: "Standard",
            className: "priority-normal"
        };
    };

    /*
     * ---------------------------------------------------------
     * LOADING
     * ---------------------------------------------------------
     */

    if (
        list.dataset.loading === "true"
    ) {

        list.innerHTML = `
            <div class="jj-request-loading">

                <div class="jj-loading-icon">
                    <span aria-hidden="true">\u{1FA78}</span>
                </div>

                <div class="jj-loading-copy">
                    <strong>
                        Loading your requests
                    </strong>

                    <span>
                        Checking your latest blood request activity\u2026
                    </span>
                </div>

                <div
                    class="jj-loading-bar"
                    aria-hidden="true"
                >
                    <span></span>
                </div>

            </div>
        `;

        return;
    }

    /*
     * ---------------------------------------------------------
     * ERROR WITH NO DATA
     * ---------------------------------------------------------
     */

    if (
        list.dataset.requestError === "true" &&
        !requests.length
    ) {

        list.innerHTML = `
            <div class="jj-request-state jj-request-error">

                <div class="jj-state-icon">
                    âš 
                </div>

                <span class="jj-state-eyebrow">
                    REQUEST HISTORY
                </span>

                <h3>
                    We couldn't load your requests
                </h3>

                <p>
                    Your account is still safe. Please try
                    refreshing the request history.
                </p>

                <button
                    type="button"
                    class="jj-state-button"
                    id="jjRetryRequestsButton"
                >
                    <span>\u21BB</span>
                    Try again
                </button>

            </div>
        `;

        document
            .querySelector(
                "#jjRetryRequestsButton"
            )
            ?.addEventListener(
                "click",
                () => {

                    void loadClientRequests({
                        silent: false
                    });
                }
            );

        return;
    }

    /*
     * ---------------------------------------------------------
     * EMPTY
     * ---------------------------------------------------------
     */

    if (!requests.length) {

        list.innerHTML = `
            <div class="jj-request-state jj-request-empty">

                <div class="jj-empty-orbit">
                    <div class="jj-empty-icon">
                        \u{1F4CB}
                    </div>
                </div>

                <span class="jj-state-eyebrow">
                    REQUEST HISTORY
                </span>

                <h3>
                    No blood requests yet
                </h3>

                <p>
                    When you submit a blood request, its
                    live status and complete details will
                    appear here.
                </p>

                <button
                    type="button"
                    class="jj-state-button"
                    id="jjCreateRequestButton"
                >
                    <span>ï¼‹</span>
                    Create blood request
                </button>

            </div>
        `;

        document
            .querySelector(
                "#jjCreateRequestButton"
            )
            ?.addEventListener(
                "click",
                () => {

                    if (
                        typeof openBloodRequestModal ===
                        "function"
                    ) {
                        openBloodRequestModal();
                    }
                }
            );

        return;
    }

    /*
     * ---------------------------------------------------------
     * SUMMARY
     * ---------------------------------------------------------
     */

    const pendingCount =
        requests.filter(
            (request) =>
                normalizeStatus(
                    value(
                        request,
                        "status",
                        "request_status"
                    )
                ) === "pending"
        ).length;

    const approvedCount =
        requests.filter(
            (request) =>
                normalizeStatus(
                    value(
                        request,
                        "status",
                        "request_status"
                    )
                ) === "approved"
        ).length;

    const urgentCount =
        requests.filter(
            (request) =>
                [
                    "urgent",
                    "critical",
                    "high"
                ].includes(
                    String(
                        value(
                            request,
                            "priority",
                            "priority_level"
                        ) || ""
                    ).toLowerCase()
                )
        ).length;

    const summary =
        document.createElement("div");

    summary.className =
        "jj-request-summary";

    summary.innerHTML = `

        <div class="jj-summary-card">
            <span class="jj-summary-icon">\u{1F4CB}</span>
            <div>
                <small>Total requests</small>
                <strong>${requests.length}</strong>
            </div>
        </div>

        <div class="jj-summary-card">
            <span class="jj-summary-icon jj-summary-pending">
                ⏳
            </span>
            <div>
                <small>Pending</small>
                <strong>${pendingCount}</strong>
            </div>
        </div>

        <div class="jj-summary-card">
            <span class="jj-summary-icon jj-summary-approved">
                \u2713
            </span>
            <div>
                <small>Approved</small>
                <strong>${approvedCount}</strong>
            </div>
        </div>

        <div class="jj-summary-card">
            <span class="jj-summary-icon jj-summary-urgent">
                !
            </span>
            <div>
                <small>Urgent</small>
                <strong>${urgentCount}</strong>
            </div>
        </div>

    `;

    /*
     * ---------------------------------------------------------
     * REQUEST CARDS
     * ---------------------------------------------------------
     */

    const cards =
        requests.map(
            (request, index) => {

                const status =
                    statusMeta(
                        value(
                            request,
                            "status",
                            "request_status"
                        )
                    );

                const priority =
                    priorityMeta(
                        value(
                            request,
                            "priority",
                            "priority_level"
                        )
                    );

                const patientName =
                    value(
                        request,
                        "patient_name",
                        "patientName"
                    ) || "Patient";

                const bloodGroup =
                    value(
                        request,
                        "blood_group",
                        "bloodGroup"
                    ) || "\u2014";

                const units =
                    value(
                        request,
                        "units_required",
                        "unitsRequired"
                    ) || "\u2014";

                const hospital =
                    value(
                        request,
                        "hospital_name",
                        "hospitalName"
                    ) || "Hospital not specified";

                const city =
                    value(
                        request,
                        "city",
                        "location"
                    ) || "Location not specified";

                const requiredDate =
                    value(
                        request,
                        "required_date",
                        "requiredDate"
                    );

                const requester =
                    value(
                        request,
                        "requester_name",
                        "requesterName"
                    );

                const createdAt =
                    value(
                        request,
                        "created_at",
                        "createdAt"
                    );

                const requestId =
                    value(
                        request,
                        "id",
                        "request_id"
                    ) || "\u2014";

                const safeId =
                    escapeHtml(
                        String(requestId)
                    );

                return `
                    <article
                        class="jj-request-card"
                        data-request-id="${safeId}"
                        style="--jj-card-delay:${Math.min(
                            index * 55,
                            300
                        )}ms"
                    >

                        <div class="jj-request-card-top">

                            <div class="jj-request-identity">

                                <div class="jj-blood-badge">
                                    ${escapeHtml(
                                        bloodGroup
                                    )}
                                </div>

                                <div>
                                    <span class="jj-card-eyebrow">
                                        BLOOD REQUEST
                                    </span>

                                    <h3>
                                        ${escapeHtml(
                                            patientName
                                        )}
                                    </h3>

                                    <span class="jj-request-id">
                                        Request #${safeId}
                                    </span>
                                </div>

                            </div>

                            <div class="jj-request-badges">

                                <span
                                    class="jj-status-badge ${status.className}"
                                >
                                    <b>${status.icon}</b>
                                    ${status.label}
                                </span>

                                <span
                                    class="jj-priority-badge ${priority.className}"
                                >
                                    ${priority.label}
                                </span>

                            </div>

                        </div>

                        <div class="jj-request-summary-strip">

                            <div>
                                <span>Units</span>
                                <strong>
                                    ${escapeHtml(
                                        String(units)
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Required</span>
                                <strong>
                                    ${escapeHtml(
                                        formatDate(
                                            requiredDate
                                        )
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Hospital</span>
                                <strong>
                                    ${escapeHtml(
                                        hospital
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Location</span>
                                <strong>
                                    ${escapeHtml(
                                        city
                                    )}
                                </strong>
                            </div>

                        </div>

                        <div class="jj-request-details">

                            <div class="jj-detail-item">
                                <span class="jj-detail-icon">
                                    \u{1F3E5}
                                </span>

                                <div>
                                    <small>
                                        Medical center
                                    </small>

                                    <strong>
                                        ${escapeHtml(
                                            hospital
                                        )}
                                    </strong>
                                </div>
                            </div>

                            <div class="jj-detail-item">
                                <span class="jj-detail-icon">
                                    \u{1F464}
                                </span>

                                <div>
                                    <small>
                                        Requester
                                    </small>

                                    <strong>
                                        ${escapeHtml(
                                            requester ||
                                            "You"
                                        )}
                                    </strong>
                                </div>
                            </div>

                            <div class="jj-detail-item">
                                <span class="jj-detail-icon">
                                    \u{1F5D3}
                                </span>

                                <div>
                                    <small>
                                        Submitted
                                    </small>

                                    <strong>
                                        ${escapeHtml(
                                            formatDateTime(
                                                createdAt
                                            )
                                        )}
                                    </strong>
                                </div>
                            </div>

                        </div>

                        <div class="jj-request-status-line">

                            <div
                                class="jj-status-dot ${status.className}"
                            ></div>

                            <div>
                                <strong>
                                    ${escapeHtml(
                                        status.message
                                    )}
                                </strong>

                                <span>
                                    Keep this page handy for
                                    the latest request status.
                                </span>
                            </div>

                        </div>

                    </article>
                `;
            }
        ).join("");

    list.innerHTML = "";

    list.appendChild(summary);

    const cardsContainer =
        document.createElement("div");

    cardsContainer.className =
        "jj-request-cards";

    cardsContainer.innerHTML =
        cards;

    list.appendChild(
        cardsContainer
    );
}


async function initDashboard() {
        const dashboard = document.querySelector(".dashboard-shell");

        if (!dashboard) return;

        const valid = await verifySession();

        if (!valid) return;

        setupNavigationController();
        if (typeof setupRequestsRefreshButton === "function") {
            setupRequestsRefreshButton();
        }

        /*
         * LEGACY SECTION RESTORE DISABLED
         *
         * The final dashboard navigation controller is now the
         * single source of truth for restoring the active section.
         */
        setupBloodRequestButton();
        setupLogout();

        const storedClient = getStoredClient();

        if (storedClient && storedClient.name) {
            updateProfileUI(storedClient);
        }

        await loadClientDonor();

        await Promise.all([
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

        /*
         * ---------------------------------------------------------
         * DASHBOARD READY
         * ---------------------------------------------------------
         * initDashboard() has now:
         *   1. verified the session
         *   2. connected navigation
         *   3. restored the saved dashboard section
         *   4. loaded dashboard data
         *
         * Reveal the dashboard only now so Overview never flashes
         * before the requested section is displayed.
         */
        const dashboardShell =
            document.querySelector(".dashboard-shell");

        if (dashboardShell) {
            dashboardShell.classList.add("dashboard-ready");
        }

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
   CLIENT DONOR CENTER
   ============================================================ */

function setDonorMessage(message = "", type = "") {
    const element = $("#donorFormMessage");

    if (!element) {
        return;
    }

    element.textContent = message || "";
    element.className = `donor-form-message ${type}`.trim();
}

/* Global DOM selector bridge for dashboard modules outside the main scope. */
if (typeof window.$ !== "function") {
    window.$ = (selector) => document.querySelector(selector);
}

function setDonorState(state) {
    const loading = $("#donorLoadingState");
    const registered = $("#donorRegisteredState");
    const content = $("#donorRegistrationContent");

    if (loading) {
        loading.hidden = state !== "loading";
    }

    if (registered) {
        registered.hidden = state !== "registered";
    }

    if (content) {
        content.hidden = state === "registered" || state === "loading";
    }
}

function calculateDonorEligibility() {

    const ageInput = $("#donorAge");
    const bloodGroupInput = $("#donorBloodGroup");
    const phoneInput = $("#donorPhone");
    const locationInput = $("#donorLocation");
    const lastDonationInput = $("#donorLastDonation");

    const box = $("#donorEligibility");
    const button = $("#registerDonorButton");

    if (!box) {
        return false;
    }

    const ageValue =
        String(ageInput?.value || "").trim();

    const bloodGroup =
        String(bloodGroupInput?.value || "").trim();

    const phone =
        String(phoneInput?.value || "")
            .replace(/\D/g, "");

    const location =
        String(locationInput?.value || "").trim();

    const lastDonationValue =
        String(lastDonationInput?.value || "").trim();

    /*
     * ----------------------------------------------------------
     * DEFAULT STATE
     * ----------------------------------------------------------
     */

    let eligible = false;

    let state = "neutral";

    let title =
        "Complete your donor details";

    let message =
        "Enter the required information to check your eligibility.";

    /*
     * ----------------------------------------------------------
     * REQUIRED FIELD CHECK
     * ----------------------------------------------------------
     */

    if (
        !ageValue ||
        !bloodGroup ||
        !phone ||
        !location
    ) {

        state = "neutral";

        title =
            "Complete your donor details";

        message =
            "Enter your age, blood group, phone number and location.";

    } else {

        const age = Number(ageValue);

        /*
         * ------------------------------------------------------
         * AGE
         * ------------------------------------------------------
         */

        if (
            !Number.isFinite(age) ||
            age < 18 ||
            age > 65
        ) {

            eligible = false;

            state = "error";

            title =
                "Age requirement not met";

            message =
                "Donor registration is available from 18 to 65 years.";

        }

        /*
         * ------------------------------------------------------
         * PHONE
         * ------------------------------------------------------
         */

        else if (!/^\d{10}$/.test(phone)) {

            eligible = false;

            state = "error";

            title =
                "Check your phone number";

            message =
                "Enter a valid 10-digit phone number.";

        }

        /*
         * ------------------------------------------------------
         * LOCATION
         * ------------------------------------------------------
         */

        else if (location.length < 2) {

            eligible = false;

            state = "error";

            title =
                "Location is required";

            message =
                "Enter the city or location where you can donate.";

        }

        /*
         * ------------------------------------------------------
         * LAST DONATION
         * ------------------------------------------------------
         */

        else {

            eligible = true;

            state = "success";

            title =
                "You appear eligible to register";

            message =
                "Your details meet the basic donor requirements.";

            if (lastDonationValue) {

                const lastDonation =
                    new Date(
                        `${lastDonationValue}T00:00:00`
                    );

                if (
                    Number.isNaN(
                        lastDonation.getTime()
                    )
                ) {

                    eligible = false;

                    state = "error";

                    title =
                        "Invalid donation date";

                    message =
                        "Please select a valid last donation date.";

                } else {

                    const today = new Date();

                    today.setHours(
                        0,
                        0,
                        0,
                        0
                    );

                    const donationDay =
                        new Date(lastDonation);

                    donationDay.setHours(
                        0,
                        0,
                        0,
                        0
                    );

                    const days =
                        Math.floor(
                            (
                                today.getTime() -
                                donationDay.getTime()
                            ) /
                            86400000
                        );

                    /*
                     * Future date
                     */

                    if (days < 0) {

                        eligible = false;

                        state = "error";

                        title =
                            "Invalid donation date";

                        message =
                            "Last donation date cannot be in the future.";

                    }

                    /*
                     * Less than 90 days
                     */

                    else if (days < 90) {

                        eligible = false;

                        state = "error";

                        const remaining =
                            90 - days;

                        title =
                            "90-day waiting period";

                        message =
                            `Please wait ${remaining} more day${
                                remaining === 1
                                    ? ""
                                    : "s"
                            } before donating again.`;

                    }

                    /*
                     * 90+ days
                     */

                    else {

                        eligible = true;

                        state = "success";

                        title =
                            "You appear eligible to register";

                        message =
                            "The 90-day waiting period has been completed.";
                    }
                }
            }
        }
    }

    /*
     * ----------------------------------------------------------
     * UPDATE UI
     * ----------------------------------------------------------
     */

    box.className =
        `donor-eligibility donor-eligibility-${state}`;

    const icon =
        box.querySelector(
            ".donor-eligibility-icon"
        );

    const heading =
        box.querySelector("strong");

    const text =
        box.querySelector("p");

    if (icon) {

        if (state === "success") {

            icon.textContent = "\u2713";

        } else if (state === "error") {

            icon.textContent = "!";

        } else {

            icon.textContent = "i";
        }
    }

    if (heading) {

        heading.textContent =
            title;
    }

    if (text) {

        text.textContent =
            message;
    }

    /*
     * ----------------------------------------------------------
     * REGISTER BUTTON
     * ----------------------------------------------------------
     *
     * Only enable when all required details are genuinely valid.
     */

    if (button) {

        const isComplete =
            Boolean(
                ageValue &&
                bloodGroup &&
                phone &&
                location
            );

        const currentlyLoading =
            button.classList.contains(
                "is-loading"
            );

        button.disabled =
            !eligible ||
            !isComplete ||
            currentlyLoading;

        button.setAttribute(
            "aria-disabled",
            String(button.disabled)
        );
    }

    return eligible;
}

function bindClientDonorForm() {
    const form = $("#clientDonorForm");

    if (!form || form.dataset.bound === "true") {
        return;
    }

    form.dataset.bound = "true";

    const age = $("#donorAge");
    const bloodGroup = $("#donorBloodGroup");
    const phone = $("#donorPhone");
    const location = $("#donorLocation");
    const lastDonation = $("#donorLastDonation");
    /*
     * Never allow a future last-donation date.
     */
    if (lastDonation) {

        const today =
            new Date();

        const year =
            today.getFullYear();

        const month =
            String(
                today.getMonth() + 1
            ).padStart(2, "0");

        const day =
            String(
                today.getDate()
            ).padStart(2, "0");

        lastDonation.max =
            `${year}-${month}-${day}`;
    }
    const button = $("#registerDonorButton");

    const refreshEligibility = () => {
        calculateDonorEligibility();
    };

    age?.addEventListener("input", refreshEligibility);
    bloodGroup?.addEventListener("change", refreshEligibility);
    phone?.addEventListener("input", () => {
        phone.value =
            phone.value.replace(/\D/g, "").slice(0, 10);
    });
    location?.addEventListener("input", () => {
        location.value =
            location.value.slice(0, 120);
    });
    lastDonation?.addEventListener(
        "change",
        refreshEligibility
    );

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        setDonorMessage("");

        const numericAge =
            Number(age?.value || 0);

        const selectedBloodGroup =
            String(bloodGroup?.value || "").trim();

        const safePhone =
            String(phone?.value || "")
                .replace(/\D/g, "")
                .slice(0, 10);

        const safeLocation =
            String(location?.value || "").trim();

        const lastDonationDate =
            String(lastDonation?.value || "").trim();

        if (
            !numericAge ||
            !selectedBloodGroup ||
            !safePhone ||
            !safeLocation
        ) {
            setDonorMessage(
                "Please complete all required donor details.",
                "error"
            );
            return;
        }

        if (
            numericAge < 18 ||
            numericAge > 65
        ) {
            setDonorMessage(
                "Donor registration is available from 18 to 65 years.",
                "error"
            );
            calculateDonorEligibility();
            return;
        }

        if (!/^\d{10}$/.test(safePhone)) {
            setDonorMessage(
                "Please enter a valid 10-digit phone number.",
                "error"
            );
            return;
        }

        if (!calculateDonorEligibility()) {
            setDonorMessage(
                "Please resolve the eligibility issue before registering.",
                "error"
            );
            return;
        }

        if (button) {
            button.disabled = true;
            button.classList.add("is-loading");

            const label = button.querySelector("span");

            if (label) {
                label.textContent =
                    "Registering\u2026";
            }
        }

        try {
            const result =
                await window.jharjeevanApi("/api/client/donor",
                    {
                        method: "POST",
                        body: {
                            age: numericAge,
                            bloodGroup:
                                selectedBloodGroup,
                            phone: safePhone,
                            location: safeLocation,
                            lastDonationDate:
                                lastDonationDate || null,
                        },
                    }
                );

            if (!result?.success) {
                throw new Error(
                    result?.message ||
                    "Unable to register as a donor."
                );
            }

            clientDonorProfile =
                result.donor || null;

            if (!clientDonorProfile) {

                throw new Error(
                    "Registration succeeded but the donor profile was not returned."
                );
            }

            setDonorMessage(
                "Donor registration completed successfully.",
                "success"
            );

            renderRegisteredDonor(
                clientDonorProfile
            );

        } catch (error) {

            /*
             * 409 is an expected business state here:
             * the donor already exists.
             *
             * Do NOT show an error.
             * Load the existing donor profile and render
             * the registered state instead.
             */

            if (error?.status === 409) {

                try {

                    const existingResult =
                        await window.jharjeevanApi(
                            "/api/client/donor"
                        );

                    const existingDonor =
                        existingResult?.donor || null;

                    if (existingDonor) {

                        clientDonorProfile =
                            existingDonor;

                        renderRegisteredDonor(
                            existingDonor
                        );

                        console.info(
                            "[JHARJEEVAN] Donor already registered. Existing profile loaded."
                        );

                    } else {

                        setDonorMessage(
                            "Your donor profile is already registered.",
                            "success"
                        );

                    }

                } catch (profileError) {

                    console.error(
                        "[JHARJEEVAN] Unable to load existing donor profile:",
                        profileError
                    );

                    setDonorMessage(
                        "Your donor profile is already registered. Refresh the page to view it.",
                        "success"
                    );

                }

            } else {

                console.error(
                    "Client donor registration failed:",
                    error
                );

                setDonorMessage(
                    error?.message ||
                    "Unable to complete donor registration. Please try again.",
                    "error"
                );

            }

        } finally {

            if (button) {
                button.disabled = false;
                button.classList.remove(
                    "is-loading"
                );

                const label =
                    button.querySelector("span");

                if (label) {
                    label.textContent =
                        "Register as Donor";
                }
            }
        }
    });
}

function renderRegisteredDonor(donor) {

    if (!donor) {

        setDonorState("form");

        return;

    }

    setDonorState("registered");

    const name =
        $("#donorRegisteredName");

    const message =
        $("#donorRegisteredMessage");

    const blood =
        $("#donorRegisteredBlood");

    const location =
        $("#donorRegisteredLocation");

    /*
     * ----------------------------------------------------------
     * NORMALIZE DONOR DATA
     *
     * Support both snake_case and camelCase responses.
     * Also fall back to the authenticated client profile when
     * the donor record does not contain blood_group directly.
     * ----------------------------------------------------------
     */

    const donorName =
        String(
            donor.name ||
            clientDonorClient?.name ||
            "You"
        ).trim();

    const donorBloodGroup =
        String(
            donor.blood_group ||
            donor.bloodGroup ||
            donor.client_blood_group ||
            donor.clientBloodGroup ||
            clientDonorClient?.blood_group ||
            clientDonorClient?.bloodGroup ||
            ""
        )
        .trim()
        .toUpperCase();

    const donorLocation =
        String(
            donor.location ||
            clientDonorClient?.location ||
            ""
        ).trim();

    /*
     * ----------------------------------------------------------
     * NAME
     * ----------------------------------------------------------
     */

    if (name) {

        name.textContent =
            `${donorName} is registered as a donor`;

    }

    /*
     * ----------------------------------------------------------
     * DESCRIPTION
     * ----------------------------------------------------------
     */

    if (message) {

        message.textContent =
            "Your donor profile is active and available to help patients.";

    }

    /*
     * ----------------------------------------------------------
     * BLOOD GROUP
     * ----------------------------------------------------------
     */

    if (blood) {

        blood.textContent =
            donorBloodGroup || "Not provided";

        blood.setAttribute(
            "aria-label",
            donorBloodGroup
                ? `Blood group ${donorBloodGroup}`
                : "Blood group not provided"
        );

    }

    /*
     * ----------------------------------------------------------
     * LOCATION
     * ----------------------------------------------------------
     */

    if (location) {

        location.textContent =
            donorLocation || "Not provided";

    }

    /*
     * ----------------------------------------------------------
     * DEBUG ONLY
     * ----------------------------------------------------------
     */

    console.info(
        "[JHARJEEVAN] Registered donor rendered:",
        {
            id: donor.id || null,
            name: donorName,
            bloodGroup: donorBloodGroup || null,
            location: donorLocation || null,
            isAvailable:
                donor.is_available ??
                donor.isAvailable ??
                null
        }
    );

}

function populateDonorClient(client) {
    if (!client) {
        return;
    }

    const name =
        String(client.name || "").trim();

    const email =
        String(client.email || "").trim();

    const initial =
        name.charAt(0).toUpperCase() ||
        "S";

    const initialElement =
        $("#donorAccountInitial");

    const nameElement =
        $("#donorAccountName");

    const emailElement =
        $("#donorAccountEmail");

    const phone =
        $("#donorPhone");

    const bloodGroup =
        $("#donorBloodGroup");

    const location =
        $("#donorLocation");

    if (initialElement) {
        initialElement.textContent =
            initial;
    }

    if (nameElement) {
        nameElement.textContent =
            name || "Client";
    }

    if (emailElement) {
        emailElement.textContent =
            email || "Signed-in account";
    }

    if (phone && !phone.value) {
        phone.value =
            String(client.phone || "")
                .replace(/\D/g, "")
                .slice(0, 10);
    }

    if (bloodGroup &&
        !bloodGroup.value &&
        client.blood_group
    ) {
        bloodGroup.value =
            client.blood_group;
    }

    if (location && !location.value) {
        location.value =
            String(client.location || "");
    }

    calculateDonorEligibility();
}

async function loadClientDonor() {
    setDonorState("loading");

    try {

        const result =
            await api(
                "/api/client/donor"
            );

        if (!result?.success) {
            throw new Error(
                result?.message ||
                "Unable to load donor profile."
            );
        }

        clientDonorClient =
            result.client || null;

        clientDonorProfile =
            result.donor || null;

        if (clientDonorProfile) {

            renderRegisteredDonor(
                clientDonorProfile
            );

            return;
        }

        setDonorState("form");

        populateDonorClient(
            clientDonorClient
        );

        bindClientDonorForm();

    } catch (error) {

        console.error(
            "Client donor profile loading failed:",
            error
        );

        setDonorState("form");

        setDonorMessage(
            error?.message ||
            "Unable to load your donor profile.",
            "error"
        );

        bindClientDonorForm();
    }
}
/* ============================================================
   LIVE CLIENT NOTIFICATIONS
   ============================================================ */

async function loadClientNotifications() {

    const section =
        document.querySelector("#notifications");

    if (!section) return;

    try {

        const result =
            await api(
                "/api/client/notifications"
            );

        if (!result.success) {
            throw new Error(
                "Unable to load notifications."
            );
        }

        clientNotifications =
            Array.isArray(result.notifications)
                ? result.notifications
                : [];

        renderClientNotifications(
            clientNotifications
        );

        syncOverviewLiveStats();

    } catch (error) {

        console.error(
            "Notification loading failed:",
            error
        );
    }
}

function getNotificationIcon(type) {

    const normalized =
        String(type || "default")
            .toLowerCase();

    const icon = (
        path
    ) => `
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            ${path}
        </svg>
    `;

    if (
        normalized.includes("blood")
    ) {

        return icon(`
            <path
                d="M12 3.5C12 3.5 6.5 10.1 6.5 14.5C6.5 17.54 8.96 20 12 20C15.04 20 17.5 17.54 17.5 14.5C17.5 10.1 12 3.5 12 3.5Z"
                stroke="currentColor"
                stroke-width="1.8"
            />
        `);
    }

    if (
        normalized.includes("request")
    ) {

        return icon(`
            <path
                d="M7 4.5H17C18.1 4.5 19 5.4 19 6.5V19.5H5V6.5C5 5.4 5.9 4.5 7 4.5Z"
                stroke="currentColor"
                stroke-width="1.7"
            />
            <path
                d="M8.5 9H15.5M8.5 12.5H15.5M8.5 16H13"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
            />
        `);
    }

    if (
        normalized.includes("approved") ||
        normalized.includes("success")
    ) {

        return icon(`
            <path
                d="M20 6L9 17L4 12"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        `);
    }

    if (
        normalized.includes("password") ||
        normalized.includes("security")
    ) {

        return icon(`
            <rect
                x="5"
                y="10"
                width="14"
                height="10"
                rx="2"
                stroke="currentColor"
                stroke-width="1.7"
            />
            <path
                d="M8 10V7.5C8 5.29 9.79 3.5 12 3.5C14.21 3.5 16 5.29 16 7.5V10"
                stroke="currentColor"
                stroke-width="1.7"
            />
        `);
    }

    if (
        normalized.includes("search")
    ) {

        return icon(`
            <circle
                cx="10.8"
                cy="10.8"
                r="5.8"
                stroke="currentColor"
                stroke-width="1.8"
            />
            <path
                d="M15.2 15.2L20 20"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
            />
        `);
    }

    return icon(`
        <path
            d="M18 9.5C18 6.19 15.31 3.5 12 3.5C8.69 3.5 6 6.19 6 9.5V13L4.5 16H19.5L18 13V9.5Z"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linejoin="round"
        />
        <path
            d="M9.5 19C10.1 19.9 10.9 20.5 12 20.5C13.1 20.5 13.9 19.9 14.5 19"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
        />
    `);
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
   CUSTOM BLOOD GROUP DROPDOWN - JS
   ============================================================ */

(function setupCustomBloodGroupDropdown() {

    function init() {

        const select =
            document.querySelector("#bloodGroupFilter");

        if (!select) {
            return;
        }

        if (
            document.querySelector(
                ".find-blood-custom-select"
            )
        ) {
            return;
        }

        const wrapper =
            document.createElement("div");

        wrapper.className =
            "find-blood-custom-select";

        const trigger =
            document.createElement("button");

        trigger.type = "button";
        trigger.className =
            "find-blood-custom-trigger";

        trigger.setAttribute(
            "aria-haspopup",
            "listbox"
        );

        trigger.setAttribute(
            "aria-expanded",
            "false"
        );

        const label =
            document.createElement("span");

        label.className =
            "find-blood-custom-label";

        const arrow =
            document.createElement("span");

        arrow.className =
            "find-blood-custom-arrow";

        arrow.setAttribute(
            "aria-hidden",
            "true"
        );

        trigger.appendChild(label);
        trigger.appendChild(arrow);

        const options =
            document.createElement("div");

        options.className =
            "find-blood-custom-options";

        options.setAttribute(
            "role",
            "listbox"
        );

        Array.from(select.options).forEach(
            (option) => {

                const item =
                    document.createElement("div");

                item.className =
                    "find-blood-custom-option";

                item.dataset.value =
                    option.value;

                item.textContent =
                    option.textContent;

                item.setAttribute(
                    "role",
                    "option"
                );

                item.addEventListener(
                    "click",
                    () => {

                        select.value =
                            option.value;

                        label.textContent =
                            option.textContent;

                        options
                            .querySelectorAll(
                                ".find-blood-custom-option"
                            )
                            .forEach((entry) => {

                                entry.classList.toggle(
                                    "selected",
                                    entry.dataset.value ===
                                        option.value
                                );

                            });

                        select.dispatchEvent(
                            new Event(
                                "change",
                                {
                                    bubbles: true
                                }
                            )
                        );

                        close();
                    }
                );

                options.appendChild(item);
            }
        );

        wrapper.appendChild(trigger);
        wrapper.appendChild(options);

        select.parentNode.insertBefore(
            wrapper,
            select
        );

        wrapper.appendChild(select);

        select.classList.add(
            "find-blood-native-hidden"
        );

        function open() {

            wrapper.classList.add("open");

            trigger.setAttribute(
                "aria-expanded",
                "true"
            );
        }

        function close() {

            wrapper.classList.remove("open");

            trigger.setAttribute(
                "aria-expanded",
                "false"
            );
        }

        trigger.addEventListener(
            "click",
            (event) => {

                event.preventDefault();
                event.stopPropagation();

                if (
                    wrapper.classList.contains(
                        "open"
                    )
                ) {
                    close();
                } else {
                    open();
                }
            }
        );

        document.addEventListener(
            "click",
            (event) => {

                if (
                    !wrapper.contains(
                        event.target
                    )
                ) {
                    close();
                }
            }
        );

        document.addEventListener(
            "keydown",
            (event) => {

                if (event.key === "Escape") {
                    close();
                }
            }
        );

        select.addEventListener(
            "change",
            () => {

                const selected =
                    select.options[
                        select.selectedIndex
                    ];

                if (selected) {
                    label.textContent =
                        selected.textContent;
                }

                options
                    .querySelectorAll(
                        ".find-blood-custom-option"
                    )
                    .forEach((entry) => {

                        entry.classList.toggle(
                            "selected",
                            entry.dataset.value ===
                                select.value
                        );

                    });
            }
        );

        const initial =
            select.options[
                select.selectedIndex
            ];

        label.textContent =
            initial
                ? initial.textContent
                : "All blood groups";

        options
            .querySelectorAll(
                ".find-blood-custom-option"
            )
            .forEach((entry) => {

                entry.classList.toggle(
                    "selected",
                    entry.dataset.value ===
                        select.value
                );

            });
    }

    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init
        );

    } else {

        init();

    }

})();

/* ============================================================
   JHARJEEVAN LIVE PROFILE CONTROLLER
============================================================ */

(() => {
    "use strict";

    const TOKEN_KEY = "jharjeevan_client_token";
    const CLIENT_KEY = "jharjeevan_client";

    const $ = (selector) => document.querySelector(selector);

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function getStoredClient() {
        try {
            return JSON.parse(
                localStorage.getItem(CLIENT_KEY) || "{}"
            );
        } catch {
            return {};
        }
    }

    function saveClient(client) {
        localStorage.setItem(
            CLIENT_KEY,
            JSON.stringify(client || {})
        );
    }

    const api = window.api;

        function escapeText(value) {
        return String(value ?? "");
    }

    /*
     * ---------------------------------------------------------
     * PROFILE DATA NORMALIZER
     * ---------------------------------------------------------
     *
     * Keeps the frontend profile contract consistent with
     * backend/database naming.
     */

    function normalizeClientProfile(client) {

        const source = client || {};

        return {
            ...source,

            id:
                source.id ?? null,

            name:
                String(
                    source.name ?? ""
                ).trim(),

            email:
                String(
                    source.email ?? ""
                ).trim(),

            phone:
                String(
                    source.phone ?? ""
                ).trim(),

            bloodGroup:
                String(
                    source.bloodGroup ??
                    source.blood_group ??
                    ""
                )
                    .trim()
                    .toUpperCase(),

            location:
                String(
                    source.location ?? ""
                ).trim(),

            isActive:
                source.isActive ??
                source.is_active ??
                true,

            lastLoginAt:
                source.lastLoginAt ??
                source.last_login_at ??
                null,

            createdAt:
                source.createdAt ??
                source.created_at ??
                null,

            updatedAt:
                source.updatedAt ??
                source.updated_at ??
                null
        };
    }
    function getBloodGroup(client) {
        return (
            client?.bloodGroup ??
            client?.blood_group ??
            ""
        );
    }

    function formatDate(value) {

        if (!value) {
            return "Not available";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Not available";
        }

        return new Intl.DateTimeFormat(
            undefined,
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        ).format(date);
    }

    function normalizeProfileValue(value) {
        return String(value ?? "").trim();
    }

    function calculateCompletion(client) {

        const fields = {
            name: normalizeProfileValue(client?.name),
            email: normalizeProfileValue(client?.email),
            phone: normalizeProfileValue(client?.phone),
            bloodGroup: normalizeProfileValue(getBloodGroup(client)),
            location: normalizeProfileValue(client?.location)
        };

        const total = Object.keys(fields).length;

        const completed = Object.values(fields).filter(
            value => value.length > 0
        ).length;

        const percent = total > 0
            ? Math.round((completed / total) * 100)
            : 0;

        return {
            completed,
            total,
            percent,
            complete: completed === total
        };
    }

    function updateCompletion(client) {

        const result = calculateCompletion(client);

        const value = $("#jjProfileCompletionValue");
        const bar = $("#jjProfileCompletionBar");
        const text = $("#jjProfileCompletionText");
        const completionCard = document.querySelector(
            ".jj-live-completion-card"
        );

        if (value) {
            value.textContent = `${result.percent}%`;

            value.classList.toggle(
                "is-complete",
                result.complete
            );
        }

        if (bar) {

            requestAnimationFrame(() => {

                bar.style.width = `${result.percent}%`;

                bar.classList.toggle(
                    "is-complete",
                    result.complete
                );
            });
        }

        if (text) {

            if (result.complete) {

                text.textContent =
                    "Your profile is complete and ready.";

                text.classList.add("is-complete");

            } else {

                text.textContent =
                    `${result.completed} of ${result.total} profile details completed.`;

                text.classList.remove("is-complete");
            }
        }

        if (completionCard) {

            completionCard.classList.toggle(
                "is-complete",
                result.complete
            );

            completionCard.setAttribute(
                "data-completion",
                String(result.percent)
            );
        }

        /*
         * Keep the profile CTA truthful.
         * At 100% there is nothing left to complete.
         */
        const completionAction = document.querySelector(
            "#jjProfileCompletionAction"
        );

        if (completionAction) {

            if (result.complete) {

                completionAction.textContent =
                    "Profile complete \u2713";

                completionAction.classList.add("is-complete");
                completionAction.removeAttribute("href");
                completionAction.setAttribute(
                    "aria-disabled",
                    "true"
                );

            } else {

                completionAction.textContent =
                    "Complete your profile \u2192";

                completionAction.classList.remove("is-complete");
                completionAction.removeAttribute("aria-disabled");
            }
        }
    }

    function updateProfileUI(client) {

        if (!client) {
            return;
        }

        const name =
            String(client.name || "Client").trim();

        const email =
            String(client.email || "No email").trim();

        const phone =
            client.phone || "Not provided";

        const bloodGroup =
            getBloodGroup(client) || "Not provided";

        const location =
            client.location || "Not provided";

        const initial =
            name.charAt(0).toUpperCase() || "C";

        const displayName =
            $("#jjProfileDisplayName");

        const displayEmail =
            $("#jjProfileDisplayEmail");

        const avatar =
            $("#jjProfileAvatarLetter");

        const detailName =
            $("#profileDetailName");

        const detailEmail =
            $("#profileDetailEmail");

        const detailPhone =
            $("#profileDetailPhone");

        const detailBlood =
            $("#profileDetailBlood");

        const detailLocation =
            $("#profileDetailLocation");

        if (displayName) {
            displayName.textContent = name;
        }

        if (displayEmail) {
            displayEmail.textContent = email;
        }

        if (avatar) {
            avatar.textContent = initial;
        }

        if (detailName) {
            detailName.textContent = name;
        }

        if (detailEmail) {
            detailEmail.textContent = email;
        }

        if (detailPhone) {
            detailPhone.textContent = phone;
        }

        if (detailBlood) {
            detailBlood.textContent = bloodGroup;
        }

        if (detailLocation) {
            detailLocation.textContent = location;
        }

        const status =
            $("#jjProfileAccountStatus");

        if (status) {

            status.innerHTML =
                `<span class="jj-live-status-pulse"></span>` +
                (client.isActive === false
                    ? "Inactive"
                    : "Active");

            status.classList.toggle(
                "is-inactive",
                client.isActive === false
            );
        }

        const dot =
            $("#jjProfileStatusDot");

        if (dot) {
            dot.classList.toggle(
                "is-inactive",
                client.isActive === false
            );
        }

        const created =
            $("#jjProfileCreatedAt");

        if (created) {
            created.textContent =
                formatDate(client.createdAt);
        }

        const lastLogin =
            $("#jjProfileLastLogin");

        if (lastLogin) {
            lastLogin.textContent =
                formatDate(client.lastLoginAt);
        }

        const securityEmail =
            $("#jjProfileSecurityEmail");

        if (securityEmail) {
            securityEmail.textContent =
                email;
        }

        const updated =
            $("#jjProfileLastUpdated");

        if (updated) {
            updated.textContent =
                client.updatedAt
                    ? `Updated ${formatDate(client.updatedAt)}`
                    : "Live profile";
        }

        updateCompletion(client);
    }

    async function refreshProfile() {

        const token = getToken();

        if (!token) {
            return;
        }

        const sync =
            $("#jjProfileSyncStatus");

        if (sync) {
            sync.textContent =
                "Synchronizing with JharJeevan...";
        }

        try {

            const result =
                await api(
                    "/api/client/profile"
                );

            if (
                !result.success ||
                !result.client
            ) {
                throw new Error(
                    result.message ||
                    "Unable to load profile."
                );
            }

            /*
             * /api/client/profile is the authoritative
             * profile source.
             */
            const serverClient =
                normalizeClientProfile(
                    result.client
                );

            saveClient(
                serverClient
            );

            updateProfileUI(
                serverClient
            );

            if (sync) {
                sync.textContent =
                    "Connected to JharJeevan";
            }

        } catch (error) {

            if (sync) {
                sync.textContent =
                    "Unable to synchronize right now";
            }

            if (error.status === 401) {

                localStorage.removeItem(
                    TOKEN_KEY
                );

                localStorage.removeItem(
                    CLIENT_KEY
                );

                window.location.href =
                    "client-login.html";
            }
        }
    }

    function openModal(modal) {

        if (!modal) return;

        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");

        document.body.classList.add(
            "jj-live-modal-open"
        );

        const firstInput =
            modal.querySelector(
                "input:not([readonly]), select"
            );

        setTimeout(() => {
            firstInput?.focus();
        }, 80);
    }

    function closeModal(modal) {

        if (!modal) return;

        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");

        if (
            !document.querySelector(
                ".jj-live-modal.is-open"
            )
        ) {
            document.body.classList.remove(
                "jj-live-modal-open"
            );
        }
    }

    function closeAllModals() {

        document
            .querySelectorAll(".jj-live-modal")
            .forEach(closeModal);
    }

    function showMessage(element, message, type) {

        if (!element) return;

        element.textContent = message || "";

        element.className =
            `jj-live-form-message ${type || ""}`.trim();
    }

    function setButtonLoading(button, loading) {

        if (!button) return;

        button.disabled = loading;
        button.classList.toggle(
            "is-loading",
            loading
        );

        if (loading) {

            if (!button.dataset.originalText) {
                button.dataset.originalText =
                    button.textContent.trim();
            }

            button.innerHTML =
                `<span class="jj-live-spinner"></span> Saving...`;

        } else {

            button.textContent =
                button.dataset.originalText ||
                "Save Changes";
        }
    }

    function fillEditForm(client) {

        $("#jjEditName").value =
            client.name || "";

        $("#jjEditEmail").value =
            client.email || "";

        $("#jjEditPhone").value =
            client.phone || "";

        $("#jjEditBloodGroup").value =
            getBloodGroup(client);

        $("#jjEditLocation").value =
            client.location || "";
    }

    async function handleProfileSave(event) {

        event.preventDefault();

        const form =
            $("#jjEditProfileForm");

        const button =
            $("#jjSaveProfileButton");

        const message =
            $("#jjEditProfileMessage");

        const name =
            $("#jjEditName")?.value.trim();

        const phone =
            $("#jjEditPhone")?.value.trim();

        const bloodGroup =
            $("#jjEditBloodGroup")?.value || "";

        const location =
            $("#jjEditLocation")?.value.trim();

        showMessage(message, "");

        if (!name || name.length < 2) {

            showMessage(
                message,
                "Please enter your full name.",
                "error"
            );

            return;
        }

        if (
            phone &&
            !/^\d{10}$/.test(phone)
        ) {

            showMessage(
                message,
                "Phone number must contain exactly 10 digits.",
                "error"
            );

            return;
        }

        setButtonLoading(button, true);

        try {

            const result =
                await api(
                    "/api/client/profile",
                    {
                        method: "PUT",
                        body: JSON.stringify({
                            name,
                            phone,
                            bloodGroup,
                            location
                        })
                    }
                );

            if (
                !result.success ||
                !result.client
            ) {
                throw new Error(
                    result.message ||
                    "Profile update failed."
                );
            }

            saveClient(result.client);

            updateProfileUI(
                result.client
            );

            showMessage(
                message,
                "Profile updated successfully.",
                "success"
            );

            setTimeout(() => {

                closeModal(
                    $("#jjEditProfileModal")
                );

            }, 700);

        } catch (error) {

            showMessage(
                message,
                error.message ||
                "Unable to update your profile.",
                "error"
            );

        } finally {

            setButtonLoading(
                button,
                false
            );
        }
    }

    function updatePasswordRules(value) {

        const checks = {
            "#jjPasswordLength":
                value.length >= 8 &&
                value.length <= 128,

            "#jjPasswordUpper":
                /[A-Z]/.test(value),

            "#jjPasswordNumber":
                /[0-9]/.test(value),

            "#jjPasswordSpecial":
                /[^A-Za-z0-9]/.test(value)
        };

        Object.entries(checks)
            .forEach(([selector, valid]) => {

                const element =
                    $(selector);

                if (!element) return;

                const text =
                    element.textContent
                        .replace(/^./, "");

                element.textContent =
                    `${valid ? "\u2713" : "\u25CB"}${text}`;

                element.classList.toggle(
                    "is-valid",
                    valid
                );
            });
    }

    async function handlePasswordChange(event) {

        event.preventDefault();

        const currentPassword =
            $("#jjCurrentPassword")?.value || "";

        const newPassword =
            $("#jjNewPassword")?.value || "";

        const confirmPassword =
            $("#jjConfirmPassword")?.value || "";

        const button =
            $("#jjSavePasswordButton");

        const message =
            $("#jjPasswordMessage");

        showMessage(message, "");

        if (!currentPassword) {

            showMessage(
                message,
                "Enter your current password.",
                "error"
            );

            return;
        }

        const strong =
            newPassword.length >= 8 &&
            newPassword.length <= 128 &&
            /[A-Z]/.test(newPassword) &&
            /[0-9]/.test(newPassword) &&
            /[^A-Za-z0-9]/.test(newPassword);

        if (!strong) {

            showMessage(
                message,
                "Your new password does not meet the security requirements.",
                "error"
            );

            return;
        }

        if (newPassword !== confirmPassword) {

            showMessage(
                message,
                "New passwords do not match.",
                "error"
            );

            return;
        }

        if (newPassword === currentPassword) {

            showMessage(
                message,
                "New password must be different from the current password.",
                "error"
            );

            return;
        }

        setButtonLoading(button, true);

        try {

            const result =
                await api(
                    "/api/client/change-password",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            currentPassword,
                            newPassword
                        })
                    }
                );

            if (!result.success) {
                throw new Error(
                    result.message ||
                    "Password change failed."
                );
            }

            showMessage(
                message,
                "Password changed successfully.",
                "success"
            );

            $("#jjChangePasswordForm")?.reset();

            setTimeout(() => {

                closeModal(
                    $("#jjPasswordModal")
                );

            }, 900);

        } catch (error) {

            showMessage(
                message,
                error.message ||
                "Unable to change your password.",
                "error"
            );

        } finally {

            setButtonLoading(
                button,
                false
            );
        }
    }

    function logout() {

        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(CLIENT_KEY);

        window.location.href =
            "client-login.html";
    }

    function bindProfile() {

        const editButton =
            $("#jjEditProfileButton");

        const passwordButton =
            $("#jjChangePasswordButton");

        const editModal =
            $("#jjEditProfileModal");

        const passwordModal =
            $("#jjPasswordModal");

        const editForm =
            $("#jjEditProfileForm");

        const passwordForm =
            $("#jjChangePasswordForm");

        const logoutButton =
            $("#jjProfileLogoutButton");

        editButton?.addEventListener(
            "click",
            () => {

                fillEditForm(
                    getStoredClient()
                );

                showMessage(
                    $("#jjEditProfileMessage"),
                    ""
                );

                openModal(editModal);
            }
        );

        passwordButton?.addEventListener(
            "click",
            () => {

                passwordForm?.reset();

                showMessage(
                    $("#jjPasswordMessage"),
                    ""
                );

                updatePasswordRules("");

                openModal(passwordModal);
            }
        );

        editForm?.addEventListener(
            "submit",
            handleProfileSave
        );

        passwordForm?.addEventListener(
            "submit",
            handlePasswordChange
        );

        $("#jjNewPassword")
            ?.addEventListener(
                "input",
                event => {
                    updatePasswordRules(
                        event.target.value
                    );
                }
            );

        logoutButton?.addEventListener(
            "click",
            () => {

                const confirmed =
                    window.confirm(
                        "Are you sure you want to sign out?"
                    );

                if (confirmed) {
                    logout();
                }
            }
        );

        document
            .querySelectorAll(
                "[data-close-profile-modal]"
            )
            .forEach(element => {

                element.addEventListener(
                    "click",
                    () => closeModal(editModal)
                );
            });

        document
            .querySelectorAll(
                "[data-close-password-modal]"
            )
            .forEach(element => {

                element.addEventListener(
                    "click",
                    () => closeModal(passwordModal)
                );
            });

        document.addEventListener(
            "keydown",
            event => {

                if (event.key === "Escape") {
                    closeAllModals();
                }
            }
        );

        /*
         * Do not paint stale cached profile data here.
         * refreshProfile() is the authoritative loader.
         */
        void refreshProfile();
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            bindProfile,
            { once: true }
        );
    } else {
        bindProfile();
    }

})();






/* ============================================================
   JHARJEEVAN PROFILE \u2014 FINAL UX POLISH
   ============================================================ */

(function () {
    "use strict";

    function initFinalProfilePolish() {
        const profile = document.getElementById("profile");

        if (!profile || profile.dataset.finalPolishReady === "1") {
            return;
        }

        profile.dataset.finalPolishReady = "1";

        /*
         * -------------------------------------------------------
         * PRIMARY / SECONDARY BUTTON SEMANTICS
         * -------------------------------------------------------
         */

        const controls = profile.querySelectorAll("button, a");

        controls.forEach((element) => {
            const label = (element.textContent || "").trim().toLowerCase();

            if (label.includes("edit profile")) {
                element.classList.add("jj-profile-primary-action");
                element.setAttribute("aria-label", "Edit your profile");
            }

            if (label.includes("change password")) {
                element.classList.add("jj-profile-secondary-action");
                element.setAttribute("aria-label", "Change your password");
            }

            if (label.includes("sign out of this device")) {
                element.classList.add("jj-profile-danger-action");
                element.setAttribute("aria-label", "Sign out of this device");
            }
        });

        /*
         * -------------------------------------------------------
         * COMPLETION CTA
         * -------------------------------------------------------
         */

        const completionText =
            document.getElementById("jjProfileCompletionText");

        if (completionText) {
            const completionContainer =
                completionText.closest(".jj-profile-completion") ||
                completionText.parentElement?.parentElement;

            if (
                completionContainer &&
                !completionContainer.querySelector(
                    ".jj-profile-completion-cta"
                )
            ) {
                const completionButton =
                    document.createElement("button");

                completionButton.type = "button";
                completionButton.className =
                    "jj-profile-completion-cta";

                completionButton.textContent =
                    "Complete your profile";

                completionButton.addEventListener("click", function () {
                    const editButton = Array.from(
                        profile.querySelectorAll("button, a")
                    ).find((element) =>
                        (element.textContent || "")
                            .trim()
                            .toLowerCase()
                            .includes("edit profile")
                    );

                    if (editButton) {
                        editButton.click();
                    }
                });

                completionContainer.appendChild(completionButton);
            }
        }

        /*
         * -------------------------------------------------------
         * TIMELINE CARD ENHANCEMENT
         * -------------------------------------------------------
         */

        const timelineKeywords = [
            "account created",
            "last successful login",
            "profile synchronization"
        ];

        profile.querySelectorAll("*").forEach((element) => {
            if (
                element.children.length === 0 &&
                element.textContent
            ) {
                const text =
                    element.textContent.trim().toLowerCase();

                if (
                    timelineKeywords.some((keyword) =>
                        text.includes(keyword)
                    )
                ) {
                    const candidate =
                        element.closest(
                            ".jj-profile-event-card, .jj-account-timeline > *, .jj-profile-timeline > *"
                        );

                    if (candidate) {
                        candidate.classList.add(
                            "jj-profile-event-card"
                        );
                    }
                }
            }
        });

        /*
         * -------------------------------------------------------
         * SECURITY ITEMS
         * -------------------------------------------------------
         */

        profile.querySelectorAll("*").forEach((element) => {
            if (
                element.children.length === 0 &&
                element.textContent
            ) {
                const text =
                    element.textContent.trim().toLowerCase();

                if (
                    text === "account protection" ||
                    text === "password protection" ||
                    text === "email verification"
                ) {
                    const item =
                        element.closest(
                            ".jj-profile-security-item"
                        ) ||
                        element.parentElement;

                    if (item) {
                        item.classList.add(
                            "jj-profile-security-item"
                        );
                    }
                }
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initFinalProfilePolish,
            { once: true }
        );
    } else {
        initFinalProfilePolish();
    }
})();











/* ============================================================
   JHARJEEVAN AI ASSISTANT \u2014 FUNCTIONAL CHAT ENGINE
   Connects to existing /api/ai/chat backend.
   ============================================================ */

(() => {
    "use strict";

    const AI_MAX_LENGTH = 500;
    const AI_HISTORY_KEY = "jharjeevan_ai_chat";

    const ai = {
        form: null,
        input: null,
        messages: null,
        typing: null,
        send: null,
        clear: null,
        count: null,
        suggestions: [],
        busy: false
    };

    function aiEscape(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function aiFormatAnswer(text) {
        const safe = aiEscape(text);

        return safe
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\n/g, "<br>");
    }

    function aiNow() {
        return new Intl.DateTimeFormat(undefined, {
            hour: "numeric",
            minute: "2-digit"
        }).format(new Date());
    }

    function aiScrollBottom() {
        if (!ai.messages) return;

        requestAnimationFrame(() => {
            ai.messages.scrollTo({
                top: ai.messages.scrollHeight,
                behavior: "smooth"
            });
        });
    }

    function aiSaveHistory() {
        if (!ai.messages) return;

        const items = [];

        ai.messages.querySelectorAll(".ai-message").forEach(message => {
            const role = message.classList.contains("user")
                ? "user"
                : "assistant";

            const bubble = message.querySelector(".ai-bubble");

            if (!bubble) return;

            items.push({
                role,
                text: bubble.textContent.trim()
            });
        });

        try {
            sessionStorage.setItem(
                AI_HISTORY_KEY,
                JSON.stringify(items.slice(-20))
            );
        } catch {
            // Ignore storage failures.
        }
    }

    function aiCreateMessage(role, text, options = {}) {
        if (!ai.messages) return;

        const wrapper = document.createElement("div");
        wrapper.className = `ai-message ${role}`;

        const avatar = document.createElement("div");
        avatar.className = "ai-message-avatar";
        avatar.textContent = role === "user" ? "S" : "\u{1F916}";

        const content = document.createElement("div");
        content.className = "ai-message-content";

        const name = document.createElement("div");
        name.className = "ai-message-name";

        const label = document.createElement("span");
        label.textContent = role === "user"
            ? "You"
            : "JharJeevan AI";

        name.appendChild(label);

        const time = document.createElement("span");
        time.textContent = options.time || aiNow();
        name.appendChild(time);

        const bubble = document.createElement("div");
        bubble.className =
            `ai-bubble ${
                role === "user"
                    ? "ai-bubble-user"
                    : "ai-bubble-assistant"
            }`;

        if (options.error) {
            bubble.classList.add("ai-error-bubble");
        }

        bubble.innerHTML = aiFormatAnswer(text);

        /*
         * Add a compact Copy action to normal AI responses.
         * Error bubbles keep only the Retry action.
         */
        if (
            role === "assistant" &&
            !options.error &&
            text
        ) {

            const actions = document.createElement("div");

            actions.className =
                "ai-message-actions";

            const copyButton =
                document.createElement("button");

            copyButton.type = "button";
            copyButton.className =
                "ai-copy-button";
            copyButton.textContent =
                "Copy";

            copyButton.setAttribute(
                "aria-label",
                "Copy AI response"
            );

            copyButton.addEventListener(
                "click",
                async () => {

                    try {

                        const clone =
                            bubble.cloneNode(true);

                        clone
                            .querySelectorAll(
                                ".ai-message-actions"
                            )
                            .forEach(
                                element =>
                                    element.remove()
                            );

                        const copyText =
                            clone.textContent
                                .replace(/\s+/g, " ")
                                .trim();

                        await navigator.clipboard.writeText(
                            copyText
                        );

                        copyButton.textContent =
                            "Copied \u2713";

                        copyButton.classList.add(
                            "is-copied"
                        );

                        setTimeout(() => {

                            copyButton.textContent =
                                "Copy";

                            copyButton.classList.remove(
                                "is-copied"
                            );

                        }, 1600);

                    } catch (error) {

                        console.error(
                            "Copy failed:",
                            error
                        );

                        copyButton.textContent =
                            "Copy failed";

                        setTimeout(() => {
                            copyButton.textContent =
                                "Copy";
                        }, 1600);
                    }
                }
            );

            actions.appendChild(copyButton);

            bubble.appendChild(actions);
        }

        if (options.retry) {
            const retry = document.createElement("button");

            retry.type = "button";
            retry.className = "ai-retry-button";
            retry.textContent = "Try again";

            retry.addEventListener("click", () => {
                if (options.retryQuestion) {
                    aiSendQuestion(options.retryQuestion);
                }
            });

            bubble.appendChild(retry);
        }

        content.appendChild(name);
        content.appendChild(bubble);

        wrapper.appendChild(avatar);
        wrapper.appendChild(content);

        ai.messages.appendChild(wrapper);

        aiScrollBottom();
        aiSaveHistory();

        return wrapper;
    }

    function aiSetTyping(show) {
        if (!ai.typing) return;

        const shouldShow = Boolean(show);

        ai.typing.hidden = !shouldShow;
        ai.typing.setAttribute(
            "aria-hidden",
            shouldShow ? "false" : "true"
        );

        ai.typing.classList.toggle(
            "is-visible",
            shouldShow
        );

        if (shouldShow) {
            aiScrollBottom();
        }
    }

    function aiSetBusy(value) {
        ai.busy = value;

        const status = document.querySelector("#aiStatusText");

        if (status) {

            status.innerHTML = value
                ? '<span class="ai-live-dot ai-status-thinking-dot"></span> Thinking\u2026'
                : '<span class="ai-live-dot"></span> Ready to help';

            status.classList.toggle(
                "is-thinking",
                value
            );
        }

        if (ai.send) {
            ai.send.disabled = value;

            ai.send.classList.toggle(
                "is-loading",
                value
            );
        }

        if (ai.input) {
            ai.input.disabled = value;
        }

        ai.suggestions.forEach(button => {
            button.disabled = value;
        });
    }

    function aiUpdateCount() {
        if (!ai.input || !ai.count) return;

        const length = ai.input.value.length;

        ai.count.textContent =
            `${length}/${AI_MAX_LENGTH}`;
    }

    function aiAutoResize() {
        if (!ai.input) return;

        ai.input.style.height = "auto";

        ai.input.style.height =
            `${Math.min(ai.input.scrollHeight, 120)}px`;
    }

    function aiRestoreHistory() {
        if (!ai.messages) return;

        let history = [];

        try {
            history = JSON.parse(
                sessionStorage.getItem(AI_HISTORY_KEY) || "[]"
            );
        } catch {
            history = [];
        }

        if (!Array.isArray(history) || !history.length) {
            return;
        }

        history.forEach(item => {
            if (!item || !item.role || !item.text) return;

            aiCreateMessage(
                item.role === "user"
                    ? "user"
                    : "assistant",
                item.text
            );
        });
    }

    async function aiSendQuestion(question) {
        if (ai.busy) return;

        const cleanQuestion =
            String(question || "").trim();

        if (!cleanQuestion) {
            if (ai.input) {
                ai.input.focus();
            }
            return;
        }

        if (cleanQuestion.length > AI_MAX_LENGTH) {
            aiCreateMessage(
                "assistant",
                `Please keep your question under ${AI_MAX_LENGTH} characters.`,
                { error: true }
            );
            return;
        }

        // ----------------------------------------------------
        // Friendly conversational shortcuts
        // ----------------------------------------------------

        const normalizedQuestion =
            cleanQuestion
                .toLowerCase()
                .replace(/[!?.,]+$/g, "")
                .trim();

        const greetings = new Set([
            "hi",
            "hello",
            "hey",
            "hii",
            "hiii",
            "good morning",
            "good afternoon",
            "good evening"
        ]);

        const thanks = new Set([
            "thanks",
            "thank you",
            "thank u",
            "thanks a lot",
            "thankyou"
        ]);

        // Add user's message immediately.
        aiCreateMessage(
            "user",
            cleanQuestion
        );

        if (greetings.has(normalizedQuestion)) {

            aiSetBusy(true);
            aiSetTyping(true);

            setTimeout(() => {

                aiSetTyping(false);

                aiCreateMessage(
                    "assistant",
                    "Hi Sajid! \u{1F44B}`n`n" +
                    "I'm your **JharJeevan AI Assistant**. " +
                    "I can help you with blood donation, blood groups, " +
                    "donor eligibility, blood requests, and the next steps " +
                    "available through JharJeevan.`n`n" +
                    "What would you like to know?"
                );

                aiSetBusy(false);

                if (ai.input) {
                    ai.input.focus();
                }

            }, 450);

            if (ai.input) {
                ai.input.value = "";
                aiUpdateCount();
                aiAutoResize();
            }

            return;
        }

        if (thanks.has(normalizedQuestion)) {

            aiSetBusy(true);
            aiSetTyping(true);

            setTimeout(() => {

                aiSetTyping(false);

                aiCreateMessage(
                    "assistant",
                    "You're very welcome! ❤️<br><br>" +
                    "I'm here whenever you need help with blood " +
                    "donation or blood requests."
                );

                aiSetBusy(false);

                if (ai.input) {
                    ai.input.focus();
                }

            }, 350);

            if (ai.input) {
                ai.input.value = "";
                aiUpdateCount();
                aiAutoResize();
            }

            return;
        }

        // Reset composer.
        if (ai.input) {
            ai.input.value = "";
            aiUpdateCount();
            aiAutoResize();
        }

        aiSetBusy(true);
        aiSetTyping(true);

        let timeoutId = null;

        try {
            /*
             * IMPORTANT:
             * Do NOT use the global dashboard api() helper here.
             *
             * The JharJeevan AI endpoint is a public chatbot endpoint
             * and is served by the same Express application.
             */
            const controller = new AbortController();

            timeoutId = setTimeout(() => {
                controller.abort();
            }, 15000);

            const response = await fetch(
                "/api/ai/chat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },

                    credentials: "same-origin",

                    signal: controller.signal,

                    body: JSON.stringify({
                        question: cleanQuestion
                    })
                }
            );

            const rawText = await response.text();

            let result = null;

            try {
                result = rawText
                    ? JSON.parse(rawText)
                    : null;
            } catch {
                throw new Error(
                    `AI server returned an invalid response (${response.status}).`
                );
            }

            if (!response.ok) {
                throw new Error(
                    result?.message ||
                    `AI request failed (${response.status}).`
                );
            }

            if (!result || result.success !== true) {
                throw new Error(
                    result?.message ||
                    "The AI assistant could not answer right now."
                );
            }

            const answer =
                String(
                    result.answer ||
                    "I couldn't generate a response right now."
                ).trim();

            if (!answer) {
                throw new Error(
                    "The AI assistant returned an empty response."
                );
            }

            clearTimeout(timeoutId);
            timeoutId = null;

            aiSetTyping(false);

            aiCreateMessage(
                "assistant",
                answer
            );

        } catch (error) {

            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            console.error(
                "JharJeevan AI error:",
                error
            );

            aiSetTyping(false);

            let message =
                "I'm temporarily unable to connect to the AI assistant. Please try again.";

            if (error?.name === "AbortError") {
                message =
                    "The AI assistant took too long to respond. Please try again.";
            } else if (error?.message) {
                message = error.message;
            }

            aiCreateMessage(
                "assistant",
                message,
                {
                    error: true,
                    retry: true,
                    retryQuestion: cleanQuestion
                }
            );

        } finally {

            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            aiSetTyping(false);
            aiSetBusy(false);

            if (ai.input) {
                ai.input.focus();
            }
        }
    }
    function aiClearConversation() {

        if (!ai.messages) return;

        // Immediately stop any visual loading state.
        aiSetTyping(false);
        aiSetBusy(false);

        ai.messages.innerHTML = `
            <div class="ai-welcome-message">
                <div class="ai-message-avatar">\u{1F916}</div>

                <div class="ai-message-content">
                    <div class="ai-message-name">
                        JharJeevan AI
                        <span>Now</span>
                    </div>

                    <div class="ai-bubble ai-bubble-assistant">
                        <strong>Conversation cleared \u2728</strong>

                        <p>
                            I'm ready for your next question.
                            Ask me anything about blood donation,
                            blood groups, or blood requests.
                        </p>
                    </div>
                </div>
            </div>
        `;

        try {
            sessionStorage.removeItem(
                AI_HISTORY_KEY
            );
        } catch {
            // Ignore storage failures.
        }

        aiScrollBottom();
    }

    function aiSetup() {

        /*
         * Prevent duplicate event listeners when dashboard
         * sections are re-rendered or revisited.
         */
        const currentForm =
            document.querySelector("#aiChatForm");

        if (
            ai.initialized &&
            ai.form &&
            ai.form === currentForm
        ) {
            return;
        }

        ai.initialized = true;

        ai.form = currentForm;
        ai.input = document.querySelector("#aiInput");
        ai.messages = document.querySelector("#aiMessages");
        ai.typing = document.querySelector("#aiTyping");
        ai.send = document.querySelector("#aiSendButton");
        ai.clear = document.querySelector("#aiClearButton");
        ai.count = document.querySelector("#aiCharCount");

        ai.suggestions = [
            ...document.querySelectorAll(
                "[data-ai-question]"
            )
        ];

        if (!ai.form || !ai.input || !ai.messages) {
            return;
        }

        ai.form.addEventListener("submit", event => {
            event.preventDefault();

            aiSendQuestion(ai.input.value);
        });

        ai.input.addEventListener("input", () => {
            aiUpdateCount();
            aiAutoResize();
        });

        ai.input.addEventListener("keydown", event => {
            if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.isComposing
            ) {
                event.preventDefault();

                ai.form.requestSubmit();
            }
        });

        ai.clear?.addEventListener(
            "click",
            aiClearConversation
        );

        ai.suggestions.forEach(button => {
            button.addEventListener("click", () => {
                const question =
                    button.dataset.aiQuestion;

                aiSendQuestion(question);
            });
        });

        aiUpdateCount();
        aiAutoResize();

        /*
         * Restore only the current-tab conversation.
         * This keeps separate dashboard sessions isolated.
         */
        aiRestoreHistory();

        // Always start a fresh UI session in the correct state.
        aiSetTyping(false);
        aiSetBusy(false);

        // Remove any stale typing state left by a previous render.
        if (ai.typing) {
            ai.typing.hidden = true;
            ai.typing.classList.remove("is-visible");
            ai.typing.setAttribute("aria-hidden", "true");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            aiSetup,
            { once: true }
        );
    } else {
        aiSetup();
    }
})();





/* JHARJEEVAN_REQUEST_UI_10 */

/*
 * Production UX layer for the dynamically-created blood request modal.
 * This intentionally does NOT replace the existing API submission logic.
 */
(function setupRequestModal10Enhancement() {

    const REQUIRED_FIELDS = [
        ["patientName", "Patient name"],
        ["bloodGroup", "Blood group"],
        ["unitsRequired", "Units required"],
        ["requiredDate", "Required date"],
        ["hospitalName", "Hospital / medical center"],
        ["hospitalAddress", "Hospital address"],
        ["city", "City"],
        ["requesterName", "Requester name"],
        ["requesterPhone", "Phone"],
        ["requesterEmail", "Email"]
    ];

    function getField(form, name) {
        return form?.querySelector(`[name="${name}"]`) || null;
    }

    function getFieldWrapper(field) {
        if (!field) return null;

        let wrapper = field.closest("label");

        if (!wrapper) {
            wrapper = field.parentElement;
        }

        return wrapper;
    }

    function addRequiredMarker(form) {

        REQUIRED_FIELDS.forEach(([name]) => {

            const field = getField(form, name);
            const wrapper = getFieldWrapper(field);

            if (!field || !wrapper) return;

            wrapper.classList.add("request-field");

            const labelText = wrapper.querySelector("span:first-child");

            if (
                labelText &&
                !labelText.querySelector(".request-required")
            ) {
                const marker = document.createElement("span");

                marker.className = "request-required";
                marker.textContent = " *";
                marker.setAttribute("aria-hidden", "true");

                labelText.appendChild(marker);
            }

            field.setAttribute("aria-required", "true");
        });
    }

    function getErrorElement(wrapper) {

        let error = wrapper?.querySelector(
            ".request-field-error"
        );

        if (!error && wrapper) {

            error = document.createElement("small");

            error.className = "request-field-error";
            error.setAttribute("aria-live", "polite");

            const field = wrapper.querySelector(
                "input, select, textarea"
            );

            if (field) {
                wrapper.appendChild(error);
            }
        }

        return error;
    }

    function setFieldState(field, valid, message = "") {

        const wrapper = getFieldWrapper(field);

        if (!wrapper || !field) return;

        wrapper.classList.toggle(
            "is-invalid",
            !valid
        );

        wrapper.classList.toggle(
            "is-valid",
            valid
        );

        const error = getErrorElement(wrapper);

        if (error) {
            error.textContent = valid
                ? ""
                : message;
        }

        if (!valid) {
            field.setAttribute(
                "aria-invalid",
                "true"
            );
        }
        else {
            field.removeAttribute(
                "aria-invalid"
            );
        }
    }

    function getFieldError(name, value, field) {

        const clean = String(value || "").trim();

        if (!clean) {
            return `${field?.dataset?.label || name} is required.`;
        }

        if (name === "patientName") {

            if (clean.length < 2) {
                return "Enter the patient's full name.";
            }

            if (!/[A-Za-z]/.test(clean)) {
                return "Enter a valid patient name.";
            }
        }

        if (name === "hospitalName" && clean.length < 2) {
            return "Enter the hospital or medical center name.";
        }

        if (name === "hospitalAddress" && clean.length < 5) {
            return "Enter the complete hospital address.";
        }

        if (name === "city" && clean.length < 2) {
            return "Enter the city.";
        }

        if (name === "requesterName" && clean.length < 2) {
            return "Enter the requester's name.";
        }

        if (name === "requesterPhone") {

            if (!/^\d{10}$/.test(clean)) {
                return "Enter a valid 10-digit phone number.";
            }
        }

        if (name === "requesterEmail") {

            if (
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                    clean
                )
            ) {
                return "Enter a valid email address.";
            }
        }

        if (name === "unitsRequired") {

            const units = Number(clean);

            if (
                !Number.isInteger(units) ||
                units < 1 ||
                units > 10
            ) {
                return "Enter between 1 and 10 units.";
            }
        }

        if (name === "requiredDate") {

            const selected = new Date(
                `${clean}T00:00:00`
            );

            const today = new Date();

            today.setHours(0, 0, 0, 0);

            if (
                Number.isNaN(selected.getTime()) ||
                selected < today
            ) {
                return "Choose today or a future date.";
            }
        }

        return "";
    }

    function validateField(field) {

        if (!field) return true;

        const name = field.name;

        const definition = REQUIRED_FIELDS.find(
            ([fieldName]) => fieldName === name
        );

        if (!definition) return true;

        const label = definition[1];

        field.dataset.label = label;

        const error = getFieldError(
            name,
            field.value,
            field
        );

        setFieldState(
            field,
            !error,
            error
        );

        return !error;
    }

    function validateForm(form, focusFirst = true) {

        let firstInvalid = null;
        let valid = true;

        REQUIRED_FIELDS.forEach(([name]) => {

            const field = getField(
                form,
                name
            );

            if (!field) return;

            const fieldValid =
                validateField(field);

            if (!fieldValid) {

                valid = false;

                if (!firstInvalid) {
                    firstInvalid = field;
                }
            }
        });

        if (firstInvalid && focusFirst) {

            firstInvalid.focus({
                preventScroll: true
            });

            firstInvalid.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }

        return valid;
    }

    function updateSubmitButton(form) {

        const button = form?.querySelector(
            "#submitBloodRequestButton"
        );

        if (!button) return;

        const fields = REQUIRED_FIELDS
            .map(([name]) =>
                getField(form, name)
            )
            .filter(Boolean);

        const hasValues = fields.every(
            (field) =>
                String(field.value || "").trim()
        );

        /*
         * Do not disable the button just because a user
         * has not started filling the form. The button
         * remains usable and gives the user proper feedback.
         */
        button.dataset.ready = hasValues
            ? "true"
            : "false";
    }

    function enhanceModal(modal) {

        if (!modal || modal.dataset.requestUi10) {
            return;
        }

        const form = modal.querySelector(
            "#bloodRequestForm"
        );

        if (!form) return;

        modal.dataset.requestUi10 = "true";

        addRequiredMarker(form);

        REQUIRED_FIELDS.forEach(([name]) => {

            const field = getField(
                form,
                name
            );

            if (!field) return;

            field.addEventListener(
                "blur",
                () => {
                    validateField(field);
                }
            );

            field.addEventListener(
                "input",
                () => {

                    const wrapper =
                        getFieldWrapper(field);

                    if (
                        wrapper?.classList.contains(
                            "is-invalid"
                        )
                    ) {
                        validateField(field);
                    }

                    updateSubmitButton(form);
                }
            );

            field.addEventListener(
                "change",
                () => {
                    validateField(field);
                    updateSubmitButton(form);
                }
            );
        });

        form.addEventListener(
            "submit",
            (event) => {

                const valid =
                    validateForm(form, true);

                if (!valid) {

                    event.preventDefault();
                    event.stopImmediatePropagation();

                    const message =
                        form.querySelector(
                            "#bloodRequestMessage"
                        );

                    if (message) {

                        message.className =
                            "blood-request-message error";

                        message.textContent =
                            "Please correct the highlighted fields before submitting.";
                    }

                    return false;
                }
            },
            true
        );

        updateSubmitButton(form);
    }

    function scan() {

        const modal =
            document.querySelector(
                "#bloodRequestModal"
            );

        if (modal) {
            enhanceModal(modal);
        }
    }

    const observer =
        new MutationObserver(scan);

    observer.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );

    scan();

})();





/* ============================================================
   JHARJEEVAN \u2014 FINAL CLIENT NOTIFICATIONS UI
   ============================================================ */

function jjCleanNotificationText(value) {

    let text = String(value ?? "");

    /*
     * Repair/remove common UTF-8 -> Latin-1 mojibake that was
     * previously visible as corrupted emoji or symbols.
     */
    text = text
        .replace(/\u00F0\u0178[\s\S]{0,6}/g, "")
        .replace(/âÅ“[\s\S]{0,4}/g, "")
        .replace(/âš[\s\S]{0,4}/g, "")
        .replace(/Ã‚/g, "")
        .replace(/ï¿½/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();

    return text || "JharJeevan update";
}

function jjNotificationType(type) {

    const value =
        String(type || "")
            .toLowerCase()
            .trim();

    if (
        value.includes("request") ||
        value.includes("blood")
    ) {
        return "blood";
    }

    if (
        value.includes("password") ||
        value.includes("security") ||
        value.includes("auth")
    ) {
        return "security";
    }

    if (
        value.includes("profile") ||
        value.includes("account")
    ) {
        return "profile";
    }

    if (
        value.includes("donor") ||
        value.includes("donation")
    ) {
        return "donor";
    }

    return "system";
}

function jjNotificationIcon(type) {

    const kind = jjNotificationType(type);

    const icons = {
        blood: "â—",
        security: "\u2713",
        profile: "â—",
        donor: "â™¥",
        system: "!"
    };

    return icons[kind] || icons.system;
}

function jjNotificationLabel(type) {

    const kind = jjNotificationType(type);

    const labels = {
        blood: "Blood support",
        security: "Security",
        profile: "Profile",
        donor: "Donation",
        system: "JharJeevan"
    };

    return labels[kind] || labels.system;
}

function jjNotificationClass(type) {

    return `jj-notification-icon jj-notification-${jjNotificationType(type)}`;
}

function jjFormatNotificationTime(value) {

    if (!value) {
        return "Just now";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Recently";
    }

    const now = Date.now();
    const diff = Math.max(
        0,
        now - date.getTime()
    );

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) {
        return "Just now";
    }

    if (diff < hour) {
        const minutes =
            Math.floor(diff / minute);

        return `${minutes}m ago`;
    }

    if (diff < day) {
        const hours =
            Math.floor(diff / hour);

        return `${hours}h ago`;
    }

    if (diff < 7 * day) {
        const days =
            Math.floor(diff / day);

        return `${days}d ago`;
    }

    return date.toLocaleDateString(
        undefined,
        {
            day: "numeric",
            month: "short",
            year:
                date.getFullYear() !==
                new Date().getFullYear()
                    ? "numeric"
                    : undefined
        }
    );
}

/*
 * This declaration intentionally comes after the previous
 * renderer. Function declarations are hoisted, so this final
 * implementation becomes the active renderer while keeping
 * the existing API functions untouched.
 */

/* ============================================================
   JHARJEEVAN \u2014 SAFE NOTIFICATION REQUEST ENGINE
   ============================================================ */

async function jjNotificationRequest(endpoint, options = {}) {

    const token =
        localStorage.getItem(
            "jharjeevan_client_token"
        );

    const controller =
        new AbortController();

    const timeout =
        setTimeout(
            () => controller.abort(),
            10000
        );

    try {

        const headers = {
            "Content-Type": "application/json"
        };

        if (token) {
            headers.Authorization =
                `Bearer ${token}`;
        }

        const response =
            await fetch(
                `${window.location.origin}${endpoint}`,
                {
                    ...options,

                    headers: {
                        ...headers,
                        ...(options.headers || {})
                    },

                    credentials: "same-origin",

                    signal: controller.signal
                }
            );

        let data = null;

        try {
            data = await response.json();
        }
        catch (_) {
            data = null;
        }

        if (!response.ok) {

            throw new Error(
                data?.message ||
                `Request failed (${response.status})`
            );
        }

        if (
            data &&
            data.success === false
        ) {

            throw new Error(
                data.message ||
                "Notification request failed."
            );
        }

        return data || {
            success: true
        };

    }
    finally {

        clearTimeout(timeout);
    }
}


/* ============================================================
   JHARJEEVAN \u2014 NOTIFICATION TOAST
   ============================================================ */

function jjNotificationToast(
    message,
    type = "success"
) {

    let toast =
        document.querySelector(
            "#jjNotificationToast"
        );

    if (!toast) {

        toast =
            document.createElement("div");

        toast.id =
            "jjNotificationToast";

        document.body.appendChild(toast);
    }

    toast.className =
        `jj-notification-toast ${type}`;

    const icon =
        type === "success"
            ? "\u2713"
            : "!";

    toast.innerHTML = `
        <span class="jj-toast-icon">
            ${icon}
        </span>

        <span>
            ${escapeNotificationText(message)}
        </span>
    `;

    requestAnimationFrame(() => {

        toast.classList.add(
            "is-visible"
        );
    });

    clearTimeout(
        toast.__hideTimer
    );

    toast.__hideTimer =
        setTimeout(() => {

            toast.classList.remove(
                "is-visible"
            );

        }, 2400);
}

function renderClientNotifications(notifications) {

    const section =
        document.querySelector("#notifications");

    if (!section) {
        return;
    }

    const safeNotifications =
        Array.isArray(notifications)
            ? notifications
            : [];

    const unreadCount =
        safeNotifications.filter(
            notification =>
                !notification?.is_read
        ).length;

    const readCount =
        safeNotifications.length -
        unreadCount;

    const existing =
        section.querySelector(
            ".live-client-notifications"
        );

    if (existing) {
        existing.remove();
    }

    const container =
        document.createElement("div");

    container.className =
        "live-client-notifications jj-notifications-shell";

    if (!safeNotifications.length) {

        container.innerHTML = `
            <div class="jj-notifications-empty">

                <div class="jj-empty-icon">
                    <span>!</span>
                </div>

                <span class="jj-empty-kicker">
                    ALL CLEAR
                </span>

                <h3>
                    You're all caught up
                </h3>

                <p>
                    Important blood-support, account and
                    request updates will appear here.
                </p>

            </div>
        `;

        section
            .querySelector(".panel")
            ?.appendChild(container);

        return;
    }

    const unreadText =
        unreadCount === 1
            ? "1 unread"
            : `${unreadCount} unread`;

    const totalText =
        safeNotifications.length === 1
            ? "1 notification"
            : `${safeNotifications.length} notifications`;

    container.innerHTML = `

        <div class="jj-notifications-toolbar">

            <div class="jj-notifications-heading">

                <div>
                    <span class="panel-label">
                        UPDATES
                    </span>

                    <h3>
                        Recent notifications
                    </h3>

                    <p>
                        ${totalText}
                        <span class="jj-toolbar-dot">\u2022</span>
                        ${unreadText}
                    </p>
                </div>

                ${
                    unreadCount > 0
                        ? `
                            <button
                                type="button"
                                class="jj-mark-all"
                                id="markAllNotificationsRead"
                            >
                                <span>\u2713</span>
                                Mark all as read
                            </button>
                          `
                        : `
                            <span class="jj-all-read-badge">
                                \u2713 All read
                            </span>
                          `
                }

            </div>

            <div class="jj-notification-summary">

                <div class="jj-summary-item">
                    <strong>${safeNotifications.length}</strong>
                    <span>Total</span>
                </div>

                <div class="jj-summary-item jj-summary-unread">
                    <strong>${unreadCount}</strong>
                    <span>Unread</span>
                </div>

                <div class="jj-summary-item">
                    <strong>${readCount}</strong>
                    <span>Read</span>
                </div>

            </div>

        </div>

        <div class="jj-notification-list">

            ${safeNotifications.map(
                notification => {

                    const id =
                        String(
                            notification?.id ?? ""
                        );

                    const title =
                        jjCleanNotificationText(
                            notification?.title
                        );

                    const message =
                        jjCleanNotificationText(
                            notification?.message
                        );

                    const kind =
                        jjNotificationType(
                            notification?.type
                        );

                    const isUnread =
                        !notification?.is_read;

                    return `

                        <article
                            class="
                                jj-notification-card
                                ${isUnread ? "is-unread" : "is-read"}
                            "
                            data-notification-id="${id}"
                        >

                            <div
                                class="${jjNotificationClass(kind)}"
                                aria-hidden="true"
                            >
                                ${jjNotificationIcon(kind)}
                            </div>

                            <div class="jj-notification-body">

                                <div class="jj-notification-top">

                                    <div>

                                        <span class="jj-notification-category">
                                            ${jjNotificationLabel(kind)}
                                        </span>

                                        <h4>
                                            ${escapeNotificationText(title)}
                                        </h4>

                                    </div>

                                    ${
                                        isUnread
                                            ? `
                                                <span
                                                    class="jj-unread-dot"
                                                    title="Unread"
                                                ></span>
                                              `
                                            : `
                                                <span
                                                    class="jj-read-check"
                                                    title="Read"
                                                >
                                                    \u2713
                                                </span>
                                              `
                                    }

                                </div>

                                <p>
                                    ${escapeNotificationText(message)}
                                </p>

                                <div class="jj-notification-footer">

                                    <time>
                                        ${jjFormatNotificationTime(
                                            notification?.created_at
                                        )}
                                    </time>

                                    ${
                                        isUnread
                                            ? `
                                                <button
                                                    type="button"
                                                    class="jj-notification-read"
                                                    data-read-id="${id}"
                                                >
                                                    Mark as read
                                                </button>
                                              `
                                            : `
                                                <span class="jj-read-label">
                                                    Read
                                                </span>
                                              `
                                    }

                                </div>

                            </div>

                        </article>
                    `;
                }
            ).join("")}

        </div>

        <div class="jj-notifications-footer">

            <span>
                Secure JharJeevan updates
            </span>

            <span>
                ${unreadCount > 0
                    ? `${unreadCount} update${unreadCount === 1 ? "" : "s"} need your attention`
                    : "Nothing requires your attention"}
            </span>

        </div>
    `;

    const panel =
        section.querySelector(".panel");

    if (panel) {
        panel.appendChild(container);
    }

    // --------------------------------------------------------
    // Mark individual notification read
    // --------------------------------------------------------

    container
        .querySelectorAll(
            ".jj-notification-read"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const id =
                        button.dataset.readId;

                    if (!id || button.disabled) {
                        return;
                    }

                    button.disabled = true;
                    button.textContent =
                        "Updating\u2026";

                    try {

                        const result =
                                await jjNotificationRequest(
                                    `/api/client/notifications/${encodeURIComponent(id)}/read`,
                                    {
                                        method: "PATCH"
                                    }
                                );

                        if (
                            !result ||
                            result.success === false
                        ) {
                            throw new Error(
                                result?.message ||
                                "Unable to update notification."
                            );
                        }

                        await loadClientNotifications();

                    } catch (error) {

                        console.error(
                            "Notification read error:",
                            error
                        );

                        button.disabled = false;
                        button.textContent =
                            "Try again";

                        jjNotificationToast(
                            error?.message ||
                            "Unable to update notification.",
                            "error"
                        );

                        jjNotificationToast(
                            error?.message ||
                            "Unable to update notification.",
                            "error"
                        );

                    }
                }
            );
        });

    // --------------------------------------------------------
    // Mark all read
    // --------------------------------------------------------

    const markAll =
        container.querySelector(
            "#markAllNotificationsRead"
        );

    markAll?.addEventListener(
        "click",
        async () => {

            if (markAll.disabled) {
                return;
            }

            markAll.disabled = true;

            markAll.innerHTML =
                `<span>\u2026</span> Updating`;

            try {

                const result =
                    await jjNotificationRequest(
                        "/api/client/notifications/read-all",
                        {
                            method: "PATCH"
                        }
                    );

                if (
                    !result ||
                    result.success === false
                ) {
                    throw new Error(
                        result?.message ||
                        "Unable to mark notifications as read."
                    );
                }

                await loadClientNotifications();

            } catch (error) {

                console.error(
                    "Mark all notifications read error:",
                    error
                );

                markAll.disabled = false;

                markAll.innerHTML =
                    `<span>\u2713</span> Try again`;

                jjNotificationToast(
                    error?.message ||
                    "Unable to update notifications.",
                    "error"
                );

                jjNotificationToast(
                    error?.message ||
                    "Unable to update notifications.",
                    "error"
                );
            }
        }
    );
}




/* ============================================================
   JHARJEEVAN \u2014 REQUESTS FINAL UX
   Production interaction + accessibility polish
   ============================================================ */

(() => {

    "use strict";

    function setupRequestsFinalUX() {

        const refreshButton =
            document.querySelector(
                "#refreshRequestsButton"
            );

        const requestSection =
            document.querySelector(
                "#requests"
            );

        if (refreshButton) {

            refreshButton.setAttribute(
                "aria-label",
                "Refresh blood request history"
            );

            refreshButton.setAttribute(
                "title",
                "Refresh request history"
            );

            refreshButton.setAttribute(
                "type",
                "button"
            );
        }

        if (requestSection) {

            requestSection.setAttribute(
                "aria-live",
                "polite"
            );
        }

        /*
         * Refresh button keyboard feedback.
         */
        if (
            refreshButton &&
            !refreshButton.dataset.finalUxReady
        ) {

            refreshButton.dataset.finalUxReady =
                "true";

            refreshButton.addEventListener(
                "keydown",
                (event) => {

                    if (
                        event.key === "Enter" ||
                        event.key === " "
                    ) {

                        event.preventDefault();

                        refreshButton.click();
                    }
                }
            );
        }

        /*
         * Add a subtle live synchronization indicator.
         */
        if (
            requestSection &&
            !requestSection.querySelector(
                ".jj-request-sync-status"
            )
        ) {

            const header =
                requestSection.querySelector(
                    ".panel-heading"
                );

            if (header) {

                const sync =
                    document.createElement(
                        "span"
                    );

                sync.className =
                    "jj-request-sync-status";

                sync.innerHTML =
                    '<span class="jj-sync-dot"></span>' +
                    '<span class="jj-sync-text">' +
                    "Live request history" +
                    "</span>";

                header.appendChild(sync);
            }
        }
    }

    function updateRequestSyncStatus(
        message = "Live request history"
    ) {

        const text =
            document.querySelector(
                ".jj-sync-text"
            );

        if (text) {
            text.textContent = message;
        }
    }

    window.jharjeevanRequestUX = {
        setup:
            setupRequestsFinalUX,

        synced:
            () =>
                updateRequestSyncStatus(
                    "Updated just now"
                ),

        loading:
            () =>
                updateRequestSyncStatus(
                    "Synchronizing..."
                )
    };

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            setupRequestsFinalUX,
            {
                once: true
            }
        );

    } else {

        setupRequestsFinalUX();
    }

})();
/* ============================================================
   JHARJEEVAN \u2014 NOTIFICATIONS FINAL 10/10 HARDENING
   ============================================================ */

function jjRepairNotificationEncoding(value) {

    let text = String(value ?? "");

    /*
     * Repair common UTF-8 mojibake such as:
     * legacy encoding notes cleaned.
     *
     * Only attempt conversion when suspicious characters
     * are actually present.
     */
    if (/[\u00C3Ã‚Ã¢Ã°]/.test(text)) {

        try {

            const repaired =
                decodeURIComponent(
                    escape(text)
                );

            if (repaired && !/[\u00C3Ã‚Ã¢]/.test(repaired)) {
                text = repaired;
            }

        } catch (_) {
            // Keep original text if conversion is unsafe.
        }
    }

    /*
     * Remove remaining replacement artifacts.
     */
    text = text
        .replace(/Ã‚/g, "")
        .replace(/ï¿½/g, "")
        .trim();

    return text || "JharJeevan update";
}


/*
 * Remove the old static empty-state that exists in the
 * original notification page.
 *
 * The live renderer now owns the notification state.
 */
function jjRemoveStaticNotificationEmptyState() {

    const section =
        document.querySelector("#notifications");

    if (!section) {
        return;
    }

    const candidates =
        section.querySelectorAll("*");

    candidates.forEach(element => {

        if (
            element.children.length === 0 &&
            element.textContent
                ?.trim()
                ?.toLowerCase()
                === "no notifications yet"
        ) {

            let parent = element.parentElement;

            /*
             * Walk upward to the actual empty-state card,
             * but don't remove the whole notifications section.
             */
            for (let i = 0; i < 5 && parent; i++) {

                const text =
                    parent.textContent
                        ?.trim()
                        ?.toLowerCase() || "";

                if (
                    text.includes(
                        "important updates will appear here"
                    )
                ) {

                    parent.remove();
                    return;
                }

                parent = parent.parentElement;
            }
        }
    });
}


/*
 * Remove stale empty state whenever notifications are
 * rendered or navigation occurs.
 */
function jjFinalizeNotificationsUI() {

    jjRemoveStaticNotificationEmptyState();

    /*
     * Repair visible notification text without changing
     * backend/database values.
     */
    const section =
        document.querySelector("#notifications");

    if (!section) {
        return;
    }

    section
        .querySelectorAll(
            ".jj-notification-top h4, " +
            ".jj-notification-body > p"
        )
        .forEach(element => {

            const original =
                element.textContent || "";

            const repaired =
                jjRepairNotificationEncoding(
                    original
                );

            if (repaired !== original) {
                element.textContent = repaired;
            }
        });
}


/*
 * Run after DOM creation.
 */
if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            setTimeout(
                jjFinalizeNotificationsUI,
                100
            );

        },
        {
            once: true
        }
    );

} else {

    setTimeout(
        jjFinalizeNotificationsUI,
        100
    );
}


/*
 * Watch the notification section for live rendering.
 */
(function jjNotificationObserver() {

    const observerTarget =
        document.querySelector("#notifications");

    if (!observerTarget) {
        return;
    }

    const observer =
        new MutationObserver(() => {

            clearTimeout(
                observerTarget.__jjNotificationTimer
            );

            observerTarget.__jjNotificationTimer =
                setTimeout(
                    jjFinalizeNotificationsUI,
                    80
                );

        });

    observer.observe(
        observerTarget,
        {
            childList: true,
            subtree: true,
            characterData: true
        }
    );

})();

/* ============================================================
   JHARJEEVAN_SINGLE_CLEAN_LOGOUT_CONTROLLER

   Single logout source of truth.
   Does not interfere with dashboard navigation.
============================================================ */

(() => {

    "use strict";

    if (window.__JHARJEEVAN_SINGLE_CLEAN_LOGOUT__) {
        return;
    }

    window.__JHARJEEVAN_SINGLE_CLEAN_LOGOUT__ = true;

    const TOKEN_KEY =
        "jharjeevan_client_token";

    const CLIENT_KEY =
        "jharjeevan_client";

    const ACTIVE_SECTION_KEY =
        "jharjeevanActiveSection";

    document.addEventListener(
        "click",
        (event) => {

            const target =
                event.target instanceof Element
                    ? event.target
                    : null;

            if (!target) {
                return;
            }

            const button =
                target.closest("#logoutButton");

            if (!button) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            if (button.dataset.loggingOut === "true") {
                return;
            }

            button.dataset.loggingOut = "true";
            button.disabled = true;

            button.classList.add("is-loading");

            try {
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(CLIENT_KEY);
            } catch (error) {
                console.warn(
                    "[JharJeevan] Unable to clear client storage.",
                    error
                );
            }

            try {
                sessionStorage.removeItem(
                    ACTIVE_SECTION_KEY
                );

                sessionStorage.removeItem(
                    "clientSubmittedRequests"
                );
            } catch (error) {
                console.warn(
                    "[JharJeevan] Unable to clear dashboard session.",
                    error
                );
            }

            window.setTimeout(() => {

                window.location.replace(
                    "client-login.html"
                );

            }, 100);

        },
        true
    );

})();

/* END JHARJEEVAN_SINGLE_CLEAN_LOGOUT_CONTROLLER */

/* ============================================================
   JHARJEEVAN_CLEAN_FINAL_NAVIGATION_CONTROLLER

   Single final dashboard navigation controller.

   This controller:
   - supports all dashboard sections
   - prevents older click handlers
   - persists current section
   - restores the section after refresh
   - handles dashboard action buttons
   - does NOT touch authentication
============================================================ */

(() => {

    "use strict";

    if (window.__JHARJEEVAN_CLEAN_FINAL_NAV__) {
        return;
    }

    window.__JHARJEEVAN_CLEAN_FINAL_NAV__ = true;

    const VALID_SECTIONS = new Set([
        "overview",
        "find-blood",
        "requests",
        "donor",
        "notifications",
        "profile",
        "ai"
    ]);

    const STORAGE_KEY = "jharjeevanActiveSection";

    function normalize(section) {

        const value = String(section || "")
            .trim()
            .toLowerCase();

        return VALID_SECTIONS.has(value)
            ? value
            : null;
    }

    function activate(sectionId, save = true) {

        const section = normalize(sectionId);

        if (!section) {
            return false;
        }

        const target = document.getElementById(section);

        if (!target) {
            console.warn(
                "[JharJeevan] Navigation target missing:",
                section
            );

            return false;
        }

        /*
         * Update dashboard sections.
         */
        document
            .querySelectorAll(".dashboard-section")
            .forEach((element) => {

                const active =
                    element.id === section;

                element.classList.toggle(
                    "active",
                    active
                );

                if (active) {

                    element.removeAttribute("hidden");

                    element.setAttribute(
                        "aria-hidden",
                        "false"
                    );

                } else {

                    element.setAttribute(
                        "aria-hidden",
                        "true"
                    );

                }

            });

        /*
         * Update sidebar.
         */
        document
            .querySelectorAll(
                ".nav-item[data-section]"
            )
            .forEach((item) => {

                const active =
                    normalize(
                        item.dataset.section
                    ) === section;

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

        /*
         * Persist section.
         */
        if (save) {

            try {

                sessionStorage.setItem(
                    STORAGE_KEY,
                    section
                );

            } catch (error) {

                console.warn(
                    "[JharJeevan] Could not save section.",
                    error
                );

            }

        }

        /*
         * Close mobile sidebar.
         */
        document.body.classList.remove(
            "sidebar-open"
        );

        document.body.style.overflow = "";

        /*
         * Notify dashboard components.
         */
        window.dispatchEvent(
            new CustomEvent(
                "jharjeevan:sectionchange",
                {
                    detail: {
                        section
                    }
                }
            )
        );

        /*
         * Scroll dashboard to top.
         */
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

        return true;
    }


    /*
     * CAPTURE PHASE
     *
     * This must execute before old handlers.
     */
    document.addEventListener(
        "click",
        (event) => {

            const target =
                event.target instanceof Element
                    ? event.target
                    : null;

            if (!target) {
                return;
            }

            const nav =
                target.closest(
                    ".nav-item[data-section]"
                );

            const action =
                target.closest(
                    "[data-section-target]"
                );

            const clicked =
                nav || action;

            if (!clicked) {
                return;
            }

            const requested =
                nav
                    ? nav.dataset.section
                    : action.dataset.sectionTarget;

            const section =
                normalize(requested);

            if (!section) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            activate(section, true);

        },
        true
    );


    /*
     * Restore saved section after DOM is ready.
     */
    function restore() {

        let saved = null;

        try {

            saved =
                sessionStorage.getItem(
                    STORAGE_KEY
                );

        } catch {

            saved = null;

        }

        const section =
            normalize(saved) || "overview";

        activate(section, false);

    }


    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            restore,
            {
                once: true
            }
        );

    } else {

        restore();

    }


    /*
     * Public API.
     */
    window.jharjeevanFinalNavigate =
        activate;

    window.activateDashboardSection =
        activate;

})();

/* END JHARJEEVAN_CLEAN_FINAL_NAVIGATION_CONTROLLER */









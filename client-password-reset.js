"use strict";

(() => {
    const API_BASE = "";

    function getElement(id) {
        return document.getElementById(id);
    }

    function setMessage(element, message, type = "") {
        if (!element) return;

        element.textContent = message || "";
        element.className = "form-message";

        if (type) {
            element.classList.add(type);
        }
    }

    function setLoading(button, loading) {
        if (!button) return;

        button.disabled = loading;
        button.classList.toggle("is-loading", loading);
    }

    function getPasswordStrength(password) {
        let score = 0;

        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        if (!password) {
            return {
                score: 0,
                label: "Enter a password"
            };
        }

        if (score <= 2) {
            return {
                score,
                label: "Weak password"
            };
        }

        if (score === 3) {
            return {
                score,
                label: "Fair password"
            };
        }

        if (score === 4) {
            return {
                score,
                label: "Good password"
            };
        }

        return {
            score,
            label: "Strong password"
        };
    }

    function updatePasswordStrength(password) {
        const bar = getElement("passwordStrengthBar");
        const text = getElement("passwordStrengthText");

        if (!bar || !text) return;

        const result = getPasswordStrength(password);

        const percentage = Math.min(
            100,
            Math.max(0, result.score * 20)
        );

        bar.style.width = `${percentage}%`;
        text.textContent = result.label;

        bar.classList.remove(
            "weak",
            "fair",
            "good",
            "strong"
        );

        if (result.score <= 2 && password) {
            bar.classList.add("weak");
        } else if (result.score === 3) {
            bar.classList.add("fair");
        } else if (result.score === 4) {
            bar.classList.add("good");
        } else if (result.score >= 5) {
            bar.classList.add("strong");
        }

        updateRequirement(
            "length",
            password.length >= 8 && password.length <= 128
        );

        updateRequirement(
            "uppercase",
            /[A-Z]/.test(password)
        );

        updateRequirement(
            "number",
            /[0-9]/.test(password)
        );

        updateRequirement(
            "special",
            /[^A-Za-z0-9]/.test(password)
        );
    }

    function updateRequirement(rule, valid) {
        const element = document.querySelector(
            `[data-rule="${rule}"]`
        );

        if (!element) return;

        element.classList.toggle("valid", valid);

        const icon = element.querySelector("i");

        if (icon) {
            icon.className = valid
                ? "fas fa-circle-check"
                : "fas fa-circle";
        }
    }

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

                    const showing =
                        input.type === "text";

                    input.type =
                        showing ? "password" : "text";

                    const icon =
                        button.querySelector("i");

                    if (icon) {
                        icon.className = showing
                            ? "fas fa-eye"
                            : "fas fa-eye-slash";
                    }

                    button.setAttribute(
                        "aria-label",
                        showing
                            ? "Show password"
                            : "Hide password"
                    );
                });
            });
    }

    async function requestJson(url, options) {
        const response = await fetch(
            `${API_BASE}${url}`,
            {
                ...options,
                headers: {
                    "Content-Type": "application/json",
                    ...(options?.headers || {})
                }
            }
        );

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Something went wrong. Please try again."
            );
        }

        return data;
    }

    function setupForgotPassword() {
        const form =
            getElement("clientForgotPasswordForm");

        if (!form) return;

        const email =
            getElement("forgotEmail");

        const message =
            getElement("forgotPasswordMessage");

        const button =
            getElement("forgotPasswordButton");

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            const emailValue =
                email?.value.trim().toLowerCase();

            if (!emailValue) {
                setMessage(
                    message,
                    "Please enter your email address.",
                    "error"
                );
                email?.focus();
                return;
            }

            if (
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                    emailValue
                )
            ) {
                setMessage(
                    message,
                    "Please enter a valid email address.",
                    "error"
                );
                email?.focus();
                return;
            }

            setLoading(button, true);
            setMessage(message, "");

            try {
                const data =
                    await requestJson(
                        "/api/client/forgot-password",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                email: emailValue
                            })
                        }
                    );

                setMessage(
                    message,
                    data.message ||
                    "If that email is registered, a reset link has been sent.",
                    "success"
                );

                form.reset();

            } catch (error) {
                setMessage(
                    message,
                    error.message,
                    "error"
                );
            } finally {
                setLoading(button, false);
            }
        });
    }

    function setupResetPassword() {
        const form =
            getElement("clientResetPasswordForm");

        if (!form) return;

        const password =
            getElement("newPassword");

        const confirm =
            getElement("confirmPassword");

        const message =
            getElement("resetPasswordMessage");

        const button =
            getElement("resetPasswordButton");

        const token =
            new URLSearchParams(
                window.location.search
            ).get("token");

        if (!token) {
            setMessage(
                message,
                "This password reset link is missing its security token. Please request a new reset link.",
                "error"
            );

            button.disabled = true;
            return;
        }

        password?.addEventListener(
            "input",
            () => {
                updatePasswordStrength(
                    password.value
                );
            }
        );

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            const passwordValue =
                password?.value || "";

            const confirmValue =
                confirm?.value || "";

            if (!getPasswordStrength(passwordValue).score ||
                !(
                    passwordValue.length >= 8 &&
                    passwordValue.length <= 128 &&
                    /[A-Z]/.test(passwordValue) &&
                    /[0-9]/.test(passwordValue) &&
                    /[^A-Za-z0-9]/.test(passwordValue)
                )
            ) {
                setMessage(
                    message,
                    "Please create a stronger password using all the required rules.",
                    "error"
                );
                password?.focus();
                return;
            }

            if (passwordValue !== confirmValue) {
                setMessage(
                    message,
                    "Passwords do not match.",
                    "error"
                );
                confirm?.focus();
                return;
            }

            setLoading(button, true);
            setMessage(message, "");

            try {
                const data =
                    await requestJson(
                        "/api/client/reset-password",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                token,
                                newPassword:
                                    passwordValue
                            })
                        }
                    );

                setMessage(
                    message,
                    data.message ||
                    "Password changed successfully.",
                    "success"
                );

                form.reset();
                updatePasswordStrength("");

                setTimeout(() => {
                    window.location.href =
                        "client-login.html";
                }, 1800);

            } catch (error) {
                setMessage(
                    message,
                    error.message,
                    "error"
                );
            } finally {
                setLoading(button, false);
            }
        });
    }

    function init() {
        setupPasswordToggles();
        setupForgotPassword();
        setupResetPassword();
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
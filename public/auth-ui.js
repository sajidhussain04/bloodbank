"use strict";

(() => {
    const initAuthUI = () => {
        document.documentElement.classList.add("auth-ui-ready");

        const card = document.querySelector(".auth-card");

        if (!card) return;

        /*
         * Lightweight pointer spotlight for desktop.
         * Automatically disabled on touch devices.
         */
        if (window.matchMedia("(pointer:fine)").matches) {

            card.addEventListener("pointermove", (event) => {
                const rect = card.getBoundingClientRect();

                const x =
                    ((event.clientX - rect.left) / rect.width) * 100;

                const y =
                    ((event.clientY - rect.top) / rect.height) * 100;

                card.style.setProperty(
                    "--auth-mouse-x",
                    `${x}%`
                );

                card.style.setProperty(
                    "--auth-mouse-y",
                    `${y}%`
                );
            });

            card.addEventListener("pointerleave", () => {
                card.style.setProperty(
                    "--auth-mouse-x",
                    "50%"
                );

                card.style.setProperty(
                    "--auth-mouse-y",
                    "50%"
                );
            });
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initAuthUI,
            { once: true }
        );
    } else {
        initAuthUI();
    }
})();
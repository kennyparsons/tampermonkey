// ==UserScript==
// @name         Gemini Default Pro Mode
// @namespace    https://github.com/kennyparsons/tampermonkey
// @version      1.1.1
// @description  Automatically sets Gemini to Pro mode instead of Fast mode on page load
// @author       Kenny Parsons
// @icon         https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg
// @homepageURL  https://github.com/kennyparsons/tampermonkey
// @updateURL    https://raw.githubusercontent.com/kennyparsons/tampermonkey/main/scripts/gemini-default-pro-mode.user.js
// @downloadURL  https://raw.githubusercontent.com/kennyparsons/tampermonkey/main/scripts/gemini-default-pro-mode.user.js
// @match        https://gemini.google.com/app
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const CONFIG = {
    DEBUG: true,
    CHECK_INTERVAL_MS: 3000, // Check every 3 seconds
    MENU_OPEN_DELAY_MS: 500, // Wait for menu to open
  };

  // --- Logging ---
  const COLOR = { info: "color:#03A9F4;", warn: "color:#FF9800;", err: "color:#E91E63;" };
  const ts = () => new Date().toISOString().replace("T", " ").replace("Z", "");
  const logBase = (p, c, ...a) => CONFIG.DEBUG && console.log(`%c[Gemini Pro Mode ${p}] ${ts()}:`, c, ...a);
  const logInfo = (...a) => logBase("INFO", COLOR.info, ...a);
  const logWarn = (...a) => logBase("WARN", COLOR.warn, ...a);
  const logError = (...a) => logBase("ERR", COLOR.err, ...a);

  // --- State ---
  let isProcessing = false;

  // --- Helper to get current mode from button ---
  function getCurrentMode() {
    const modeButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
      const text = btn.textContent?.trim();
      return text === 'Fast' || text === 'Thinking' || text === 'Pro';
    });

    if (modeButtons.length > 0) {
      return modeButtons[0].textContent.trim();
    }
    return null;
  }

  // --- Main function to switch to Pro mode ---
  async function switchToProMode() {
    if (isProcessing) {
      logInfo("Already processing, skipping");
      return false;
    }

    isProcessing = true;

    try {
      const currentMode = getCurrentMode();

      if (currentMode === 'Pro') {
        logInfo("Already in Pro mode");
        return true;
      }

      if (!currentMode) {
        logWarn("Could not find mode button");
        return false;
      }

      logInfo(`Current mode: ${currentMode}, switching to Pro...`);

      // Step 1: Find and click the mode picker button to open menu
      const modeButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
        const text = btn.textContent?.trim();
        return text === 'Fast' || text === 'Thinking' || text === 'Pro';
      });

      if (modeButtons.length > 0) {
        logInfo(`Clicking mode button: ${modeButtons[0].textContent.trim()}`);
        modeButtons[0].click();

        // Wait for menu to open
        await new Promise(resolve => setTimeout(resolve, CONFIG.MENU_OPEN_DELAY_MS));

        // Step 2: Find and click Pro in the menu
        const modeTitles = Array.from(document.querySelectorAll('.mode-title'));
        const proSpan = modeTitles.find(span => span.textContent.trim() === 'Pro');

        if (proSpan) {
          logInfo("Found Pro span, clicking parent menuitemradio");
          const menuItem = proSpan.closest('[role="menuitemradio"]');
          if (menuItem) {
            menuItem.click();
            logInfo("Successfully switched to Pro mode!");
            return true;
          }
        } else {
          logWarn("Could not find Pro option in menu");
        }
      }

      return false;
    } finally {
      isProcessing = false;
    }
  }

  // --- Periodic check to ensure Pro mode ---
  function startPeriodicCheck() {
    setInterval(async () => {
      const currentMode = getCurrentMode();
      if (currentMode && currentMode !== 'Pro') {
        logInfo(`Periodic check: detected ${currentMode} mode, switching to Pro`);
        await switchToProMode();
      }
    }, CONFIG.CHECK_INTERVAL_MS);

    logInfo("Periodic check started");
  }

  // --- Bootstrap ---
  (function init() {
    try {
      if (window.top !== window.self) return;
    } catch {}

    logInfo("Initializing Gemini Pro Mode script");

    // Initial switch after page load
    setTimeout(() => {
      switchToProMode();
    }, 1500);

    // Start periodic checking
    startPeriodicCheck();
  })();
})();


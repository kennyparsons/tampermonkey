// ==UserScript==
// @name         Gmail Copy Email Link
// @namespace    https://github.com/kennyparsons/tampermonkey
// @version      1.6
// @description  Adds a native-style "Copy link" button to Gmail toolbars (thread, preview, or message view). Dynamically detects your Gmail address.
// @author       Kenny Parsons
// @match        https://mail.google.com/*
// @run-at       document-idle
// @grant        GM_setClipboard
// @homepageURL  https://github.com/kennyparsons/tampermonkey
// @updateURL    https://raw.githubusercontent.com/kennyparsons/tampermonkey/main/scripts/gmail-copy-email-link.user.js
// @downloadURL  https://raw.githubusercontent.com/kennyparsons/tampermonkey/main/scripts/gmail-copy-email-link.user.js
// ==/UserScript==

(function () {
  "use strict";

  /* ---------- Detect Gmail Account Email Dynamically ---------- */
  function detectUserEmail() {
    // 1️⃣ Account menu (most common)
    const label = document.querySelector('a[aria-label*=" @"]')?.getAttribute("aria-label");
    if (label) {
      const match = label.match(/([A-Z0-9._%+-]+ @[A-Z0-9.-]+\.[A-Z]{2,})/i);
      if (match) return match[1];
    }

    // 2️⃣ Gmail's newer header tooltip (Material 3)
    const tooltip = document.querySelector('[data-tooltip*=" @"]')?.getAttribute("data-tooltip");
    if (tooltip) {
      const match = tooltip.match(/([A-Z0-9._%+-]+ @[A-Z0-9.-]+\.[A-Z]{2,})/i);
      if (match) return match[1];
    }

    // 3️⃣ Check global Gmail or Google session data objects
    const gdata = window.WIZ_global_data || window.SESSION_INFO || window.GOOGLE_ACCOUNTS || {};
    const gjson = JSON.stringify(gdata);
    const matchGlobal = gjson.match(/([A-Z0-9._%+-]+ @[A-Z0-9.-]+\.[A-Z]{2,})/i);
    if (matchGlobal) return matchGlobal[1];

    // 4️⃣ Look through window for known Gmail state keys
    for (const k in window) {
      try {
        const v = window[k];
        if (v && typeof v === "object" && JSON.stringify(v).includes(" @")) {
          const m = JSON.stringify(v).match(/([A-Z0-9._%+-]+ @[A-Z0-9.-]+\.[A-Z]{2,})/i);
          if (m) return m[1];
        }
      } catch {}
    }

    // 5️⃣ URL + cookies fallback
    const cookie = document.cookie.match(/(?:^|;\s*)EMAIL=([^;]+)/);
    if (cookie) return decodeURIComponent(cookie[1]);
    const urlMatch = location.href.match(/\/u\/(\d+)\//);
    if (urlMatch) return `user${urlMatch[1]} @gmail.com`; // synthetic fallback

    return null;
  }

  const DETECTED_EMAIL = detectUserEmail();
  const USER_EMAIL = DETECTED_EMAIL || "0"; // fallback, works but is not permanent, problematic if you have multiple profiles,
  console.log("[CopyLink] Using email/id:", USER_EMAIL);

  const TOOLTIP_TEXT = "Copy email link";

  /* ---------- Build Stable Email Link ---------- */
  function buildLink() {
    const msg = document.querySelector("div[data-legacy-message-id]");
    if (!msg) return null;
    const msgId = msg.getAttribute("data-legacy-message-id");
    return `https://mail.google.com/mail/u/${USER_EMAIL}/#all/${msgId}`;
  }

  /* ---------- Create Gmail-Style Icon Button ---------- */
  function makeButton() {
    const btn = document.createElement("div");
    btn.className =
      "T-I J-J5-Ji ar7 nf T-I-ax7 T-I-Js-Gs tm-copylink-btn";
    btn.setAttribute("role", "button");
    btn.setAttribute("tabindex", "0");
    btn.setAttribute("data-tooltip", TOOLTIP_TEXT);
    btn.setAttribute("aria-label", TOOLTIP_TEXT);
    btn.style.display = "inline-flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.width = "36px";
    btn.style.height = "36px";

    const icon = document.createElement("div");
    icon.style.mask =
      "url(https://www.gstatic.com/images/icons/material/system/1x/link_white_20dp.png) center / 20px no-repeat";
    icon.style.webkitMask =
      "url(https://www.gstatic.com/images/icons/material/system/1x/link_white_20dp.png) center / 20px no-repeat";
    icon.style.backgroundColor = "var(--gm-fillicon, #5f6368)";
    icon.style.width = "20px";
    icon.style.height = "20px";
    btn.appendChild(icon);

    btn.addEventListener("mouseenter", () => (icon.style.backgroundColor = "#1a73e8"));
    btn.addEventListener("mouseleave", () => (icon.style.backgroundColor = "var(--gm-fillicon, #5f6368)"));

    btn.addEventListener("click", () => {
      const link = buildLink();
      if (!link) return alert("No message ID found.");
      try {
        if (typeof GM_setClipboard !== "undefined") GM_setClipboard(link);
        else navigator.clipboard.writeText(link);
        btn.setAttribute("data-tooltip", "✅ Copied!");
        setTimeout(() => btn.setAttribute("data-tooltip", TOOLTIP_TEXT), 1500);
      } catch (e) {
        console.error(e);
        alert("Failed to copy link.");
      }
    });
    return btn;
  }

  /* ---------- DOM Handling ---------- */
  function insertButton(toolbar) {
    if (!toolbar || toolbar.querySelector(".tm-copylink-btn")) return;
    const btn = makeButton();
    toolbar.appendChild(btn);
  }

  function findAllToolbars() {
    return Array.from(
      document.querySelectorAll('div[role="toolbar"]:not([aria-hidden="true"])')
    ).filter((t) => t.offsetParent !== null);
  }

  function refreshButtons() {
    findAllToolbars().forEach(insertButton);
  }

  const observer = new MutationObserver(refreshButtons);
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshButtons);
  } else refreshButtons();
})();

// ==UserScript==
// @name         Gmail Copy Email Link
// @namespace    https://github.com/kennyparsons/tampermonkey
// @version      2.3
// @description  Adds a native-style "Copy link" button to Gmail subject headers (works in reading pane + pop-out). Automatically detects your Gmail account for correct link URLs.
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

  let USER_EMAIL = "0";
  let USER_PATH = "0";
  let lastThreadId = null;
  let lastInsert = 0;

  /* ---------- Detect Gmail Account Email ---------- */
  function detectUserEmail() {
    const label = document.querySelector('a[aria-label*="@"]')?.getAttribute("aria-label");
    if (label) {
      const match = label.match(/\(([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\)/i);
      if (match) return match[1];
    }
    return "0";
  }

  function initUserEmail(retries = 0) {
    const email = detectUserEmail();
    if (email !== "0") {
      USER_EMAIL = email;
      USER_PATH = encodeURIComponent(email);
      console.log(`[CopyLink] Detected Gmail user: ${USER_EMAIL}`);
    } else if (retries < 6) {
      setTimeout(() => initUserEmail(retries + 1), 500); // retry up to 3s total
    } else {
      console.warn("[CopyLink] Could not detect user email — defaulting to /u/0/");
    }
  }

  initUserEmail();

  /* ---------- Build Link ---------- */
  function buildLink() {
    const msg = document.querySelector("div[data-legacy-message-id]");
    if (!msg) return null;
    const id = msg.getAttribute("data-legacy-message-id");
    return { id, url: `https://mail.google.com/mail/u/${USER_PATH}/#all/${id}` };
  }

  /* ---------- Create Copy Button ---------- */
  function makeButton() {
    const btn = document.createElement("span");
    btn.className = "tm-copylink-btn";
    btn.textContent = "🔗 Copy link";
    btn.style.cssText = `
      cursor:pointer;
      color:#1a73e8;
      font-size:13px;
      margin-left:8px;
      user-select:none;
    `;

    btn.addEventListener("mouseenter", () => (btn.style.textDecoration = "underline"));
    btn.addEventListener("mouseleave", () => (btn.style.textDecoration = "none"));

    btn.addEventListener("click", () => {
      const link = buildLink();
      if (!link) return alert("No message ID found.");
      try {
        (typeof GM_setClipboard !== "undefined" ? GM_setClipboard : navigator.clipboard.writeText)(link.url);
        btn.textContent = "✅ Copied!";
        setTimeout(() => (btn.textContent = "🔗 Copy link"), 1500);
      } catch (e) {
        console.error(e);
        alert("Failed to copy link.");
      }
    });

    return btn;
  }

  /* ---------- Insert Button ---------- */
  function insertButton() {
    const now = Date.now();
    if (now - lastInsert < 1000) return; // debounce
    lastInsert = now;

    const msg = document.querySelector("div[data-legacy-message-id]");
    if (!msg) return;

    const { id } = buildLink() || {};
    if (id && id === lastThreadId) return;
    lastThreadId = id;

    const targets = [
      document.querySelector("div.SG.tVu25"), // pop-out window
      document.querySelector("h2.hP"),        // reading pane
    ];

    for (const el of targets) {
      if (!el) continue;
      if (el.querySelector(".tm-copylink-btn")) continue;
      const btn = makeButton();

      if (el.tagName === "H2") {
        el.insertAdjacentElement("afterend", btn);
      } else {
        el.style.position = "relative";
        Object.assign(btn.style, {
          position: "absolute",
          top: "6px",
          right: "12px",
          background: "#fff",
          border: "1px solid #dadce0",
          borderRadius: "4px",
          padding: "2px 6px",
          fontSize: "12px",
        });
        el.appendChild(btn);
      }
      console.log("[CopyLink] inserted button into", el.className);
    }
  }

  /* ---------- Observe DOM Changes ---------- */
  const observer = new MutationObserver(() => insertButton());
  observer.observe(document.body, { childList: true, subtree: true });

  insertButton();
})();
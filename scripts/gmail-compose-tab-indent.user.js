// ==UserScript==
// @name         Gmail Compose: Tab to Indent
// @namespace    https://github.com/kennyparsons/tampermonkey
// @version      1.1.1
// @description  Enable Tab / Shift+Tab to indent or outdent inside Gmail's compose editor
// @icon         https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico
// @homepageURL  https://github.com/kennyparsons/tampermonkey
// @updateURL    https://raw.githubusercontent.com/kennyparsons/tampermonkey/main/scripts/gmail-compose-tab-indent.user.js
// @downloadURL  https://raw.githubusercontent.com/kennyparsons/tampermonkey/main/scripts/gmail-compose-tab-indent.user.js
// @match        https://mail.google.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // ---- helpers -------------------------------------------------------------

  // Case-insensitive check for common "Message body" labels.
  function isMessageBodyLabel(el) {
    const label = (el.getAttribute("aria-label") || "").trim().toLowerCase();
    return label === "message body";
  }

  // Returns true if the target is the Gmail rich-text compose body.
  // Gmail uses a contenteditable div (not a textarea) for rich compose.
  function isComposeBody(el) {
    if (!el || !el.isContentEditable) return false;

    // direct label match
    if (isMessageBodyLabel(el)) return true;

    // walk up to find a labeled editable container (Gmail swaps nodes often)
    const host = el.closest('div[contenteditable="true"]');
    if (host && isMessageBodyLabel(host)) return true;

    // some Gmail builds set role="textbox" on the body
    if ((el.getAttribute("role") || "").toLowerCase() === "textbox" && isMessageBodyLabel(el)) {
      return true;
    }

    // fallback: editable inside a compose widget; avoid catching search/subject fields
    // (compose widget has 'aria-label="Message body"' on a parent in most locales)
    return !!el.closest('div[aria-label="Message body"], div[aria-label="Message Body"]');
  }

  // Use execCommand inside contenteditable (still supported in Gmail's editor).
  // Gmail maps indent/outdent to its RTE commands (lists, blockquotes, etc.).
  function applyIndentCommand(editor, outdent = false) {
    editor.focus();
    // If selection lives in another element inside the editor, focusing the editor
    // is usually enough; execCommand applies to the current selection.
    document.execCommand(outdent ? "outdent" : "indent", false, null);
  }

  // ---- key handling --------------------------------------------------------

  // Capture early so we beat Gmail's Tab handling.
  document.addEventListener(
    "keydown",
    (ev) => {
      if (ev.key !== "Tab") return;
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;

      const target = ev.target;
      if (!isComposeBody(target)) return;

      ev.preventDefault();
      ev.stopPropagation();

      // Shift+Tab => outdent; Tab => indent
      applyIndentCommand(target, ev.shiftKey);
    },
    true
  );

  // No MutationObserver needed: we listen at document level so it keeps working
  // even when Gmail swaps compose editors dynamically.
})();
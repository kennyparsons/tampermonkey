// ==UserScript==
// @name         Gmail Saved Searches Sidebar
// @author       Kenny Parsons
// @namespace    https://github.com/kennyparsons/tampermonkey
// @copyright    2025, Kenny Parsons (https://github.com/kennyparsons)
// @version      1.4.1
// @description  Adds a "Saved Searches" panel with quick filters to Gmail's sidebar, using Shadow DOM to avoid Gmail styles.
// @icon         https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico
// @homepageURL  https://github.com/kennyparsons/tampermonkey
// @updateURL    https://raw.githubusercontent.com/kennyparsons/tampermonkey/main/scripts/gmail-saved-searches.user.js
// @downloadURL  https://raw.githubusercontent.com/kennyparsons/tampermonkey/main/scripts/gmail-saved-searches.user.js
// @match        https://mail.google.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  /* ---------- CONFIG ---------- */
const DEFAULT_SAVED_SEARCHES = [
  { name: "Unread",        q: "is:unread" },
  { name: "Needs Reply",   q: "from:* has:nouserlabels -category:social -category:promotions -category:updates -category:forums -category:advertisements -category:reservations -category:purchases is:unread" },
  { name: "Attachments",   q: "has:attachment" },
  { name: "Large (10MB+)", q: "larger:10M" },
  { name: "Receipts",      q: "category:purchases OR newer_than:1y subject:(receipt OR invoice)" },
  { name: "Travel",        q: "category:travel OR subject:(itinerary OR boarding OR ticket)" },
  { name: "Starred",       q: "is:starred" },
  { name: "Calendar",      q: '-from:(me) subject:("invitation" OR "accepted" OR "rejected" OR "updated" OR "canceled event" OR "declined" OR "proposed") when where calendar who organizer -Re' },
];
  const STORAGE_KEY = "tm-gmail-saved-searches-v1";
  const SHOW_MENU = true;

  /* ---------- STORAGE ---------- */
  const loadSaved = () => {
    try { const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); return Array.isArray(v) ? v : DEFAULT_SAVED_SEARCHES; }
    catch { return DEFAULT_SAVED_SEARCHES; }
  };
  const saveSaved = (arr) => localStorage.setItem(STORAGE_KEY, JSON.stringify(arr || []));

  /* ---------- NAV + ROUTING ---------- */
  const findLeftNav = () =>
    document.querySelector('div[role="navigation"]') ||
    document.querySelector('nav[role="navigation"]') ||
    document.querySelector('div[aria-label="Main menu"]');

  const gotoQuery = (q) => {
    const hash = "#search/" + encodeURIComponent(q);
    if (location.hash === hash) { location.hash = "#inbox"; setTimeout(() => (location.hash = hash), 0); }
    else { location.hash = hash; }
  };

  /* ---------- RENDER (Shadow DOM) ---------- */
const CSS = `
:host{ all:initial; font-family: system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; color:#fff; }
.container{ margin:8px 12px 12px 12px; padding:8px; border-radius:12px; background: rgba(255,255,255,.08); }
.title{ font-weight:600; font-size:12px; letter-spacing:.04em; text-transform:uppercase; color:#fff; display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.menu{ cursor:pointer; padding:4px 6px; border-radius:8px; user-select:none; color:#fff; }
.menu:hover{ background:rgba(255,255,255,.15); }
.list{ display:flex; flex-direction:column; gap:4px; }
.item{ display:block; width:100%; border:none; background:transparent; text-align:left; padding:6px 8px; border-radius:10px; font-size:13px; line-height:1.3; cursor:pointer; color:#fff; }
.item:hover{ background:rgba(255,255,255,.15); }
.empty{ font-size:12px; color:rgba(255,255,255,.65); padding:6px 0 2px; }
`;

  function buildShadowPanel() {
    const host = document.createElement("div");
    host.id = "tm-saved-searches-host";
    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = CSS;

    const container = document.createElement("div");
    container.className = "container";

    const title = document.createElement("div");
    title.className = "title";
    const tspan = document.createElement("span");
    tspan.textContent = "Saved Searches";
    title.appendChild(tspan);

    if (SHOW_MENU) {
      const menu = document.createElement("span");
      menu.className = "menu";
      menu.title = "Import/Export/Edit";
      menu.textContent = "⋯";
      menu.addEventListener("click", () => {
        const action = prompt(
          "Type one of: export, import, add\n\n- export: copies current list as JSON\n- import: paste JSON array of {name,q}\n- add: add one item as: Name::query"
        );
        if (!action) return;
        const a = action.toLowerCase();
        if (a === "export") {
          navigator.clipboard.writeText(JSON.stringify(loadSaved(), null, 2));
          alert("Copied JSON to clipboard.");
        } else if (a === "import") {
          const json = prompt('Paste JSON array of {"name":"…","q":"…"}:');
          if (!json) return;
          try { const arr = JSON.parse(json); if (!Array.isArray(arr)) throw new Error("not an array"); saveSaved(arr); mount(true); }
          catch(e){ alert("Import failed: " + e.message); }
        } else if (a === "add") {
          const line = prompt('Enter as: Name::query\nExample: Urgent::from:boss@example.com is:unread');
          if (!line || !line.includes("::")) return;
          const [name, q] = line.split("::");
          const arr = loadSaved(); arr.push({ name: name.trim(), q: q.trim() }); saveSaved(arr); mount(true);
        }
      });
      title.appendChild(menu);
    }

    const list = document.createElement("div");
    list.className = "list";

    const saved = loadSaved();
    if (!saved.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No saved searches yet.";
      list.appendChild(empty);
    } else {
      for (const { name, q } of saved) {
        const btn = document.createElement("button");
        btn.className = "item";
        btn.type = "button";
        btn.textContent = name;
        btn.addEventListener("click", () => gotoQuery(q));
        list.appendChild(btn);
      }
    }

    container.appendChild(title);
    container.appendChild(list);
    shadow.append(style, container);
    return host;
  }

  // Try to anchor the panel below the "Labels" header; else append at end.
  function insertPanel(nav, panel) {
    // Find an element whose text is exactly "Labels"
    const textNodes = Array.from(nav.querySelectorAll("span,div,button"));
    const labelsHeader = textNodes.find(
      (n) => n.textContent && n.textContent.trim() === "Labels"
    );
    if (labelsHeader && labelsHeader.parentElement) {
      labelsHeader.parentElement.insertAdjacentElement("afterend", panel);
      return;
    }
    // Fallback: append at end (keeps it low, avoiding the Inbox area)
    nav.append(panel);
  }

  function mount(forceRerender = false) {
    const nav = findLeftNav();
    if (!nav) return;
    const old = document.getElementById("tm-saved-searches-host");
    if (old && !forceRerender) return; // already mounted; avoid moving it

    if (old) old.remove();
    const panel = buildShadowPanel();
    insertPanel(nav, panel);
  }

  // Only remount if Gmail actually removes our host
  const observer = new MutationObserver(() => {
    if (findLeftNav() && !document.getElementById("tm-saved-searches-host")) {
      mount();
    }
  });

  function start() {
    mount();
    observer.observe(document.documentElement, { childList: true, subtree: true });
    // NOTE: intentionally no 'hashchange' listener anymore (prevents jumping)
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else { start(); }
})();
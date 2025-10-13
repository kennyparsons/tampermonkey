// ==UserScript==
// @name         Session Keepalive
// @namespace    https://github.com/kennyparsons/tampermonkey
// @version      1.0.2
// @description  Periodically pings the CURRENT page URL (with jitter + backoff) to help keep web sessions alive. Does NOT pause when tab is hidden.
// @author       Kenny Parsons
// @icon         https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico
// @homepageURL  https://github.com/kennyparsons/tampermonkey
// @updateURL    https://raw.githubusercontent.com/kennyparsons/tampermonkey/main/scripts/session-keepalive.user.js
// @downloadURL  https://raw.githubusercontent.com/kennyparsons/tampermonkey/main/scripts/session-keepalive.user.js
// @match        *://*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const CONFIG = {
    BASE_INTERVAL_MS: 4 * 60 * 1000, // 4 min
    ONLY_WHEN_VISIBLE: false,        // <-- never pause due to tab visibility
    BACKOFF: { enabled: true, startMs: 10_000, maxMs: 5 * 60_000, factor: 1.8, jitter: 0.2 },
    STOP_ON_STATUS: [401, 403],
    DEBUG: true
  };

  // --- Logging ---
  const COLOR = { info: "color:#03A9F4;", warn: "color:#FF9800;", err: "color:#E91E63;" };
  const ts = () => new Date().toISOString().replace("T", " ").replace("Z", "");
  const logBase = (p, c, ...a) => CONFIG.DEBUG && console.log(`%c[Keepalive ${p}] ${ts()}:`, c, ...a);
  const logInfo = (...a) => logBase("INFO", COLOR.info, ...a);
  const logWarn = (...a) => logBase("WARN", COLOR.warn, ...a);
  const logError = (...a) => logBase("ERR", COLOR.err, ...a);

  // --- Helpers ---
  const rand = (min, max) => Math.random() * (max - min) + min;
  const jitter = (v, pct) => v * (1 + rand(-pct, pct));
  const nextInterval = (b) => jitter(b, 0.3);
  const nextBackoffDelay = (s) => {
    const B = CONFIG.BACKOFF;
    if (!B.enabled) return CONFIG.BASE_INTERVAL_MS;
    const d = Math.min(B.maxMs, (s.backoffDelay ?? B.startMs) * (s.backoffDelay ? B.factor : 1));
    return jitter(d, B.jitter);
  };

  // --- Core ping ---
  async function pingOnce(state, targetUrl) {
    try {
      const res = await fetch(targetUrl, { method: "GET", credentials: "include", cache: "no-store" });
      logInfo(`Ping → GET ${targetUrl} → ${res.status}${res.ok ? " OK" : ""}`);

      if (CONFIG.STOP_ON_STATUS.includes(res.status)) {
        state.stopped = true;
        state.reason = `Stopped on status ${res.status}`;
        return false;
      }
      return !!res.ok;
    } catch (e) {
      logWarn("Ping failed:", e && e.message ? e.message : e);
      return false;
    }
  }

  // --- Scheduler ---
  function startKeepalive(targetUrl) {
    const s = { timer: null, backoffDelay: null, stopped: false, reason: null };
    const schedule = (ms) => { clearTimeout(s.timer); s.timer = setTimeout(tick, ms); logInfo("Next tick in", Math.round(ms / 1000), "s"); };

    const tick = async () => {
      if (s.stopped) return;

      // No visibility check — keep pinging regardless of hidden/visible
      const ok = await pingOnce(s, targetUrl);
      if (s.stopped) { logError("Stopping:", s.reason); return; }

      if (ok) {
        s.backoffDelay = null;
        schedule(nextInterval(CONFIG.BASE_INTERVAL_MS));
      } else {
        s.backoffDelay = nextBackoffDelay(s);
        logWarn(`Backing off for ${Math.round(s.backoffDelay / 1000)}s`);
        schedule(s.backoffDelay);
      }
    };

    schedule(nextInterval(CONFIG.BASE_INTERVAL_MS));
    return s;
  }

  // --- Bootstrap ---
  (function init() {
    try { if (window.top !== window.self) return; } catch {}
    const targetUrl = location.href;
    logInfo("Initializing keepalive for", targetUrl);
    const state = startKeepalive(targetUrl);
    if (CONFIG.DEBUG) window.__KEEPALIVE_STATE__ = state;
  })();
})();
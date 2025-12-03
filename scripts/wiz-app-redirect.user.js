// ==UserScript==
// @name         Wiz App Redirect
// @namespace    https://github.com/kennyparsons/tampermonkey
// @version      0.1
// @description  Redirects app.wiz.io to demo.wiz.io
// @author       Gemini
// @homepageURL  https://github.com/kennyparsons/tampermonkey
// @updateURL    https://raw.githubusercontent.com/kennyparsons/tampermonkey/main/scripts/wiz-app-redirect.user.js
// @downloadURL  https://raw.githubusercontent.com/kennyparsons/tampermonkey/main/scripts/wiz-app-redirect.user.js
// @match        https://app.wiz.io/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    if (window.location.hostname === 'app.wiz.io') {
        window.location.replace(window.location.href.replace('app.wiz.io', 'demo.wiz.io'));
    }
})();
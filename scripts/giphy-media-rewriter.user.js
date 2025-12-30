// ==UserScript==
// @name         Giphy Media Rewriter
// @namespace    https://github.com/kennyparsons/tampermonkey
// @version      1.0.2
// @description  Replaces media.giphy.com links with i.giphy.com, converting WebP to GIF.
// @icon         https://giphy.com/static/img/favicon.png
// @homepageURL  https://github.com/kennyparsons/tampermonkey
// @updateURL    https://raw.githubusercontent.com/kennyparsons/tampermonkey/main/scripts/giphy-media-rewriter.user.js
// @downloadURL  https://raw.githubusercontent.com/kennyparsons/tampermonkey/main/scripts/giphy-media-rewriter.user.js
// @match        *://*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const REGEX = /https?:\/\/media\d*\.giphy\.com\/media\/[^"]+\.(gif|webp)/i;

  console.log("Giphy Media Rewriter: Script loaded");

  function rewriteUrl(url) {
    if (!url) return null;
    const match = REGEX.test(url);
    // console.log(`Giphy Media Rewriter: Checking URL: ${url}, Match: ${match}`);
    if (!match) return null;
    
    let newUrl = url.replace(/media\d*\.giphy\.com/i, "i.giphy.com");
    if (newUrl.endsWith(".webp")) {
      newUrl = newUrl.replace(/\.webp$/i, ".gif");
    }
    
    const changed = newUrl !== url;
    if (changed) {
        console.log(`Giphy Media Rewriter: Rewriting ${url} -> ${newUrl}`);
    }
    return changed ? newUrl : null;
  }

  // Check current page URL for redirect
  const currentUrl = window.location.href;
  const newPageUrl = rewriteUrl(currentUrl);
  if (newPageUrl) {
      console.log(`Giphy Media Rewriter: Redirecting current page to ${newPageUrl}`);
      window.location.replace(newPageUrl);
      return; // Stop further processing if we are redirecting
  }

  function processElement(el) {
    // console.log("Giphy Media Rewriter: Processing element", el);
    if (el.tagName === "IMG" && el.src) {
      const newSrc = rewriteUrl(el.src);
      if (newSrc) {
        console.log(`Giphy Media Rewriter: Updating IMG src to ${newSrc}`);
        el.src = newSrc;
      }
    } else if (el.tagName === "A" && el.href) {
      const newHref = rewriteUrl(el.href);
      if (newHref) {
        console.log(`Giphy Media Rewriter: Updating A href to ${newHref}`);
        el.href = newHref;
      }
    }
  }

  function processRoot(root) {
    const selector = 'img[src*=".giphy.com"], a[href*=".giphy.com"]';
    const elements = root.querySelectorAll(selector);
    elements.forEach(processElement);
  }

  // Initial run
  processRoot(document);

  // Observer for dynamic content
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches && (node.matches('img[src*=".giphy.com"]') || node.matches('a[href*=".giphy.com"]'))) {
            processElement(node);
          }
          processRoot(node);
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();

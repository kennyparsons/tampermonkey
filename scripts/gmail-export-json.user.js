// ==UserScript==
// @name         Gmail Export Visible to JSON
// @namespace    https://github.com/kennyparsons/tampermonkey
// @version      0.1
// @description  Adds a button to export the currently visible email list to JSON.
// @author       Kenny Parsons
// @icon         https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico
// @homepageURL  https://github.com/kennyparsons/tampermonkey
// @updateURL    https://raw.githubusercontent.com/kennyparsons/tampermonkey/main/scripts/gmail-export-json.user.js
// @downloadURL  https://raw.githubusercontent.com/kennyparsons/tampermonkey/main/scripts/gmail-export-json.user.js
// @match        https://mail.google.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const styles = `
        #tm-gmail-export-btn {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9999;
            background-color: #1a73e8;
            color: white;
            border: none;
            border-radius: 24px;
            padding: 12px 24px;
            font-family: 'Google Sans', Roboto, Arial, sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            cursor: pointer;
            transition: background-color 0.2s, box-shadow 0.2s;
        }
        #tm-gmail-export-btn:hover {
            background-color: #1557b0;
            box-shadow: 0 6px 12px rgba(0,0,0,0.3);
        }
    `;

    function addStyle() {
        const styleSheet = document.createElement("style");
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);
    }

    function downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function getVisibleEmails(includeFullBody = false) {
        const rows = document.querySelectorAll('div[role="main"] tr[role="row"]');
        const emails = [];

        rows.forEach(row => {
            // Thread ID
            const idEl = row.querySelector('[data-legacy-thread-id]');
            const threadId = idEl ? idEl.getAttribute('data-legacy-thread-id') : null;

            // Participants
            const senderTd = row.querySelector('.yX');
            const participantsMap = new Map();
            if (senderTd) {
                senderTd.querySelectorAll('[email]').forEach(el => {
                    const email = el.getAttribute('email');
                    if (email && !participantsMap.has(email)) {
                        participantsMap.set(email, el.getAttribute('name') || el.innerText.trim());
                    }
                });
            }
            const participants = Array.from(participantsMap.entries()).map(([email, name]) => ({ name, email }));

            // Subject, Date, Snippet
            const subjectEl = row.querySelector('.bog') || row.querySelector('.y6');
            const dateCell = row.querySelector('.xW') || row.querySelector('.xY');
            const dateEl = dateCell ? dateCell.querySelector('span[title]') : null;
            const snippetEl = row.querySelector('.y2');

            const subject = subjectEl ? subjectEl.innerText.trim() : '(No Subject)';
            const fullDate = dateEl ? (dateEl.title || dateEl.getAttribute('aria-label')) : (dateCell ? dateCell.innerText.trim() : '');
            const snippet = snippetEl ? snippetEl.innerText.replace(/^-\s*/, '').trim() : '';

            emails.push({
                threadId,
                participants,
                subject,
                date: fullDate,
                snippet,
                url: threadId ? `https://mail.google.com/mail/u/0/#all/${threadId}` : null,
                rowElement: row // Temporary for deep export
            });
        });

        return emails;
    }

    async function deepExport(emails) {
        const results = [];
        const originalTitle = document.title;
        
        for (let i = 0; i < emails.length; i++) {
            const email = emails[i];
            document.title = `Exporting ${i + 1}/${emails.length}...`;
            
            // Click to open
            email.rowElement.click();
            
            // Wait for body
            let bodyEl = null;
            let participants = email.participants;
            for (let j = 0; j < 30; j++) {
                await new Promise(r => setTimeout(r, 200));
                bodyEl = document.querySelector('.a3s.aiL');
                if (bodyEl) break;
            }
            
            if (bodyEl) {
                // Try to get better participants from the opened view
                const deepParticipantsMap = new Map();
                document.querySelectorAll('[email]').forEach(el => {
                    const e = el.getAttribute('email');
                    if (e && !deepParticipantsMap.has(e)) {
                        deepParticipantsMap.set(e, {
                            name: el.getAttribute('name') || el.innerText.trim(),
                            email: e
                        });
                    }
                });
                if (deepParticipantsMap.size > 0) {
                    participants = Array.from(deepParticipantsMap.values());
                }
            }
            
            const fullBody = bodyEl ? bodyEl.innerText.trim() : 'Body not found';
            
            results.push({
                ...email,
                participants,
                fullBody,
                rowElement: undefined // Remove DOM ref
            });
            
            // Go back
            window.history.back();
            
            // Wait for list to return
            for (let j = 0; j < 30; j++) {
                await new Promise(r => setTimeout(r, 200));
                if (document.querySelector('div[role="main"] tr[role="row"]')) break;
            }
        }
        
        document.title = originalTitle;
        return results;
    }

    function createButtons() {
        if (document.getElementById('tm-gmail-export-container')) return;

        const container = document.createElement('div');
        container.id = 'tm-gmail-export-container';
        container.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        const btnQuick = document.createElement('button');
        btnQuick.className = 'tm-export-btn';
        btnQuick.innerText = 'Quick Export (List)';
        btnQuick.style.cssText = `
            background-color: #1a73e8;
            color: white;
            border: none;
            border-radius: 24px;
            padding: 10px 20px;
            font-family: inherit;
            font-size: 13px;
            font-weight: 500;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            cursor: pointer;
        `;

        const btnDeep = document.createElement('button');
        btnDeep.className = 'tm-export-btn';
        btnDeep.innerText = 'Deep Export (Full Body)';
        btnDeep.style.cssText = btnQuick.style.cssText + 'background-color: #34a853;';

        btnQuick.addEventListener('click', () => {
            const emails = getVisibleEmails().map(e => ({ ...e, rowElement: undefined }));
            if (emails.length === 0) return alert('No emails found.');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            downloadJSON(emails, `gmail_quick_export_${timestamp}.json`);
        });

        btnDeep.addEventListener('click', async () => {
            const initialEmails = getVisibleEmails();
            if (initialEmails.length === 0) return alert('No emails found.');
            
            btnDeep.disabled = true;
            btnDeep.innerText = 'Processing...';
            
            try {
                const results = await deepExport(initialEmails);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                downloadJSON(results, `gmail_deep_export_${timestamp}.json`);
                btnDeep.innerText = '✅ Done';
            } catch (e) {
                console.error(e);
                alert('Export failed. See console.');
                btnDeep.innerText = 'Deep Export (Full Body)';
            } finally {
                btnDeep.disabled = false;
                setTimeout(() => { btnDeep.innerText = 'Deep Export (Full Body)'; }, 3000);
            }
        });

        container.appendChild(btnDeep);
        container.appendChild(btnQuick);
        document.body.appendChild(container);
    }

    function addStyles() {
        if (document.getElementById('tm-gmail-export-styles')) return;
        const style = document.createElement('style');
        style.id = 'tm-gmail-export-styles';
        style.textContent = `
            .tm-export-btn:hover {
                filter: brightness(0.9);
                box-shadow: 0 4px 8px rgba(0,0,0,0.3) !important;
            }
            .tm-export-btn:active {
                filter: brightness(0.8);
            }
            .tm-export-btn:disabled {
                background-color: #dadce0 !important;
                cursor: not-initialized;
            }
        `;
        document.head.appendChild(style);
    }

    function init() {
        addStyles();
        setInterval(createButtons, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

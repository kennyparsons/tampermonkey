// ==UserScript==
// @name         Gmail Export Visible to JSON
// @namespace    https://github.com/kennyparsons/tampermonkey
// @version      0.1
// @description  Adds a button to export the currently visible email list to JSON.
// @author       Kenny Parsons
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

    function getVisibleEmails() {
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
            const dateEl = row.querySelector('.xW') || row.querySelector('.xY span');
            const snippetEl = row.querySelector('.y2');

            const subject = subjectEl ? subjectEl.innerText.trim() : '(No Subject)';
            const date = dateEl ? (dateEl.title || dateEl.innerText.trim()) : '';
            const snippet = snippetEl ? snippetEl.innerText.replace(/^-\s*/, '').trim() : '';

            emails.push({
                threadId,
                participants,
                subject,
                date,
                snippet,
                url: threadId ? `https://mail.google.com/mail/u/0/#all/${threadId}` : null
            });
        });

        return emails;
    }

    function createButton() {
        if (document.getElementById('tm-gmail-export-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'tm-gmail-export-btn';
        btn.innerText = 'Export Visible JSON';
        
        btn.addEventListener('click', () => {
            const emails = getVisibleEmails();
            if (emails.length === 0) {
                alert('No emails found. Make sure you are in a list view.');
                return;
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            downloadJSON(emails, `gmail_export_${timestamp}.json`);
            
            const originalText = btn.innerText;
            btn.innerText = `✅ Exported ${emails.length}`;
            setTimeout(() => {
                btn.innerText = originalText;
            }, 3000);
        });

        document.body.appendChild(btn);
    }

    function init() {
        addStyle();
        setInterval(createButton, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

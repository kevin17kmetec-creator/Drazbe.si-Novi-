
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// =========================================================================
// AGGRESSIVE CONSOLE ERROR FILTERING & BROWSER EXTENSION NOISE REDUCTION
// Ignore Sentry 429s, CSP Font blocks from foreign iframes, and MetaMask/SES
// =========================================================================

const originalConsoleError = console.error;
console.error = function (...args) {
    const msg = args.map(a => typeof a === 'string' ? a : (a && a.message ? a.message : '')).join(' ');
    if (
        msg.includes('SES Removing unpermitted intrinsics') ||
        msg.includes('MetaMask') ||
        msg.includes('tabs:outgoing.message.ready') ||
        msg.includes('message channel closed') ||
        msg.includes('Sentry') ||
        msg.includes('429') ||
        msg.includes('default-src') ||
        msg.includes('font-src')
    ) {
        return; // Silent drop
    }
    originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = function (...args) {
    const msg = args.map(a => typeof a === 'string' ? a : (a && a.message ? a.message : '')).join(' ');
    if (msg.includes('Sentry') || msg.includes('429') || msg.includes('Messaging load timeout')) return;
    originalConsoleWarn.apply(console, args);
};

window.addEventListener('unhandledrejection', (event) => {
    const errorMsg = event.reason && event.reason.message ? event.reason.message : String(event.reason);
    if (typeof errorMsg === 'string') {
        if (
            errorMsg.includes('tabs:outgoing.message.ready') || 
            errorMsg.includes('message channel closed') ||
            errorMsg.includes('SES') ||
            errorMsg.includes('MetaMask') ||
            errorMsg.includes('connect-js')
        ) {
            event.preventDefault(); // Silences the console
        }
    }
});

window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (
        msg.includes('SES Removing unpermitted intrinsics') ||
        msg.includes('MetaMask') ||
        msg.includes('connect-js')
    ) {
        event.preventDefault(); // Silences the console
    }
});

// FAKE SENTRY GLOBALS TO STOP 429 IFRAME SPAM 
(window as any).Sentry = {
    init: () => {},
    captureException: () => {},
    captureMessage: () => {},
    withScope: () => {},
    configureScope: () => {}
};

const originalFetch = window.fetch;
try {
    Object.defineProperty(window, 'fetch', {
        value: async function (...args: any[]) {
            const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
            if (url && (url.includes('sentry.io') || url.includes('o4506076816474112'))) {
                return new Response(null, { status: 200 }); 
            }
            return originalFetch.apply(this, args as any);
        },
        writable: true,
        configurable: true
    });
} catch (e) {
    //
}

const originalXhrOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (...args) {
    if (typeof args[1] === 'string' && (args[1].includes('sentry.io') || args[1].includes('o4506076816474112'))) {
        args[1] = '/_dev_null';
    }
    return originalXhrOpen.apply(this, args);
};

// =========================================================================

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

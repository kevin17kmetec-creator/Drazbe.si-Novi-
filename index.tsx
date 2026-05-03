
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// AGGRESSIVE CONSOLE ERROR FILTERING
const originalConsoleError = console.error;
console.error = function (...args) {
    const msg = args.map(a => typeof a === 'string' ? a : (a?.message || '')).join(' ');
    if (
        msg.includes('SES Removing unpermitted intrinsics') ||
        msg.includes('MetaMask') ||
        msg.includes('tabs:outgoing.message.ready') ||
        msg.includes('message channel closed') ||
        msg.includes('Sentry') ||
        msg.includes('429') ||
        msg.includes('default-src') || // CSP warnings that we can't control from Stripe
        msg.includes('font-src')
    ) {
        return; // Silent drop
    }
    originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = function (...args) {
    const msg = args.map(a => typeof a === 'string' ? a : (a?.message || '')).join(' ');
    if (msg.includes('Sentry') || msg.includes('429') || msg.includes('Messaging load timeout')) return;
    originalConsoleWarn.apply(console, args);
};

window.addEventListener('unhandledrejection', (event) => {
    const errorMsg = event.reason?.message || event.reason || '';
    if (typeof errorMsg === 'string') {
        if (
            errorMsg.includes('tabs:outgoing.message.ready') || 
            errorMsg.includes('message channel closed') ||
            errorMsg.includes('SES') ||
            errorMsg.includes('MetaMask') ||
            errorMsg.includes('connect-js') // Stripe IFRAME async unhandled
        ) {
            event.preventDefault(); // Silences the console and prevents Sentry capture
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

// VERY AGGRESSIVE XHR/FETCH INTERCEPTION TO SENTRY TO STOP 429 SPAM
const originalFetch = window.fetch;
try {
    Object.defineProperty(window, 'fetch', {
        value: async function (...args: any[]) {
            const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
            if (url && url.includes('sentry.io')) {
                // Mock successful sentry drop
                return new Response(null, { status: 200 }); 
            }
            return originalFetch.apply(this, args as any);
        },
        writable: true,
        configurable: true
    });
} catch (e) {
    // Failsafe if defineProperty fails
    console.debug('Failed to override window.fetch');
}

const originalXhrOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (...args) {
    if (typeof args[1] === 'string' && args[1].includes('sentry.io')) {
        // Divert to a local blackhole instead of spamming Sentry
        args[1] = '/_blackhole_sentry';
    }
    return originalXhrOpen.apply(this, args);
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

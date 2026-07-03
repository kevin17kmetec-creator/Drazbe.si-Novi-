import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== "undefined") {
  // Ultra-aggressive global error silencer for extensions
  const silentPatterns = ["tabs:outgoing", "tabs:outgoing.message.ready", "SES", "MetaMask", "lockdown", "contentscript", "wallet", "ethereum", "inpage.js", "chrome-extension", "moz-extension"];
  
  const shouldSilence = (msg: any) => {
    if (!msg) return false;
    const msgStr = typeof msg === 'string' ? msg.toLowerCase() : String(msg).toLowerCase();
    return silentPatterns.some(pattern => msgStr.includes(pattern.toLowerCase()));
  };

  const silenceEvent = (event: Event) => {
    let msg = "";
    if (event instanceof ErrorEvent) {
      msg = event.message || (event.error && event.error.message) || "";
    } else if (event instanceof PromiseRejectionEvent) {
      msg = (event.reason && (event.reason.message || event.reason.toString())) || "";
    }
    
    if (shouldSilence(msg)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  window.addEventListener("error", silenceEvent, true);
  window.addEventListener("unhandledrejection", silenceEvent, true);

  // Deep monkey-patch of console
  const methods = ['error', 'warn', 'info', 'log', 'debug'] as const;
  methods.forEach(method => {
    const original = console[method];
    console[method] = (...args) => {
      const msg = args.map(a => {
        try {
          return typeof a === 'string' ? a : (a?.message || JSON.stringify(a) || '');
        } catch(e) {
          return String(a);
        }
      }).join(' ');
      if (shouldSilence(msg)) return;
      original(...args);
    };
  });

  // Protect global fetch from extensions
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      return await originalFetch(...args);
    } catch (error: any) {
      if (shouldSilence(error?.message || "")) {
        return new Response(null, { status: 500, statusText: 'Silenced Extension Error' });
      }
      throw error;
    }
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <App />
  </StrictMode>,
);

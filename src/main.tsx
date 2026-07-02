import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== "undefined") {
  const silentPatterns = ["tabs:outgoing.message.ready", "SES", "MetaMask", "lockdown", "contentscript.js", "wallet", "ethereum", "inpage.js"];
  
  const shouldSilence = (msg: string) => {
    if (!msg) return false;
    const msgStr = String(msg).toLowerCase();
    return silentPatterns.some(pattern => msgStr.includes(pattern.toLowerCase()));
  };

  const silenceEvent = (event: ErrorEvent | PromiseRejectionEvent) => {
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

  // Aggressive monkey-patching of console methods
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const msg = args.map(a => (typeof a === 'string' ? a : (a?.message || ''))).join(' ');
    if (shouldSilence(msg)) return;
    originalConsoleError(...args);
  };
  
  const originalConsoleWarn = console.warn;
  console.warn = (...args) => {
    const msg = args.map(a => (typeof a === 'string' ? a : (a?.message || ''))).join(' ');
    if (shouldSilence(msg)) return;
    originalConsoleWarn(...args);
  };

  // Prevent extensions from overriding window fetch or XHR with unhandled exceptions
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


import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

window.addEventListener('unhandledrejection', (event) => {
    const errorMsg = event.reason?.message || event.reason || '';
    if (typeof errorMsg === 'string') {
        if (
            errorMsg.includes('tabs:outgoing.message.ready') || 
            errorMsg.includes('message channel closed') ||
            errorMsg.includes('SES') ||
            errorMsg.includes('MetaMask')
        ) {
            event.preventDefault(); // Silences the console and prevents Sentry capture
        }
    }
});

window.addEventListener('error', (event) => {
    if (
        event.message.includes('SES Removing unpermitted intrinsics') ||
        event.message.includes('MetaMask')
    ) {
        event.preventDefault(); // Silences the console
    }
});

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

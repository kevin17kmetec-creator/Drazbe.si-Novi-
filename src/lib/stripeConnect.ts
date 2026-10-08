import { loadConnectAndInitialize } from '@stripe/connect-js';
import { getAuthHeaders } from './authFetch';

// Kommentar auf Deutsch: Speichert die aktuelle Ansicht (onboarding oder manage)
let currentScope: 'onboarding' | 'manage' = 'onboarding';
let stripeConnectInstance: any = null;

export function setStripeConnectScope(scope: 'onboarding' | 'manage') {
  currentScope = scope;
}

export function getStripeConnectInstance() {
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
  if (!publishableKey || !publishableKey.startsWith('pk_')) {
    return null;
  }

  if (stripeConnectInstance) {
    return stripeConnectInstance;
  }

  // Kommentar auf Deutsch: Erstellt die einzige Instanz fuer die Stripe Connect-Komponenten
  stripeConnectInstance = loadConnectAndInitialize({
    publishableKey: publishableKey,
    fetchClientSecret: async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/stripe-account-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: JSON.stringify({ scope: currentScope })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error creating account session');
        }
        const data = await res.json();
        return data.client_secret;
      } catch (err: any) {
        console.error("Error in fetchClientSecret:", err);
        throw err;
      }
    },
    locale: 'sl-SI',
    appearance: {
      variables: {
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        colorPrimary: '#0A1128',
        buttonPrimaryColorBackground: '#0A1128',
        buttonPrimaryColorText: '#FFFFFF',
        borderRadius: '16px'
      }
    }
  });

  return stripeConnectInstance;
}

export function logoutStripeConnect() {
  if (stripeConnectInstance) {
    try {
      stripeConnectInstance.logout();
    } catch (e) {
      console.warn("Error during Stripe Connect logout:", e);
    }
    stripeConnectInstance = null;
  }
}

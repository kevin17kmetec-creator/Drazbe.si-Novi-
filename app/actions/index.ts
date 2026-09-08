'use server';

import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

/**
 * Server Actions za drazbe.si
 * Zagotavljajo varno komunikacijo z backendom, preprečujejo JSON.parse napake
 * in omogočajo robustno obravnavo napak ter nalagalnih stanj.
 */

interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Varen ovitek okoli klicev na backend, ki dosledno preverja status odgovora
 * ter preprečuje zrušitve zaradi nepričakovanih HTML strani ob napakah.
 */
function getBaseUrl(): string {
  if (typeof window !== 'undefined') return '';
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VITE_APP_URL || 'http://localhost:3000';
}

async function safeApiCall<T = any>(url: string, options?: RequestInit): Promise<ActionResponse<T>> {
  try {
    const fullUrl = url.startsWith('http') ? url : `${getBaseUrl()}${url}`;
    const res = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });

    const contentType = res.headers.get('content-type') || '';

    if (!res.ok) {
      let errorMsg = `Napaka strežnika (${res.status})`;
      try {
        if (contentType.includes('application/json')) {
          const errData = await res.json();
          errorMsg = errData.error || errData.message || errorMsg;
        } else {
          const text = await res.text();
          if (text && text.length < 250 && !text.includes('<!DOCTYPE') && !text.includes('<html')) {
            errorMsg = text;
          }
        }
      } catch (e) {
        // Fallback na privzeto sporočilo
      }
      return { success: false, error: errorMsg };
    }

    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (data && data.error) {
        return { success: false, error: data.error };
      }
      return { success: true, data };
    }

    return { success: true };
  } catch (err: any) {
    console.error(`[API Action Error] ${url}:`, err);
    return {
      success: false,
      error: err?.message || 'Napaka pri povezavi s strežnikom.',
    };
  }
}

/**
 * Neposredno ustvari Stripe Checkout sejo preko Stripe SDK
 */
export async function createCheckoutSessionAction(planOrParams?: any): Promise<{
  url: string | null;
  sessionId?: string;
  success?: boolean;
  error?: string;
}> {
  'use server';
  try {
    const stripeInstance = getStripe();
    if (!stripeInstance) {
      // V okoljih, kjer STRIPE_SECRET_KEY ni neposredno dostopen (npr. brskalnik),
      // se ob klicu varno povežemo s strežniško končno točko
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          typeof planOrParams === 'string'
            ? { type: 'subscription', planId: planOrParams }
            : (planOrParams || {})
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Napaka pri vzpostavitvi seje za plačilo.');
      }
      return {
        url: data.url || null,
        sessionId: data.sessionId,
        success: true,
      };
    }

    let planId: string | undefined;
    let amount = 20;
    let title = 'Naročnina';
    let currency = 'eur';
    let returnUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.drazbe.si';
    let sessionMetadata: Record<string, any> = { type: 'subscription' };
    let customerEmail: string | undefined;

    if (typeof planOrParams === 'string') {
      planId = planOrParams;
      const upper = planId.toUpperCase();
      if (upper.includes('PRO')) {
        amount = 50;
        title = 'Naročnina Pro - drazbe.si';
      } else if (upper.includes('BASIC')) {
        amount = 20;
        title = 'Naročnina Basic - drazbe.si';
      } else {
        title = `Naročnina ${planId} - drazbe.si`;
      }
      sessionMetadata = {
        type: 'subscription',
        planId,
      };
    } else if (typeof planOrParams === 'object' && planOrParams !== null) {
      planId = planOrParams.planId || planOrParams.tier;
      if (typeof planOrParams.amount === 'number' && planOrParams.amount > 0) {
        amount = planOrParams.amount;
      } else if (planId) {
        const upper = String(planId).toUpperCase();
        amount = upper.includes('PRO') ? 50 : 20;
      }

      if (planOrParams.title) {
        title = planOrParams.title;
      } else if (planId) {
        title = `Naročnina ${planId} - drazbe.si`;
      } else {
        title = 'Plačilo - drazbe.si';
      }

      if (planOrParams.currency) currency = planOrParams.currency;
      if (planOrParams.return_url) returnUrl = planOrParams.return_url;

      sessionMetadata = {
        type: planOrParams.type || (planId ? 'subscription' : 'auction'),
        ...(planId ? { planId } : {}),
        ...(planOrParams.auction_id ? { auction_id: planOrParams.auction_id } : {}),
        ...(planOrParams.buyer_id || planOrParams.user_id ? { buyer_id: planOrParams.buyer_id || planOrParams.user_id } : {}),
        ...(planOrParams.seller_id ? { seller_id: planOrParams.seller_id } : {}),
        ...(planOrParams.metadata || {}),
      };

      if (planOrParams.buyer_data?.email) {
        customerEmail = planOrParams.buyer_data.email;
      }
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: title,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: sessionMetadata,
      mode: 'payment',
      success_url: returnUrl.includes('/stripe-callback.html')
        ? `${returnUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`
        : `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: returnUrl.includes('/stripe-callback.html')
        ? `${returnUrl}?payment=cancel`
        : `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}payment=cancel`,
    };

    if (customerEmail) {
      sessionParams.customer_email = customerEmail;
    }

    const session = await stripeInstance.checkout.sessions.create(sessionParams);

    return {
      url: session.url,
      sessionId: session.id,
      success: true,
    };
  } catch (error: any) {
    console.error('Napaka pri ustvarjanju Stripe seje:', error);
    return {
      url: null,
      success: false,
      error: error?.message || 'Napaka pri vzpostavitvi povezave s sistemom Stripe.',
    };
  }
}

/**
 * Plačilo dražbe s sredstvi iz denarnice
 */
export async function walletPayAuctionAction(params: {
  amount: number;
  auction_id?: string;
  buyer_id?: string;
  buyer_data?: any;
  [key: string]: any;
}): Promise<ActionResponse> {
  'use server';
  return safeApiCall('/api/payments/wallet-pay-auction', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Potrditev Stripe Checkout seje
 */
export async function confirmCheckoutSessionAction(params: {
  sessionId?: string;
  auctionId?: string;
}): Promise<ActionResponse> {
  'use server';
  return safeApiCall('/api/confirm-checkout-session', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Ustvarjanje nove dražbe
 */
export async function createAuctionAction(params: {
  itemData: any;
  user_id: string;
}): Promise<ActionResponse<{ id?: string }>> {
  'use server';
  return safeApiCall<{ id?: string }>('/api/auctions/create', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Zahtevek za izplačilo sredstev iz denarnice
 */
export async function requestPayoutAction(params: {
  user_id: string;
  amount: number;
}): Promise<ActionResponse> {
  'use server';
  return safeApiCall('/api/payouts/withdraw', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Pridobitev Stripe Connect povezave za onboarding
 */
export async function getStripeAccountLinkAction(params: {
  user_id: string;
  userId?: string;
  return_url: string;
  refresh_url: string;
}): Promise<ActionResponse<{ url?: string }>> {
  'use server';
  return safeApiCall<{ url?: string }>('/api/stripe-account-link', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Preverjanje statusa Stripe računa
 */
export async function checkStripeAccountStatusAction(params: {
  user_id: string;
}): Promise<ActionResponse<{ complete?: boolean; account?: any }>> {
  'use server';
  return safeApiCall<{ complete?: boolean; account?: any }>('/api/stripe-check-account-status', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Obvestilo ob preseženi ponudbi
 */
export async function notifyOutbidAction(params: {
  auction_id: string;
  outbid_user_id: string;
  new_price: number;
}): Promise<ActionResponse> {
  'use server';
  return safeApiCall('/api/notify-outbid', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Sprožitev preverjanja zaključenih dražb
 */
export async function checkAuctionsCronAction(): Promise<ActionResponse> {
  'use server';
  return safeApiCall('/api/cron/check-auctions', {
    method: 'POST',
  });
}

/**
 * Analiza računa poštnine preko AI
 */
export async function analyzeReceiptAction(params: {
  imageUrl: string;
}): Promise<ActionResponse<{ shipping_cost?: number | null }>> {
  'use server';
  return safeApiCall<{ shipping_cost?: number | null }>('/api/analyze-receipt', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}



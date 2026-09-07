'use server';

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
async function safeApiCall<T = any>(url: string, options?: RequestInit): Promise<ActionResponse<T>> {
  try {
    const res = await fetch(url, {
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
 * Ustvari Stripe Checkout sejo za plačilo naročnine ali dražbe
 */
export async function createCheckoutSessionAction(params: {
  amount: number;
  return_url?: string;
  buyer_data?: any;
  [key: string]: any;
}): Promise<ActionResponse<{ url?: string; sessionId?: string }>> {
  'use server';
  return safeApiCall<{ url?: string; sessionId?: string }>('/api/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify(params),
  });
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



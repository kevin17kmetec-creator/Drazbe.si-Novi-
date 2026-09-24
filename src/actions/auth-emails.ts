'use server';

interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  fallbackToClient?: boolean;
}

function getBaseUrl(): string {
  if (typeof window !== 'undefined') return '';
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VITE_APP_URL || 'http://localhost:3000';
}

async function safeAuthApiCall<T = any>(endpoint: string, payload: any): Promise<ActionResponse<T>> {
  try {
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${getBaseUrl()}${endpoint}`;
    
    // Poskusi dodati auth token
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (typeof window !== 'undefined') {
      try {
        const { auth } = await import('@/src/lib/firebase');
        const token = await auth.currentUser?.getIdToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch (e) {}
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    let res: Response;
    try {
      res = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      let errorMsg = `Napaka strežnika (${res.status})`;
      let fallbackToClient = false;
      try {
        const errData = await res.json();
        errorMsg = errData.error || errData.message || errorMsg;
        fallbackToClient = !!errData.fallbackToClient;
      } catch (e) {}
      return { success: false, error: errorMsg, fallbackToClient };
    }

    const data = await res.json().catch(() => ({}));
    if (data.fallbackToClient) {
      return { success: false, fallbackToClient: true, error: data.message };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, fallbackToClient: true, error: err?.message || 'Napaka pri povezavi s strežnikom.' };
  }
}

export async function sendEmailVerificationAction(email: string, displayName?: string) {
  return safeAuthApiCall('/api/auth/send-verification', { email, displayName });
}

export async function sendPasswordResetAction(email: string) {
  return safeAuthApiCall('/api/auth/send-password-reset', { email });
}

export async function sendEmailChangedNotificationAction(email: string) {
  return safeAuthApiCall('/api/auth/send-email-changed', { email });
}

export async function sendMfaEnrollmentNotificationAction(email: string) {
  return safeAuthApiCall('/api/auth/send-mfa-enrollment', { email });
}

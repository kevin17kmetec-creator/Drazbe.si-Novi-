'use client';

interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

function getBaseUrl(): string {
  if (typeof window !== 'undefined') return '';
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VITE_APP_URL || 'http://localhost:3000';
}

export async function verifyCaptchaAction(token: string): Promise<ActionResponse> {
  try {
    const fullUrl = `${getBaseUrl()}/api/auth/verify-captcha`;
    
    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    if (!res.ok) {
      let errorMsg = `Napaka strežnika (${res.status})`;
      try {
        const errData = await res.json();
        errorMsg = errData.error || errData.message || errorMsg;
      } catch (e) {}
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Napaka pri povezavi s strežnikom.' };
  }
}

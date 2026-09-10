'use client';

interface ActionResponse<T = any> {
  success: boolean;
  score?: number;
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

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data.error || data.message || `Napaka strežnika (${res.status})`;
      return { success: false, score: data.score, error: errorMsg, data };
    }

    return { success: true, score: data.score, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Napaka pri povezavi s strežnikom.' };
  }
}

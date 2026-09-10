export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    if (!token) {
      return Response.json({ success: false, error: "Manjka reCAPTCHA žeton." }, { status: 400 });
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      return Response.json(
        { success: false, error: "Sistemska napaka: reCAPTCHA ni pravilno konfigurirana na strežniku." },
        { status: 500 }
      );
    }

    const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: secretKey,
        response: token
      }).toString()
    });

    const data = await verifyRes.json();
    console.log("reCAPTCHA Google API Response:", data);

    // VERIFIKACIJA: Mejni prag je 0.5
    if (!data.success || data.score < 0.5) {
      return Response.json(
        { success: false, score: data.score, error: "Zaznana neobičajna dejavnost. Prijava onemogočena." },
        { status: 400 }
      );
    }

    return Response.json({ success: true, score: data.score });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

import Stripe from 'stripe';
import { Resend } from 'resend';
import { adminDb } from '../lib/firebase-admin';

// Deutscher Kommentar: Eigener Stripe-Client, damit kein Zirkelimport mit app.ts noetig ist
let stripeClient: Stripe | null = null;
function getStripeClient(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

// Deutscher Kommentar: Storniert eine schwebende Bankueberweisung sicher, verhindert Doppelzahlung und setzt die letzte Chance
export async function cancelAuctionBankTransfer(
  auctionId: string,
  _auctionData: any,
  mode: 'failed' | 'switch_to_card' = 'failed'
): Promise<{ success: boolean; reason?: string }> {
  const auctionRef = adminDb.collection('auctions').doc(auctionId);

  // Deutscher Kommentar: Vorab pruefen, ob Auktion existiert und ob sie bereits bezahlt ist
  const snap = await auctionRef.get();
  if (!snap.exists) return { success: false, reason: 'not_found' };
  const data: any = snap.data() || {};
  if (data.payment_status === 'paid' || data.post_auction_status === 'paid') {
    return { success: false, reason: 'already_paid' };
  }
  if (data.bank_transfer_pending !== true) {
    return { success: false, reason: 'not_pending' };
  }

  const sessionId = data.bank_transfer_session_id;
  const buyerId = data.winner_id || data.winnerId || data.second_winner_id || data.secondWinnerId;

  // Deutscher Kommentar: Schritt 1 - Pruefen, ob die Bankueberweisung beim Zahlungsanbieter bereits bezahlt oder in Bearbeitung ist
  if (sessionId) {
    try {
      const stripe = getStripeClient();
      const sess = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] });
      const pi: any = typeof sess.payment_intent === 'object' ? sess.payment_intent : null;
      const isPaidOrProcessing =
        sess.payment_status === 'paid' ||
        sess.status === 'complete' ||
        pi?.status === 'succeeded' ||
        pi?.status === 'processing';

      if (isPaidOrProcessing) {
        console.warn(`[CancelBankTransfer] Cannot cancel session ${sessionId}: already paid or processing`);
        return { success: false, reason: 'already_paid_or_processing' };
      }

      // Deutscher Kommentar: Wenn noch nicht bezahlt/in Bearbeitung, Session bzw. PaymentIntent stornieren
      const piId = typeof sess.payment_intent === 'string' ? sess.payment_intent : sess.payment_intent?.id;
      if (piId) {
        try {
          await stripe.paymentIntents.cancel(piId);
          console.log(`[CancelBankTransfer] Cancelled PaymentIntent ${piId} for session ${sessionId}`);
        } catch (cErr: any) {
          await stripe.checkout.sessions.expire(sessionId);
        }
      } else {
        await stripe.checkout.sessions.expire(sessionId);
        console.log(`[CancelBankTransfer] Expired checkout session ${sessionId}`);
      }
    } catch (err: any) {
      console.warn(`[CancelBankTransfer] Warn: session cancel failed for ${sessionId}: ${err.message}`);
    }
  }

  // Deutscher Kommentar: Schritt 2 - Transaktion in Firestore, um den Zustand atomar zurueckzusetzen
  let claimed: any = null;
  let newDeadline = '';
  try {
    await adminDb.runTransaction(async (tx) => {
      const txSnap = await tx.get(auctionRef);
      if (!txSnap.exists) return;
      const txData: any = txSnap.data() || {};
      if (txData.payment_status === 'paid' || txData.post_auction_status === 'paid') return;
      if (txData.bank_transfer_pending !== true) return;

      const currentDeadlineMs = new Date(txData.payment_deadline || 0).getTime();
      const minDeadlineMs = Date.now() + 24 * 60 * 60 * 1000;
      newDeadline = new Date(Math.max(currentDeadlineMs || 0, minDeadlineMs)).toISOString();

      tx.set(auctionRef, {
        bank_transfer_pending: false,
        bank_transfer_session_id: null,
        bank_transfer_deadline_at: null,
        bank_transfer_final_chance: true,
        payment_deadline: newDeadline
      }, { merge: true });

      claimed = txData;
    });
  } catch (txErr: any) {
    console.error(`[CancelBankTransfer] Transaction failed for ${auctionId}: ${txErr.message}`);
    return { success: false, reason: 'transaction_failed' };
  }

  // Deutscher Kommentar: Ein anderer Aufrufer war schneller oder es war nichts mehr schwebend
  if (!claimed) return { success: false, reason: 'already_claimed_or_paid' };

  // Deutscher Kommentar: Schritt 3 - AML-Reservierung freigeben
  if (buyerId) {
    try {
      await adminDb.collection('aml_reservations').doc(`${buyerId}_${auctionId}`).set({
        status: 'released',
        released_at: new Date().toISOString(),
        release_reason: mode === 'switch_to_card' ? 'switch_to_card' : 'bank_transfer_cancelled'
      }, { merge: true });
    } catch (rErr: any) {
      console.error(`[CancelBankTransfer] Error releasing aml reservation: ${rErr.message}`);
    }
  }

  // Deutscher Kommentar: Schritt 4 - E-Mail nur bei fehlgeschlagener Ueberweisung versenden
  if (mode === 'failed' && buyerId && process.env.RESEND_API_KEY) {
    try {
      const buyerSnap = await adminDb.collection('users').doc(buyerId).get();
      const buyerData: any = buyerSnap.exists ? buyerSnap.data() || {} : {};
      if (buyerData.email) {
        const resendClient = new Resend(process.env.RESEND_API_KEY);
        const auctionTitle = claimed.title?.SLO || (typeof claimed.title === 'string' ? claimed.title : 'Dražba');
        await resendClient.emails.send({
          from: process.env.EMAIL_FROM || 'dražbenik.si <obvestila@drazbenik.si>',
          to: buyerData.email,
          subject: 'Nakazilo ni bilo izvedeno - drazbe.si',
          html: `
            <div style="font-family: sans-serif; line-height: 1.5; color: #1E293B;">
              <h2 style="color: #EF4444;">Nakazilo ni bilo izvedeno</h2>
              <p>Spoštovani,</p>
              <p>obveščamo vas, da nakazilo za dražbo <strong>${auctionTitle}</strong> ni bilo izvedeno.</p>
              <p>Za plačilo imate še eno priložnost: plačajte s kartico do <strong>${new Date(newDeadline).toLocaleString('sl-SI')}</strong>. Če plačila ne opravite, veljajo običajna pravila za zamudnike.</p>
              <p>Lep pozdrav,<br/>Ekipa drazbe.si</p>
            </div>
          `
        });
      }
    } catch (mailErr: any) {
      console.error(`[CancelBankTransfer] Error sending e-mail: ${mailErr.message}`);
    }
  }

  return { success: true };
}
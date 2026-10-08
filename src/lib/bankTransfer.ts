
export const BANK_TRANSFER_MIN_AMOUNT_CENTS = 5000;
export const FINAL_CHANCE_MIN_MS = 24 * 60 * 60 * 1000;

// Deutscher Kommentar: Hilfsfunktion zur Addition von Arbeitstagen (ohne Wochenende)
export function addWorkingDays(startDate: Date, days: number): Date {
  let result = new Date(startDate);
  let addedDays = 0;
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) { // 0 = Sunday, 6 = Saturday
      addedDays++;
    }
  }
  return result;
}

export function resolvePaymentDeadlineMs(source: any): number {
    if (source?.payment_deadline) return new Date(source.payment_deadline).getTime();
    const end = source?.endTime || source?.end_time;
    if (end) return new Date(end).getTime() + 48 * 60 * 60 * 1000;
    return 0;
}

export function isBankTransferAvailable(params: {
    amountCents: number;
    paymentDeadlineMs: number;
    nowMs: number;
    alreadyUsed: boolean;
}): boolean {
    const { amountCents, paymentDeadlineMs, nowMs, alreadyUsed } = params;
    return amountCents >= BANK_TRANSFER_MIN_AMOUNT_CENTS &&
           paymentDeadlineMs > nowMs &&
           !alreadyUsed;
}

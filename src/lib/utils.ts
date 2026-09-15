export const getIncrement = (amount: number) => {
  if (amount < 10) return 1;
  if (amount < 50) return 2;
  if (amount < 200) return 5;
  if (amount < 500) return 10;
  return 20;
};

export function calculateMarginalPlatformFee(currentPrice: number, subscriptionTier: string | null | undefined): number {
    let bracket1Rate = 8;
    let bracket2Rate = 5;
    let bracket3Rate = 4;

    if (subscriptionTier === 'PRO') {
        bracket1Rate = 3;
        bracket2Rate = 2.5;
        bracket3Rate = 2;
    } else if (subscriptionTier === 'BASIC') {
        bracket1Rate = 6.5;
        bracket2Rate = 4;
        bracket3Rate = 3.2;
    }

    let totalFee = 0;
    let remainingAmount = currentPrice;

    if (remainingAmount > 0) {
        const amountInBracket = Math.min(remainingAmount, 1000);
        totalFee += amountInBracket * (bracket1Rate / 100);
        remainingAmount -= amountInBracket;
    }

    if (remainingAmount > 0) {
        const amountInBracket = Math.min(remainingAmount, 4000);
        totalFee += amountInBracket * (bracket2Rate / 100);
        remainingAmount -= amountInBracket;
    }

    if (remainingAmount > 0) {
        totalFee += remainingAmount * (bracket3Rate / 100);
    }

    const absoluteMinimumFee = currentPrice * 0.02;
    if (totalFee < absoluteMinimumFee) {
        totalFee = absoluteMinimumFee;
    }

    return totalFee;
}

export const formatSeconds = (totalSeconds: number) => {
  if (totalSeconds <= 0) return "00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

export const getUserAuctionCycle = (auctions: any[], userId: string) => {
    const userAuctions = auctions
        .filter(a => a.sellerId === userId)
        .map(a => new Date(a.createdAt || a.created_at || a.endTime).getTime())
        .sort((a, b) => a - b);

    if (userAuctions.length === 0) {
        return { count: 0, resetDate: null };
    }

    const now = Date.now();
    let currentCycleStart = userAuctions[0];
    let currentCycleEnd = new Date(currentCycleStart);
    currentCycleEnd.setMonth(currentCycleEnd.getMonth() + 1);
    let currentCycleEndTime = currentCycleEnd.getTime();

    for (let i = 0; i < userAuctions.length; i++) {
        if (userAuctions[i] >= currentCycleEndTime) {
            currentCycleStart = userAuctions[i];
            currentCycleEnd = new Date(currentCycleStart);
            currentCycleEnd.setMonth(currentCycleEnd.getMonth() + 1);
            currentCycleEndTime = currentCycleEnd.getTime();
        }
    }

    if (now >= currentCycleEndTime) {
         return { count: 0, resetDate: null }; 
    }

    const countInCycle = userAuctions.filter(time => time >= currentCycleStart && time < currentCycleEndTime).length;
    return { count: countInCycle, resetDate: currentCycleEnd };
};

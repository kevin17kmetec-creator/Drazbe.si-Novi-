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

export const getUserAuctionCycle = (auctions: any[], userId: string, userData?: any) => {
    const rawTier = userData?.subscription_tier || userData?.subscription;
    let subTier = rawTier ? String(rawTier).toUpperCase() : 'FREE';
    const subPaidAt = userData?.subscription_paid_at || userData?.subscription_started_at;
    const subValidUntil = userData?.subscription_valid_until;
    const isCanceled = !!userData?.subscription_canceled;
    const now = Date.now();

    // Če je naročnina potekla in je bila preklicana ali neaktivna, preidemo na FREE
    if (subValidUntil && now > new Date(subValidUntil).getTime() && (isCanceled || userData?.subscription_active === false)) {
        subTier = 'FREE';
    }

    // 1. NAPREDNI PAKET (PRO, 50€) - Brez omejitve, štetje ni potrebno
    if (subTier === 'PRO') {
        const nextBillingOrEnd = subValidUntil ? new Date(subValidUntil) : null;
        return {
            count: 0,
            userLimit: Infinity,
            isUnlimited: true,
            resetDate: nextBillingOrEnd,
            tier: 'PRO' as const,
            isCanceled
        };
    }

    // 2. OSNOVNI PAKET (BASIC, 20€) - Štetje vezano na datum nakupa/podaljšanja do konca obdobja
    if (subTier === 'BASIC') {
        const cycleStartDate = subPaidAt ? new Date(subPaidAt) : new Date();
        const cycleStartTime = cycleStartDate.getTime();
        
        let cycleEndDate: Date;
        if (subValidUntil) {
            cycleEndDate = new Date(subValidUntil);
        } else {
            cycleEndDate = new Date(cycleStartDate);
            cycleEndDate.setMonth(cycleEndDate.getMonth() + 1);
        }
        const cycleEndTime = cycleEndDate.getTime();

        const basicAuctions = (auctions || [])
            .filter(a => (a.sellerId === userId || a.seller_id === userId))
            .map(a => {
                const timeVal = a.createdAt || a.created_at || a.endTime;
                return timeVal ? new Date(timeVal).getTime() : 0;
            })
            .filter(time => time >= cycleStartTime && time < cycleEndTime);

        return {
            count: basicAuctions.length,
            userLimit: 20,
            isUnlimited: false,
            resetDate: cycleEndDate,
            tier: 'BASIC' as const,
            isCanceled
        };
    }

    // 3. BREZPLAČNI PAKET (FREE) - 1 mesec od prve objave, po poteku se resetira in čaka na prvo novo objavo
    let freeAuctions = (auctions || [])
        .filter(a => (a.sellerId === userId || a.seller_id === userId))
        .map(a => {
            const timeVal = a.createdAt || a.created_at || a.endTime;
            return timeVal ? new Date(timeVal).getTime() : 0;
        })
        .filter(time => time > 0)
        .sort((a, b) => a - b);

    // Če je uporabnik pred tem imel naročnino, upoštevamo le dražbe po izteku naročnine
    if (subValidUntil && now > new Date(subValidUntil).getTime()) {
        const expireTime = new Date(subValidUntil).getTime();
        freeAuctions = freeAuctions.filter(time => time >= expireTime);
    }

    if (freeAuctions.length === 0) {
        return {
            count: 0,
            userLimit: 5,
            isUnlimited: false,
            resetDate: null,
            tier: 'FREE' as const,
            isCanceled: false
        };
    }

    let currentCycleStart = freeAuctions[0];
    let currentCycleEnd = new Date(currentCycleStart);
    currentCycleEnd.setMonth(currentCycleEnd.getMonth() + 1);
    let currentCycleEndTime = currentCycleEnd.getTime();

    for (let i = 0; i < freeAuctions.length; i++) {
        if (freeAuctions[i] >= currentCycleEndTime) {
            currentCycleStart = freeAuctions[i];
            currentCycleEnd = new Date(currentCycleStart);
            currentCycleEnd.setMonth(currentCycleEnd.getMonth() + 1);
            currentCycleEndTime = currentCycleEnd.getTime();
        }
    }

    // Če je pretekel mesec od zadnjega cikla, se cikel resetira in čaka na naslednjo objavo
    if (now >= currentCycleEndTime) {
        return {
            count: 0,
            userLimit: 5,
            isUnlimited: false,
            resetDate: null,
            tier: 'FREE' as const,
            isCanceled: false
        };
    }

    const countInCycle = freeAuctions.filter(time => time >= currentCycleStart && time < currentCycleEndTime).length;
    return {
        count: countInCycle,
        userLimit: 5,
        isUnlimited: false,
        resetDate: currentCycleEnd,
        tier: 'FREE' as const,
        isCanceled: false
    };
};

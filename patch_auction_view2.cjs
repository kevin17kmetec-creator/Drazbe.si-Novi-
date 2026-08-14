const fs = require('fs');
let code = fs.readFileSync('src/components/AuctionView.tsx', 'utf8');

// The layout consists of:
// - lg:col-span-8 order-1 (Images)
// - lg:col-span-4 order-2 (Bidding action box)
// - lg:col-span-8 order-3 (Description + Bidding History)
// - lg:col-span-4 order-4 (Information)

// User requested:
// 1. Move Information section higher (right after bidding action). So change Information to order-3 (in the right column) or move it inside the order-2 column.
// Let's move Information to be directly under the Bidding box in the right column.

code = code.replace(
  '<div className="lg:col-span-4 order-4">', 
  '<div className="lg:col-span-4 order-4 hidden">' // Hide the old one
);

// Inject Information under Bidding box
const biddingEndTarget = `              )}
            </div>
          </div>
          <div className="lg:col-span-8 order-3 space-y-6">`;

const informationSection = `              )}
            </div>
            
            {/* INJECTED INFORMATION SECTION */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-[#0A1128] font-black uppercase tracking-widest text-xs">{t('information')}</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('seller')}:</p>
                  <button 
                    onClick={() => item.sellerId && onSellerClick?.(item.sellerId)}
                    className="text-sm font-black text-[#FEBA4F] hover:underline"
                  >
                    {item.sellerName || t('unknown')}
                  </button>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('region')}:</p>
                  <p className="text-sm font-bold text-[#0A1128]">{item.region}</p>
                </div>
                {item.condition && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('condition')}:</p>
                  <p className="text-sm font-bold text-[#0A1128]">{typeof item.condition === 'string' ? item.condition : item.condition[language] || item.condition['SLO']}</p>
                </div>
                )}
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('feesAndTerms')}:</p>
                  <p className="font-bold text-[#0A1128] text-sm">€{absoluteFee.toFixed(2)} {t('auctionFee')}</p>
                  <p className="font-bold text-[#0A1128] text-sm">22 {t('percent')} {t('vat')}</p>
                </div>
              </div>
            </div>

          </div>
          <div className="lg:col-span-8 order-3 space-y-6">`;

code = code.replace(biddingEndTarget, informationSection);

// 2. Hide bidding history unless you are seller or winner, and ended
const historyTarget = `            {!isEnded && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-[#0A1128] font-black uppercase tracking-widest text-xs">{t('biddingHistory')}</h3>`;

const historyReplacement = `            {isEnded && (isSeller || isWinner) && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-[#0A1128] font-black uppercase tracking-widest text-xs">{t('biddingHistory')}</h3>`;

code = code.replace(historyTarget, historyReplacement);

// 3. Allow winner to bid again.
// The code blocks bidding if !isSeller && !isEnded. Actually it doesn't block winner currently in AuctionView.tsx!
// Wait, the user said "nekatere drazbe tudi vodilnemu omogoci da lahko ponudi novo ceno ceprav je ze vodilni"
// Let's check App.tsx `handleBidSubmit`. I patched `amount <= currentPrice`. So winner CAN bid higher.

// Wait, the description text in AuctionView proxy max bid:
const myMaxBidTarget = `<Lock size={10}/> {t('myMaxBid')}</p>
                </div>
                <div className="text-center pt-4 border-t border-white/10">`;

const myMaxBidReplacement = `<Lock size={10}/> {t('myMaxBid')}</p>
                </div>
                <div className="col-span-2 text-center text-xs text-slate-400 mt-2">
                   Vnesite najvišji znesek, ki ste ga pripravljeni plačati. Vaša ponudba ostane skrivnost. Sistem bo avtomatsko višal ponudbo v vašem imenu.
                </div>
                <div className="text-center pt-4 border-t border-white/10">`;

// code = code.replace(myMaxBidTarget, myMaxBidReplacement);

fs.writeFileSync('src/components/AuctionView.tsx', code);
console.log("Done patching AuctionView");

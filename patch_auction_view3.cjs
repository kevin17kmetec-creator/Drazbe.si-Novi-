const fs = require('fs');
let code = fs.readFileSync('src/components/AuctionView.tsx', 'utf8');

const target = `<div className="text-center pt-4 border-t border-white/10">
                  <p className="text-4xl font-black text-[#FEBA4F]">€ {item.currentBid || 0}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{t('currentBid')}</p>
                </div>
              </div>`;

const replacement = `<div className="text-center pt-4 border-t border-white/10">
                  <p className="text-4xl font-black text-[#FEBA4F]">€ {item.currentBid || 0}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{t('currentBid')}</p>
                </div>
              </div>
              {!isSeller && !isEnded && (
              <p className="text-[10px] font-bold text-slate-400 text-center mb-4 leading-relaxed bg-white/5 p-3 rounded-xl">
                  Vnesite najvišji znesek, ki ste ga pripravljeni plačati. Vaša maksimalna ponudba ostane skrivnost. Sistem bo samodejno višal ponudbo v vašem imenu.
              </p>
              )}`;

code = code.replace(target, replacement);

// And we need to fetch the true proxy max bid in AuctionView for the winner
const hiddenMaxBidTarget = `<p className="text-2xl font-black text-green-400">{isWinner ? \`€ \${item.hiddenMaxBid || item.hidden_max_bid || '-'}\` : '-'}</p>`;
const hiddenMaxBidReplacement = `<p className="text-2xl font-black text-green-400">{isWinner ? \`€ \${item.current_proxy_bid?.amount || item.currentProxyBid?.amount || item.hiddenMaxBid || item.hidden_max_bid || '-'}\` : '-'}</p>`;

code = code.replace(hiddenMaxBidTarget, hiddenMaxBidReplacement);

fs.writeFileSync('src/components/AuctionView.tsx', code);
console.log("Done patching AuctionView text");

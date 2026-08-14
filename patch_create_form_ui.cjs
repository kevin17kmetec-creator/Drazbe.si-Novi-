const fs = require('fs');
let code = fs.readFileSync('src/components/CreateAuctionForm.tsx', 'utf8');

const target = `<div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('category')}</label>`;

const replacement = `<div className="w-full mb-8">
                        <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                            <h3 className="text-sm font-black text-[#0A1128] uppercase tracking-wider">Način predaje</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {['both', 'pickup_only', 'shipping_only'].map((opt) => (
                                    <label key={opt} className={\`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center gap-1 \${formData.delivery_option === opt ? 'border-[#FEBA4F] bg-[#FEBA4F]/10 text-[#0A1128]' : 'border-slate-100 hover:border-[#FEBA4F]/50 text-slate-400 bg-white'}\`}>
                                        <input type="radio" name="delivery_option" value={opt} checked={formData.delivery_option === opt} onChange={(e) => setFormData({...formData, delivery_option: e.target.value})} className="hidden" />
                                        <span className="font-black text-[11px] uppercase tracking-wider text-center">
                                            {opt === 'both' ? 'Oboje (izbere kupec)' : opt === 'pickup_only' ? 'Samo osebni prevzem' : 'Samo pošiljanje'}
                                        </span>
                                    </label>
                                ))}
                            </div>
                            
                            {formData.delivery_option !== 'pickup_only' && (
                                <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Strošek pošiljanja</label>
                                    <div className="flex flex-col sm:flex-row gap-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="shipping_fee_type" value="calculated" checked={formData.shipping_fee_type === 'calculated'} onChange={(e) => setFormData({...formData, shipping_fee_type: e.target.value})} className="accent-[#FEBA4F] w-4 h-4" />
                                            <span className="text-xs font-bold text-[#0A1128]">Po obračunu (račun pošte)</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="shipping_fee_type" value="fixed" checked={formData.shipping_fee_type === 'fixed'} onChange={(e) => setFormData({...formData, shipping_fee_type: e.target.value})} className="accent-[#FEBA4F] w-4 h-4" />
                                            <span className="text-xs font-bold text-[#0A1128]">Fiksna poštnina</span>
                                        </label>
                                    </div>
                                    
                                    {formData.shipping_fee_type === 'fixed' && (
                                        <div className="pt-2">
                                            <input type="number" min="0" step="0.01" value={formData.shipping_cost} onChange={(e) => setFormData({...formData, shipping_cost: e.target.value})} className="w-full sm:w-1/2 bg-white border border-slate-200 rounded-xl py-3 px-4 font-bold focus:ring-2 focus:ring-[#FEBA4F] outline-none" placeholder="Znesek v € (npr. 5.00)" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('category')}</label>`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/CreateAuctionForm.tsx', code);
console.log("CreateAuctionForm.tsx UI patched");

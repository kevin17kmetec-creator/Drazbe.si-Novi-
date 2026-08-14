const fs = require('fs');
let code = fs.readFileSync('src/components/CreateAuctionForm.tsx', 'utf8');

// 1. Add fields to initial state
const initialDataTarget = `        minStep: '5',
        endDate: defaultDateStr,
        endTime: defaultTimeStr
    });`;
const initialDataReplacement = `        minStep: '5',
        endDate: defaultDateStr,
        endTime: defaultTimeStr,
        delivery_option: initialData?.delivery_option || 'both',
        shipping_fee_type: initialData?.shipping_fee_type || 'calculated',
        shipping_cost: initialData?.shipping_cost?.toString() || ''
    });`;

if (code.includes(initialDataTarget)) {
    code = code.replace(initialDataTarget, initialDataReplacement);
} else {
    console.error("Could not find initialDataTarget");
}

// 2. Add to onPublish
const onPublishTarget = `                condition: formData.condition,
                location: { SLO: formData.location, EN: formData.location, DE: formData.location },
                endTime: selectedEnd.toISOString(),
                images: imageUrls
            });`;
const onPublishReplacement = `                condition: formData.condition,
                location: { SLO: formData.location, EN: formData.location, DE: formData.location },
                endTime: selectedEnd.toISOString(),
                images: imageUrls,
                delivery_option: formData.delivery_option,
                shipping_fee_type: formData.shipping_fee_type,
                shipping_cost: formData.shipping_fee_type === 'fixed' ? Number(formData.shipping_cost || 0) : null
            });`;

if (code.includes(onPublishTarget)) {
    code = code.replace(onPublishTarget, onPublishReplacement);
} else {
    console.error("Could not find onPublishTarget");
}

// 3. Add to preview auctionItem
const previewTarget1 = `                                         condition: formData.condition,
                                         createdAt: new Date()
                                      } as unknown as AuctionItem}`;
const previewReplacement1 = `                                         condition: formData.condition,
                                         delivery_option: formData.delivery_option,
                                         shipping_fee_type: formData.shipping_fee_type,
                                         shipping_cost: formData.shipping_fee_type === 'fixed' ? Number(formData.shipping_cost || 0) : null,
                                         createdAt: new Date()
                                      } as unknown as AuctionItem}`;

code = code.replaceAll(previewTarget1, previewReplacement1);

// 4. Add UI form elements
const uiTarget = `<div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-4 mb-8">`;
const uiReplacement = `<div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 mb-8">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-[#FEBA4F]/10 rounded-2xl flex items-center justify-center text-[#FEBA4F]">
                                <MapPin size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-[#0A1128] uppercase tracking-tighter">Način predaje</h2>
                                <p className="text-xs font-bold text-slate-400">Kako boste predmet predali kupcu?</p>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {['both', 'pickup_only', 'shipping_only'].map((opt) => (
                                    <label key={opt} className={\`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 \${formData.delivery_option === opt ? 'border-[#FEBA4F] bg-[#FEBA4F]/10 text-[#0A1128]' : 'border-slate-100 hover:border-[#FEBA4F]/50 text-slate-400'}\`}>
                                        <input type="radio" name="delivery_option" value={opt} checked={formData.delivery_option === opt} onChange={(e) => setFormData({...formData, delivery_option: e.target.value})} className="hidden" />
                                        <span className="font-black text-xs uppercase tracking-widest text-center">
                                            {opt === 'both' ? 'Oboje (izbere kupec)' : opt === 'pickup_only' ? 'Samo osebni prevzem' : 'Samo pošiljanje'}
                                        </span>
                                    </label>
                                ))}
                            </div>
                            
                            {formData.delivery_option !== 'pickup_only' && (
                                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Strošek pošiljanja</label>
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input type="radio" name="shipping_fee_type" value="calculated" checked={formData.shipping_fee_type === 'calculated'} onChange={(e) => setFormData({...formData, shipping_fee_type: e.target.value})} className="accent-[#FEBA4F] w-5 h-5" />
                                            <span className="text-sm font-bold text-[#0A1128]">Poštnina po obračunu (račun pošte)</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input type="radio" name="shipping_fee_type" value="fixed" checked={formData.shipping_fee_type === 'fixed'} onChange={(e) => setFormData({...formData, shipping_fee_type: e.target.value})} className="accent-[#FEBA4F] w-5 h-5" />
                                            <span className="text-sm font-bold text-[#0A1128]">Fiksna poštnina</span>
                                        </label>
                                    </div>
                                    
                                    {formData.shipping_fee_type === 'fixed' && (
                                        <div className="pt-2">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Znesek poštnine (€)</label>
                                            <input type="number" min="0" step="0.01" value={formData.shipping_cost} onChange={(e) => setFormData({...formData, shipping_cost: e.target.value})} className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-6 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none" placeholder="npr. 5.00" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-4 mb-8">`;

if (code.includes(uiTarget)) {
    code = code.replace(uiTarget, uiReplacement);
} else {
    console.error("Could not find uiTarget");
}

fs.writeFileSync('src/components/CreateAuctionForm.tsx', code);
console.log("CreateAuctionForm.tsx patched");

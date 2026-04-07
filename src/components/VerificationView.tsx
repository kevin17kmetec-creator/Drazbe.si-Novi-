import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Building2, CheckCircle2 } from 'lucide-react';

export const VerificationView: React.FC<{ onBack: () => void; t: any; onVerify: (type: 'individual' | 'business', data: any) => void; isVerified: boolean; userType: any; initialData?: any }> = ({ onBack, t, onVerify, isVerified, userType, initialData }) => {
    const [type, setType] = useState<'individual' | 'business'>(userType || 'individual');
    const [step, setStep] = useState(isVerified ? 2 : 1);
    
    const [individualData, setIndividualData] = useState({
        firstName: initialData?.first_name || '',
        lastName: initialData?.last_name || '',
        street: initialData?.street || '',
        city: initialData?.city || '',
        postalCode: initialData?.postal_code || '',
        emso: initialData?.emso || ''
    });

    const [businessData, setBusinessData] = useState({
        companyName: initialData?.company_name || '',
        taxNumber: initialData?.tax_number || '',
        companyStreet: initialData?.company_street || '',
        companyCity: initialData?.company_city || '',
        companyPostalCode: initialData?.company_postal_code || '',
        representative: initialData?.representative || ''
    });

    const handleVerify = () => {
        const data = type === 'individual' ? individualData : businessData;
        onVerify(type, data);
        setStep(2);
    };

    return (
        <div className="max-w-4xl mx-auto py-16 px-6 animate-in">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-400 mb-10 font-black uppercase text-[10px] tracking-widest hover:text-[#0A1128] transition-colors"><ArrowLeft size={16}/> Nazaj</button>
            <div className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-100">
                <h2 className="text-4xl font-black mb-4 uppercase tracking-tighter italic">{t('identityVerification')}</h2>
                <p className="text-slate-400 font-bold mb-12">V skladu z 18. členom SP je za sodelovanje na dražbi obvezna verifikacija podatkov.</p>

                {step === 1 ? (
                    <div className="space-y-12">
                        <div className="flex gap-4 p-2 bg-slate-50 rounded-[2.5rem]">
                            <button 
                                disabled={isVerified}
                                onClick={() => setType('individual')} 
                                className={`flex-1 flex items-center justify-center gap-3 py-6 rounded-[2rem] font-black uppercase text-xs tracking-widest transition-all ${type === 'individual' ? 'bg-[#0A1128] text-white shadow-xl' : 'text-slate-400 hover:text-[#0A1128]'}`}>
                                <User size={18} /> {t('individual')}
                            </button>
                            <button 
                                disabled={isVerified}
                                onClick={() => setType('business')} 
                                className={`flex-1 flex items-center justify-center gap-3 py-6 rounded-[2rem] font-black uppercase text-xs tracking-widest transition-all ${type === 'business' ? 'bg-[#0A1128] text-white shadow-xl' : 'text-slate-400 hover:text-[#0A1128]'}`}>
                                <Building2 size={18} /> {t('business')}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {type === 'individual' ? (
                                <>
                                    <div className="space-y-3"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Ime</label><input type="text" value={individualData.firstName} onChange={e => setIndividualData({...individualData, firstName: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 font-bold" /></div>
                                    <div className="space-y-3"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Priimek</label><input type="text" value={individualData.lastName} onChange={e => setIndividualData({...individualData, lastName: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 font-bold" /></div>
                                    <div className="space-y-3 md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Ulica in hišna številka</label><input type="text" value={individualData.street} onChange={e => setIndividualData({...individualData, street: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 font-bold" /></div>
                                    <div className="space-y-3"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Mesto</label><input type="text" value={individualData.city} onChange={e => setIndividualData({...individualData, city: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 font-bold" /></div>
                                    <div className="space-y-3"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Poštna številka</label><input type="text" value={individualData.postalCode} onChange={e => setIndividualData({...individualData, postalCode: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 font-bold" /></div>
                                    <div className="space-y-3 md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">EMŠO</label><input type="text" value={individualData.emso} onChange={e => setIndividualData({...individualData, emso: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 font-bold" maxLength={13} /></div>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-3 md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Naziv podjetja</label><input type="text" value={businessData.companyName} onChange={e => setBusinessData({...businessData, companyName: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 font-bold" /></div>
                                    <div className="space-y-3 md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Davčna številka</label><input type="text" value={businessData.taxNumber} onChange={e => setBusinessData({...businessData, taxNumber: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 font-bold" /></div>
                                    <div className="space-y-3 md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Ulica in hišna številka (Sedež podjetja)</label><input type="text" value={businessData.companyStreet} onChange={e => setBusinessData({...businessData, companyStreet: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 font-bold" /></div>
                                    <div className="space-y-3"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Mesto</label><input type="text" value={businessData.companyCity} onChange={e => setBusinessData({...businessData, companyCity: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 font-bold" /></div>
                                    <div className="space-y-3"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Poštna številka</label><input type="text" value={businessData.companyPostalCode} onChange={e => setBusinessData({...businessData, companyPostalCode: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 font-bold" /></div>
                                    <div className="space-y-3 md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Zastopnik (Ime in priimek)</label><input type="text" value={businessData.representative} onChange={e => setBusinessData({...businessData, representative: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 font-bold" /></div>
                                </>
                            )}
                        </div>

                        <button onClick={handleVerify} className="w-full bg-[#0A1128] text-white py-6 rounded-[2rem] font-black uppercase tracking-widest hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl">Potrdi verifikacijo</button>
                    </div>
                ) : (
                    <div className="text-center py-12 space-y-8">
                        <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto shadow-sm border border-green-100"><CheckCircle2 size={48} /></div>
                        <div>
                            <h3 className="text-2xl font-black text-[#0A1128] uppercase italic mb-2">{t('verifiedStatus')}</h3>
                            <p className="text-slate-400 font-bold">Vaš profil je verificiran kot <span className="text-[#0A1128]">{type === 'individual' ? t('individual') : t('business')}</span>. Sprememba tipa računa po verifikaciji ni več mogoča.</p>
                        </div>
                        <div className="pt-8 border-t border-slate-100 grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-6 rounded-3xl text-left"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Datum verifikacije</p><p className="font-bold">{new Date().toLocaleDateString('sl-SI')}</p></div>
                            <div className="bg-slate-50 p-6 rounded-3xl text-left"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Status</p><p className="font-bold text-green-600">Aktivno</p></div>
                        </div>
                        <button onClick={onBack} className="w-full bg-[#0A1128] text-white py-6 rounded-[2rem] font-black uppercase tracking-widest hover:bg-[#FEBA4F] transition-all">Nazaj na dražbe</button>
                    </div>
                )}
            </div>
        </div>
    );
};

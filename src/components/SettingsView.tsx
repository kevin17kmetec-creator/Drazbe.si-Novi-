import React, { useState, useRef, useMemo, useEffect } from 'react';
import { User, Camera, CheckCircle2, AlertCircle, Shield, CreditCard, Building, MapPin, Key } from 'lucide-react';
import { toast } from 'sonner';
import { StripeConnectOnboarding } from './StripeConnectOnboarding';

const COUNTRIES = [
  { code: 'AT', name: 'Avstrija / Austria' },
  { code: 'BE', name: 'Belgija / Belgium' },
  { code: 'BG', name: 'Bolgarija / Bulgaria' },
  { code: 'HR', name: 'Hrvaška / Croatia' },
  { code: 'CY', name: 'Ciper / Cyprus' },
  { code: 'CZ', name: 'Češka / Czech Republic' },
  { code: 'DK', name: 'Danska / Denmark' },
  { code: 'EE', name: 'Estonija / Estonia' },
  { code: 'FI', name: 'Finska / Finland' },
  { code: 'FR', name: 'Francija / France' },
  { code: 'DE', name: 'Nemčija / Germany' },
  { code: 'GR', name: 'Grčija / Greece' },
  { code: 'HU', name: 'Madžarska / Hungary' },
  { code: 'IE', name: 'Irska / Ireland' },
  { code: 'IT', name: 'Italija / Italy' },
  { code: 'LV', name: 'Latvija / Latvia' },
  { code: 'LT', name: 'Litva / Lithuania' },
  { code: 'LU', name: 'Luksemburg / Luxembourg' },
  { code: 'MT', name: 'Malta / Malta' },
  { code: 'NL', name: 'Nizozemska / Netherlands' },
  { code: 'PL', name: 'Poljska / Poland' },
  { code: 'PT', name: 'Portugalska / Portugal' },
  { code: 'RO', name: 'Romunija / Romania' },
  { code: 'SK', name: 'Slovaška / Slovakia' },
  { code: 'SI', name: 'Slovenija / Slovenia' },
  { code: 'ES', name: 'Španija / Spain' },
  { code: 'SE', name: 'Švedska / Sweden' },
  { code: 'CH', name: 'Švica / Switzerland' },
  { code: 'GB', name: 'Velika Britanija / UK' },
  { code: 'US', name: 'Združene države / USA' },
].sort((a, b) => a.name.localeCompare(b.name));

export const SettingsView: React.FC<{ t: any; language: string; user: any; onSave: (data: any) => Promise<void>; onVerify: () => void; onStripeVerified: () => void }> = ({ t, language, user, onSave, onVerify, onStripeVerified }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'personal' | 'stripe'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [stripeStatusChecked, setStripeStatusChecked] = useState(false);

  useEffect(() => {
     if (user?.id && !stripeStatusChecked && activeTab === 'stripe') {
         setStripeStatusChecked(true);
         // Dynamically check Stripe onboarding status when they switch to this tab
         fetch('/api/stripe-check-account-status', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ user_id: user.id })
         }).then(res => res.json()).then(data => {
             if (data.complete && !user.stripe_onboarding_complete) {
                 onStripeVerified(); // trigger parent update if needed
             }
         }).catch(console.error);
     }
  }, [user?.id, activeTab, stripeStatusChecked, user?.stripe_onboarding_complete, onStripeVerified]);

  const [formData, setFormData] = useState({
    username: user?.username || '',
    firstName: user?.first_name || user?.firstName || '',
    lastName: user?.last_name || user?.lastName || '',
    email: user?.email || '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    profilePicture: user?.profile_picture_url || user?.profilePicture || '',
    
    // Individual data
    street: user?.street || '',
    city: user?.city || '',
    postalCode: user?.postal_code || '',

    // Business data
    companyName: user?.company_name || '',
    taxNumber: user?.tax_number || user?.tax_id || '',
    companyStreet: user?.company_street || '',
    companyCity: user?.company_city || '',
    companyPostalCode: user?.company_postal_code || '',
    representative: user?.representative || '',
    countryCode: user?.country_code || 'SI',
    autoInvoiceGeneration: user?.auto_invoice_generation !== false, // default true
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isVerified = user?.is_verified || user?.isVerified;
  const userType = user?.user_type || user?.userType || 'individual';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, profilePicture: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Settings form submitted with data:", formData);
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      toast.error(t('passwordsNotMatch'));
      return;
    }
    if (formData.newPassword && !formData.oldPassword) {
      toast.error(t('oldPasswordRequired'));
      return;
    }
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-12 animate-in">
      <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0A1128] mb-12">{t('settings')}</h2>
      
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Sidebar Navigation */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="bg-white rounded-[2rem] p-4 shadow-xl border border-slate-100 flex flex-col gap-2">
            <button 
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all w-full text-left ${activeTab === 'profile' ? 'bg-[#0A1128] text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-[#0A1128]'}`}
            >
                <User size={18} /> Profil in Varnost
            </button>
            <button 
                onClick={() => setActiveTab('personal')}
                className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all w-full text-left ${activeTab === 'personal' ? 'bg-[#0A1128] text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-[#0A1128]'}`}
            >
                <MapPin size={18} /> Osebni Podatki
            </button>
            <button 
                onClick={() => setActiveTab('stripe')}
                className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all w-full text-left ${activeTab === 'stripe' ? 'bg-[#0A1128] text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-[#0A1128]'}`}
            >
                <CreditCard size={18} /> Plačila in Izplačila
            </button>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1">
          <form onSubmit={handleSave} className="bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-100">
            {activeTab === 'profile' && (
              <div className="animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center justify-between mb-10 pb-10 border-b border-slate-100">
                    <div className="flex items-center gap-6">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept="image/*" 
                        className="hidden" 
                      />
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-24 h-24 rounded-full bg-slate-100 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center relative group cursor-pointer"
                      >
                        {formData.profilePicture ? (
                          <img src={formData.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <User size={40} className="text-slate-300" />
                        )}
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera className="text-white" size={24} />
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('profilePicture')}</p>
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-black uppercase tracking-widest text-[#FEBA4F] hover:text-[#0A1128] transition-colors">{t('changePicture')}</button>
                      </div>
                    </div>

                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('verificationStatus')}</p>
                        {isVerified ? (
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-full text-xs font-black uppercase tracking-widest border border-green-100">
                                <CheckCircle2 size={16} /> {t('verified')} ({userType === 'business' ? t('business') : t('individual')})
                            </div>
                        ) : (
                            <div className="flex flex-col items-end gap-3">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-500 rounded-full text-xs font-black uppercase tracking-widest border border-red-100">
                                    <AlertCircle size={16} /> {t('notVerified')}
                                </div>
                                <button 
                                    type="button" 
                                    onClick={onVerify}
                                    className="text-[10px] font-black uppercase tracking-widest bg-[#0A1128] text-white px-4 py-2 rounded-xl hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-lg"
                                >
                                    {t('verifyNow')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mb-10">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#0A1128] mb-6 flex items-center gap-2"><User size={16} className="text-[#FEBA4F]"/> {t('basicData')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('usernameLabel')}</label>
                        <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" placeholder="" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('email')}</label>
                        <input type="email" value={formData.email} disabled className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-500 outline-none cursor-not-allowed" />
                      </div>
                    </div>
                </div>

                <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 mb-8">
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#0A1128] mb-6 flex items-center gap-2"><Key size={16} className="text-[#FEBA4F]"/> {t('changePassword')}</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('oldPassword')}</label>
                      <input type="password" placeholder="••••••••" value={formData.oldPassword} onChange={e => setFormData({...formData, oldPassword: e.target.value})} autoComplete="new-password" data-lpignore="true" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('newPassword')}</label>
                      <input type="password" placeholder="••••••••" value={formData.newPassword} onChange={e => setFormData({...formData, newPassword: e.target.value})} autoComplete="new-password" data-lpignore="true" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('confirmNewPassword')}</label>
                      <input type="password" placeholder="••••••••" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} autoComplete="new-password" data-lpignore="true" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" />
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={isSaving} className="w-full bg-[#0A1128] text-white py-5 rounded-[2rem] font-black uppercase tracking-widest hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl flex items-center justify-center gap-3">
                  {isSaving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      {t('processing')}
                    </>
                  ) : (
                    t('saveChanges')
                  )}
                </button>
              </div>
            )}

            {activeTab === 'personal' && (
              <div className="animate-in fade-in slide-in-from-right-4">
                {!isVerified ? (
                    <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                        <div className="w-20 h-20 bg-red-100 rounded-full flex flex-col items-center justify-center mx-auto mb-6 text-red-500">
                            <AlertCircle size={32} />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tighter text-[#0A1128] mb-2">{t('notVerified')}</h3>
                        <p className="text-slate-500 font-bold max-w-sm mx-auto mb-8">Vaši osebni podatki se bodo prikazali, ko boste verificirali svoj profil v zgornjem zavitku.</p>
                        <button 
                            type="button" 
                            onClick={onVerify}
                            className="text-xs font-black uppercase tracking-widest bg-[#0A1128] text-white px-8 py-4 rounded-xl hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-lg"
                        >
                            {t('verifyNow')}
                        </button>
                    </div>
                ) : (
                    <div className="mb-8">
                        <h3 className="text-sm font-black uppercase tracking-widest text-[#0A1128] mb-6 flex items-center gap-2">
                            {userType === 'business' ? <Building size={16} className="text-[#FEBA4F]"/> : <User size={16} className="text-[#FEBA4F]"/>} 
                            {t('verificationData')} ({userType === 'business' ? t('business') : t('individual')})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                            {userType === 'individual' ? (
                                <>
                                    <div><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('firstName')}</label><input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" /></div>
                                    <div><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('lastName')}</label><input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" /></div>
                                    <div className="md:col-span-2"><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('street')}</label><input type="text" value={formData.street} onChange={e => setFormData({...formData, street: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" /></div>
                                    <div><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('city')}</label><input type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" /></div>
                                    <div><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('postalCode')}</label><input type="text" value={formData.postalCode} onChange={e => setFormData({...formData, postalCode: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" /></div>
                                    <div className="md:col-span-2"><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('taxNumber')}</label><input type="text" value={formData.taxNumber} onChange={e => setFormData({...formData, taxNumber: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" /></div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Država / Country</label>
                                        <select value={formData.countryCode} onChange={e => setFormData({...formData, countryCode: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F] cursor-pointer">
                                            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="md:col-span-2"><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('companyName')}</label><input type="text" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" /></div>
                                    <div className="md:col-span-2"><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('taxNumber')}</label><input type="text" value={formData.taxNumber} onChange={e => setFormData({...formData, taxNumber: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" /></div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Država / Country</label>
                                        <select value={formData.countryCode} onChange={e => setFormData({...formData, countryCode: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F] cursor-pointer">
                                            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="md:col-span-2"><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('companyStreet')}</label><input type="text" value={formData.companyStreet} onChange={e => setFormData({...formData, companyStreet: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" /></div>
                                    <div><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('companyCity')}</label><input type="text" value={formData.companyCity} onChange={e => setFormData({...formData, companyCity: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" /></div>
                                    <div><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('companyPostalCode')}</label><input type="text" value={formData.companyPostalCode} onChange={e => setFormData({...formData, companyPostalCode: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" /></div>
                                    <div className="md:col-span-2"><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('representative')}</label><input type="text" value={formData.representative} onChange={e => setFormData({...formData, representative: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" /></div>
                                    <div className="md:col-span-2 flex items-center gap-2 mt-4 pt-4 border-t border-slate-200">
                                        <input type="checkbox" id="autoInvoice" checked={formData.autoInvoiceGeneration} onChange={e => setFormData({...formData, autoInvoiceGeneration: e.target.checked})} className="w-4 h-4 text-[#FEBA4F] bg-white border-slate-200 rounded focus:ring-[#FEBA4F] cursor-pointer" />
                                        <label htmlFor="autoInvoice" className="text-xs font-bold text-slate-500 cursor-pointer">Samodejno generiranje računov za provizije / Auto-generate commission invoices</label>
                                    </div>
                                </>
                            )}
                        </div>
                        <button type="submit" disabled={isSaving} className="w-full mt-8 bg-[#0A1128] text-white py-5 rounded-[2rem] font-black uppercase tracking-widest hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl flex items-center justify-center gap-3">
                            {isSaving ? (
                                <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                {t('processing')}
                                </>
                            ) : (
                                t('saveChanges')
                            )}
                        </button>
                    </div>
                )}
              </div>
            )}

            {activeTab === 'stripe' && (
              <div className="animate-in fade-in slide-in-from-right-4">
                <div className="mb-6">
                    <h3 className="text-xl font-black uppercase tracking-tighter text-[#0A1128] mb-2 flex items-center gap-2">
                        <CreditCard size={20} className="text-[#FEBA4F]"/> Plačila in izplačila (Stripe)
                    </h3>
                    <p className="text-slate-400 font-bold text-sm mb-8">Povežite svoj bančni račun za prejemanje izplačil od prodanih dražb ter upravljajte svoje podatke o nakazilih.</p>
                </div>
                <StripeConnectOnboarding 
                  userId={user?.id || ''} 
                  isComplete={!!user?.stripe_onboarding_complete} 
                  onComplete={onStripeVerified} 
                  t={t}
                  language={language}
                />
              </div>
            )}

          </form>
        </div>
      </div>
    </div>
  );
};

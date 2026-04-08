import React, { useState, useEffect } from 'react';
import { User, CheckCircle2, AlertCircle, ShieldCheck, XCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

export const AuthView: React.FC<{ t: any; onLoginSuccess: () => void; setIsVerified: (v: boolean) => void; setAppLoggedIn: (val: boolean) => void }> = ({ t, onLoginSuccess, setIsVerified, setAppLoggedIn }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  // Password validation state
  const [hasUppercase, setHasUppercase] = useState(false);
  const [hasNumber, setHasNumber] = useState(false);
  const [hasMinLength, setHasMinLength] = useState(false);
  const [passwordsMatch, setPasswordsMatch] = useState(true);

  useEffect(() => {
    setHasUppercase(/[A-Z]/.test(password));
    setHasNumber(/[0-9]/.test(password));
    setHasMinLength(password.length >= 8);
    setPasswordsMatch(password === confirmPassword || confirmPassword === '');
  }, [password, confirmPassword]);

  const getPasswordStrength = () => {
    let strength = 0;
    if (hasUppercase) strength++;
    if (hasNumber) strength++;
    if (hasMinLength) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++; // Special char bonus
    return strength;
  };

  const strength = getPasswordStrength();
  const strengthColor = strength <= 1 ? 'bg-red-500' : strength === 2 ? 'bg-amber-500' : strength === 3 ? 'bg-green-400' : 'bg-green-600';
  const strengthText = strength <= 1 ? 'Šibko' : strength === 2 ? 'Srednje' : strength === 3 ? 'Dobro' : 'Odlično';

  const handleForgotPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email) return toast.error('Prosimo, vnesite e-poštni naslov.');
      
      setLoading(true);
      try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin,
          });
          if (error) throw error;
          toast.success('Povezava za ponastavitev gesla je bila poslana na vaš e-poštni naslov.', { duration: 5000 });
          setIsForgotPassword(false);
      } catch (error: any) {
          toast.error(`Napaka: ${error.message}`);
      } finally {
          setLoading(false);
      }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        }
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(`Napaka pri prijavi z Googlom: ${error.message}`);
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check for OAuth errors in URL
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error_description') || params.get('error');
    if (error) {
      if (error.includes('identity_already_exists') || error.toLowerCase().includes('already registered')) {
        toast.error('Ta e-poštni naslov je že v uporabi z drugim načinom prijave (npr. z geslom).');
      } else {
        toast.error(`Napaka: ${error}`);
      }
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLogin) {
        if (!hasUppercase || !hasNumber || !hasMinLength) {
            return toast.error('Geslo ne ustreza varnostnim zahtevam.');
        }
        if (password !== confirmPassword) {
            setPasswordsMatch(false);
            return toast.error('Gesli se ne ujemata.');
        }
    }

    setLoading(true);
    try {
      if (isLogin) {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          
          if (data.user) {
              // Shrani izbiro "Zapomni si me" v bazo (user_metadata)
              await supabase.auth.updateUser({
                  data: { remember_me: rememberMe }
              });
              
              // Poskusi shraniti tudi v users tabelo, če stolpec obstaja
              try {
                  await supabase.from('users').update({ remember_me: rememberMe }).eq('id', data.user.id);
              } catch (e) {
                  // Ignore if column doesn't exist
              }
          }
          
          onLoginSuccess();
      } else {
          const { data, error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
          
          if (data.user) {
              // Try to insert into users table. If RLS blocks it because email is not confirmed yet,
              // we will also handle this in App.tsx on first login.
              const { error: insertError } = await supabase.from('users').insert({ 
                  id: data.user.id, 
                  email: email, 
                  is_verified: false, 
                  unpaid_strikes: 0, 
                  subscription: 'FREE' 
              });
              
              if (insertError) {
                  console.warn("Could not insert user immediately (likely RLS/email confirmation):", insertError);
              }
          }
          
          toast.success('Registracija uspešna! Preverite svoj e-poštni predal za potrditev.', { duration: 5000 });
          setIsLogin(true); // Switch to login view after registration
      }
    } catch (error: any) { 
        const errorMsg = error.message || JSON.stringify(error);
        toast.error(`Napaka pri prijavi/registraciji: ${errorMsg}`, { duration: Infinity, closeButton: true }); 
    } finally { setLoading(false); }
  };

  const demoLogin = (verified: boolean) => {
    setAppLoggedIn(true);
    setIsVerified(verified);
    onLoginSuccess();
  };

  if (isForgotPassword) {
      return (
        <div className="max-w-[1600px] mx-auto px-6 py-20 animate-in flex justify-center">
          <div className="bg-white w-full max-w-xl rounded-[4rem] p-10 lg:p-16 shadow-2xl border border-slate-100">
            <button onClick={() => setIsForgotPassword(false)} className="flex items-center gap-2 text-slate-400 mb-8 font-black uppercase text-[10px] tracking-widest hover:text-[#0A1128] transition-colors"><ArrowLeft size={16}/> Nazaj na prijavo</button>
            <div className="text-center mb-10">
                <div className="bg-[#FEBA4F] w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg"><ShieldCheck size={40} className="text-[#0A1128]" /></div>
                <h2 className="text-4xl font-black text-[#0A1128] uppercase tracking-tighter mb-4">Pozabljeno geslo</h2>
                <p className="text-slate-400 font-bold text-sm">Vnesite svoj e-poštni naslov in poslali vam bomo povezavo za ponastavitev gesla.</p>
            </div>
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <input type="email" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-[#FEBA4F] outline-none" placeholder={t('email')} onChange={e => setEmail(e.target.value)} />
              <button type="submit" disabled={loading} className="w-full bg-[#0A1128] text-white py-6 rounded-[2rem] font-black uppercase tracking-widest hover:bg-[#FEBA4F] transition-all shadow-xl">{loading ? t('processing') : 'Pošlji povezavo'}</button>
            </form>
          </div>
        </div>
      );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-20 animate-in flex justify-center">
      <div className="bg-white w-full max-w-xl rounded-[4rem] p-10 lg:p-16 shadow-2xl border border-slate-100">
        <div className="text-center mb-10">
            <div className="bg-[#FEBA4F] w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg"><User size={40} className="text-[#0A1128]" /></div>
            <h2 className="text-4xl font-black text-[#0A1128] uppercase tracking-tighter mb-4">{isLogin ? t('login') : t('register')}</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6 mb-8">
          <input type="email" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-[#FEBA4F] outline-none" placeholder={t('email')} onChange={e => setEmail(e.target.value)} />
          
          <div className="space-y-2">
              <input type="password" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-[#FEBA4F] outline-none" placeholder={t('password')} onChange={e => setPassword(e.target.value)} />
              
              {!isLogin && password.length > 0 && (
                  <div className="px-2 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-500">Moč gesla:</span>
                          <span className={`text-xs font-black uppercase tracking-widest ${strength <= 1 ? 'text-red-500' : strength === 2 ? 'text-amber-500' : 'text-green-600'}`}>{strengthText}</span>
                      </div>
                      <div className="flex gap-1 h-1.5 mb-4">
                          <div className={`flex-1 rounded-full ${password.length > 0 ? strengthColor : 'bg-slate-100'}`}></div>
                          <div className={`flex-1 rounded-full ${strength >= 2 ? strengthColor : 'bg-slate-100'}`}></div>
                          <div className={`flex-1 rounded-full ${strength >= 3 ? strengthColor : 'bg-slate-100'}`}></div>
                          <div className={`flex-1 rounded-full ${strength >= 4 ? strengthColor : 'bg-slate-100'}`}></div>
                      </div>
                      
                      <div className="space-y-1.5 text-xs font-bold">
                          <div className={`flex items-center gap-2 ${hasMinLength ? 'text-green-600' : 'text-slate-400'}`}>
                              {hasMinLength ? <CheckCircle2 size={14} /> : <XCircle size={14} />} Vsaj 8 znakov
                          </div>
                          <div className={`flex items-center gap-2 ${hasUppercase ? 'text-green-600' : 'text-slate-400'}`}>
                              {hasUppercase ? <CheckCircle2 size={14} /> : <XCircle size={14} />} Vsaj 1 velika začetnica
                          </div>
                          <div className={`flex items-center gap-2 ${hasNumber ? 'text-green-600' : 'text-slate-400'}`}>
                              {hasNumber ? <CheckCircle2 size={14} /> : <XCircle size={14} />} Vsaj 1 številka
                          </div>
                      </div>
                  </div>
              )}
          </div>

          {!isLogin && (
              <div className="space-y-2">
                  <input 
                      type="password" 
                      required 
                      className={`w-full bg-slate-50 border ${!passwordsMatch ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-[#FEBA4F]'} rounded-2xl py-4 px-6 font-bold focus:ring-2 outline-none`} 
                      placeholder="Potrdi geslo" 
                      onChange={e => setConfirmPassword(e.target.value)} 
                  />
                  {!passwordsMatch && <p className="text-red-500 text-xs font-bold px-2">Gesli se ne ujemata!</p>}
              </div>
          )}

          {isLogin && (
              <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                      <input 
                          type="checkbox" 
                          id="rememberMe" 
                          checked={rememberMe} 
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-4 h-4 text-[#FEBA4F] bg-slate-50 border-slate-200 rounded focus:ring-[#FEBA4F] cursor-pointer"
                      />
                      <label htmlFor="rememberMe" className="text-xs font-bold text-slate-500 cursor-pointer">Zapomni si me</label>
                  </div>
                  <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-[#0A1128] transition-colors">Pozabljeno geslo?</button>
              </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-[#0A1128] text-white py-6 rounded-[2rem] font-black uppercase tracking-widest hover:bg-[#FEBA4F] transition-all shadow-xl">{loading ? t('processing') : (isLogin ? t('login') : t('createAccount'))}</button>
          
          {isLogin && (
            <div className="relative flex items-center justify-center py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
              <span className="relative bg-white px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">ali</span>
            </div>
          )}

          {isLogin && (
            <button 
              type="button" 
              onClick={handleGoogleLogin} 
              disabled={loading}
              className="w-full bg-white border-2 border-slate-100 text-[#0A1128] py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest hover:border-[#FEBA4F] transition-all flex items-center justify-center gap-3 shadow-sm"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Prijava z Googlom
            </button>
          )}

          <button type="button" onClick={() => { setIsLogin(!isLogin); setPassword(''); setConfirmPassword(''); }} className="w-full text-xs font-black uppercase tracking-widest text-slate-400 hover:text-[#0A1128] mt-4">{isLogin ? t('noAccountRegister') : t('haveAccountLogin')}</button>
        </form>

        <div className="pt-8 border-t border-slate-100 space-y-4">
            <button onClick={() => demoLogin(true)} className="w-full border-2 border-green-500 text-green-600 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-50 transition-all flex items-center justify-center gap-2">
                <CheckCircle2 size={14} /> Demo: Verificiran uporabnik
            </button>
            <button onClick={() => demoLogin(false)} className="w-full border-2 border-amber-500 text-amber-600 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-50 transition-all flex items-center justify-center gap-2">
                <AlertCircle size={14} /> Demo: Neverificiran uporabnik
            </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { User, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

export const AuthView: React.FC<{ t: any; onLoginSuccess: () => void; setIsVerified: (v: boolean) => void; setAppLoggedIn: (val: boolean) => void }> = ({ t, onLoginSuccess, setIsVerified, setAppLoggedIn }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
      } else {
          const { data, error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
          if (data.user) {
              await supabase.from('users').insert({ id: data.user.id, email, is_verified: false, unpaid_strikes: 0, subscription: 'FREE' });
          }
      }
      onLoginSuccess();
    } catch (error: any) { toast.error(error.message); } finally { setLoading(false); }
  };

  const demoLogin = (verified: boolean) => {
    setAppLoggedIn(true);
    setIsVerified(verified);
    onLoginSuccess();
  };

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-20 animate-in flex justify-center">
      <div className="bg-white w-full max-w-xl rounded-[4rem] p-10 lg:p-16 shadow-2xl border border-slate-100">
        <div className="text-center mb-10">
            <div className="bg-[#FEBA4F] w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg"><User size={40} className="text-[#0A1128]" /></div>
            <h2 className="text-4xl font-black text-[#0A1128] uppercase tracking-tighter mb-4">{isLogin ? t('login') : t('register')}</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6 mb-8">
          <input type="email" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-[#FEBA4F] outline-none" placeholder={t('email')} onChange={e => setEmail(e.target.value)} />
          <input type="password" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-[#FEBA4F] outline-none" placeholder={t('password')} onChange={e => setPassword(e.target.value)} />
          <button type="submit" disabled={loading} className="w-full bg-[#0A1128] text-white py-6 rounded-[2rem] font-black uppercase tracking-widest hover:bg-[#FEBA4F] transition-all shadow-xl">{loading ? t('processing') : (isLogin ? t('login') : t('createAccount'))}</button>
          <button type="button" onClick={() => setIsLogin(!isLogin)} className="w-full text-xs font-black uppercase tracking-widest text-slate-400 hover:text-[#0A1128] mt-4">{isLogin ? t('noAccountRegister') : t('haveAccountLogin')}</button>
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

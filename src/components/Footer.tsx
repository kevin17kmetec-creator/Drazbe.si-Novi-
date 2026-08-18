import React from 'react';
import { Globe, MessageSquare, Camera, Mail, Phone, MapPin, CreditCard as CardIcon, CreditCard, ShieldCheck, FlaskConical } from 'lucide-react';

export const Footer: React.FC<{ 
    t: any; 
    onLegal: (type: 'terms' | 'privacy' | 'how') => void;
    onTestSandbox?: () => void;
}> = ({ t, onLegal, onTestSandbox }) => (
    <footer className="bg-[#0A1128] text-white pt-24 pb-12 border-t border-white/10">
        <div className="max-w-[1600px] mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-16 mb-24">
            <div className="col-span-1 md:col-span-2">
                <div className="flex items-center mb-8 cursor-pointer group">
                  <img 
                    src="https://lh3.googleusercontent.com/u/0/d/1yH_IHNJfoWXgrlrwESprp3gi29_MoYwi" 
                    alt="Drazba.si Logo" 
                    className="h-20 md:h-24 object-contain" 
                  />
                </div>
                <p className="text-slate-400 font-bold max-w-md leading-relaxed mb-8">{t('footerDesc')}</p>
                <div className="flex gap-4">
                    {[Globe, MessageSquare, Camera].map((Icon, i) => (
                        <button key={i} className="bg-white/5 p-4 rounded-2xl hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all"><Icon size={20} /></button>
                    ))}
                </div>
            </div>
            <div>
                <h4 className="font-black uppercase tracking-widest text-xs mb-8 text-[#FEBA4F]">{t('help')}</h4>
                <ul className="space-y-4 text-sm font-bold text-slate-400">
                    <li onClick={() => onLegal('terms')} className="hover:text-white cursor-pointer transition-colors">{t('terms')}</li>
                    <li onClick={() => onLegal('privacy')} className="hover:text-white cursor-pointer transition-colors">{t('privacy')}</li>
                    <li onClick={() => onLegal('how')} className="hover:text-white cursor-pointer transition-colors">{t('howItWorks')}</li>
                    {onTestSandbox && (
                        <li 
                            onClick={onTestSandbox} 
                            className="text-[#FEBA4F] hover:text-white cursor-pointer transition-colors flex items-center gap-2 font-black pt-2"
                        >
                            <FlaskConical size={16} /> 🧪 Testni laboratorij (Sandbox)
                        </li>
                    )}
                </ul>
            </div>
            <div>
                <h4 className="font-black uppercase tracking-widest text-xs mb-8 text-[#FEBA4F]">{t('contact')}</h4>
                <ul className="space-y-4 text-sm font-bold text-slate-400">
                    <li className="flex items-center gap-3"><Mail size={16} /> info@drazba.si</li>
                    <li className="flex items-center gap-3"><Phone size={16} /> +386 1 234 5678</li>
                    <li className="flex items-center gap-3"><MapPin size={16} /> Slovenska cesta 1, Ljubljana</li>
                </ul>
            </div>
        </div>
        <div className="max-w-[1600px] mx-auto px-6 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">© {new Date().getFullYear()} {t('rights')}</p>
                {onTestSandbox && (
                    <button
                        onClick={onTestSandbox}
                        className="text-xs bg-[#FEBA4F]/10 hover:bg-[#FEBA4F] hover:text-[#0A1128] text-[#FEBA4F] px-3.5 py-1.5 rounded-xl font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border border-[#FEBA4F]/30 shadow-sm"
                    >
                        <FlaskConical size={14} /> 🧪 Testni kotiček
                    </button>
                )}
            </div>
            <div className="flex gap-6 grayscale opacity-40">
                <CardIcon size={24} />
                <CreditCard size={24} />
                <ShieldCheck size={24} />
            </div>
        </div>
    </footer>
);

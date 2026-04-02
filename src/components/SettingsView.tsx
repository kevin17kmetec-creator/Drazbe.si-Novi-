import React, { useState, useRef } from 'react';
import { User, Camera } from 'lucide-react';
import { toast } from 'sonner';

export const SettingsView: React.FC<{ t: any; user: any; onSave: (data: any) => void }> = ({ t, user, onSave }) => {
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    profilePicture: user?.profilePicture || ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      toast.error(t('passwordsNotMatch'));
      return;
    }
    if (formData.newPassword && !formData.oldPassword) {
      toast.error(t('oldPasswordRequired'));
      return;
    }
    onSave(formData);
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0A1128] mb-12">{t('settings')}</h2>
      <form onSubmit={handleSave} className="bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-100">
        
        <div className="flex items-center gap-6 mb-10">
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
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-black uppercase tracking-widest text-[#FEBA4F] hover:text-[#0A1128] transition-colors">Spremeni sliko</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('firstName')}</label>
            <input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('lastName')}</label>
            <input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('email')}</label>
          <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" />
        </div>

        <div className="mb-10 p-6 bg-slate-50 rounded-2xl border border-slate-100">
          <h3 className="text-sm font-black uppercase tracking-widest text-[#0A1128] mb-6">Sprememba gesla</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Staro geslo</label>
              <input type="password" placeholder="••••••••" value={formData.oldPassword} onChange={e => setFormData({...formData, oldPassword: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Novo geslo</label>
              <input type="password" placeholder="••••••••" value={formData.newPassword} onChange={e => setFormData({...formData, newPassword: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Potrdi novo geslo</label>
              <input type="password" placeholder="••••••••" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" />
            </div>
          </div>
        </div>

        <button type="submit" className="w-full bg-[#0A1128] text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl">
          {t('saveChanges')}
        </button>
      </form>
    </div>
  );
};

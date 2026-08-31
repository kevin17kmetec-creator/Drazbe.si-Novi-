import React, { useState } from 'react';
import { CreateAuctionForm } from './CreateAuctionForm';
import { Layers, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export const CreatePackageForm: React.FC<any> = ({ onBack, t, language, onPublishPackage, isLoggedIn, userData, onNavigateToSettings }) => {
  const [packageTitle, setPackageTitle] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(true);

  const handlePublishItemLocally = async (item: any) => {
    setItems([...items, item]);
    setIsAddingItem(false);
  };

  const handleSubmitPackage = async () => {
    if (items.length < 2) {
      toast.error("Zbirka mora vsebovati vsaj 2 dražbi.");
      return;
    }
    if (!packageTitle) {
      toast.error("Vnesite ime zbirke dražb.");
      return;
    }
    
    await onPublishPackage({ title: packageTitle, items });
  };

  if (isAddingItem) {
    return (
      <div className="bg-slate-50 min-h-screen">
        <div className="p-4 border-b bg-white flex justify-between items-center sticky top-0 z-50 shadow-sm">
          <h2 className="text-xl font-bold flex items-center gap-2 text-[#0A1128]">
            <Layers className="text-[#FEBA4F]" />
            {items.length > 0 ? "Dodaj naslednjo dražbo v zbirko" : "Dodaj prvo dražbo v zbirko"}
          </h2>
          {items.length > 0 && (
            <button onClick={() => setIsAddingItem(false)} className="text-red-500 font-bold px-4 py-2 hover:bg-red-50 rounded-xl transition-colors text-xs uppercase tracking-wider">
              Prekliči dodajanje
            </button>
          )}
        </div>
        <CreateAuctionForm 
          onBack={() => {
            if (items.length > 0) setIsAddingItem(false);
            else onBack();
          }}
          t={t}
          language={language}
          onPublish={handlePublishItemLocally}
          isLoggedIn={isLoggedIn}
          userData={userData}
          onNavigateToSettings={onNavigateToSettings}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-3 bg-white hover:bg-slate-100 rounded-2xl border border-slate-200 transition-colors shadow-sm text-[#0A1128]">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3 text-[#0A1128]">
            <Layers className="text-[#FEBA4F]" size={32} />
            Ustvari zbirko dražb
          </h1>
          <p className="text-slate-500 font-medium mt-1">Združite več tematskih dražb v enotno zbirko. Račun in provizija se obračunata po zaključku celotne zbirke.</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 mb-8">
        <label className="block text-xs font-black uppercase tracking-widest text-[#0A1128] mb-3">Ime zbirke dražb</label>
        <input 
          type="text" 
          className="w-full border-2 border-slate-200 rounded-2xl p-4 focus:border-[#FEBA4F] outline-none text-lg font-bold text-[#0A1128] transition-colors shadow-inner" 
          placeholder="Npr. Zbirka delavniške opreme in orodja" 
          value={packageTitle}
          onChange={e => setPackageTitle(e.target.value)}
        />
      </div>

      <div className="mb-12">
        <div className="flex justify-between items-end mb-6">
          <h2 className="text-2xl font-black text-[#0A1128]">Dražbe v zbirki ({items.length})</h2>
          <button onClick={() => setIsAddingItem(true)} className="px-5 py-3 bg-[#0A1128] text-[#FEBA4F] hover:bg-[#FEBA4F] hover:text-[#0A1128] rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-md">
            <Plus size={16} /> Dodaj še eno dražbo
          </button>
        </div>
        
        {items.length === 0 && (
          <div className="text-center p-12 bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-bold text-base">V zbirki še ni dražb. Zbirka mora vsebovati vsaj 2 dražbi.</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((item, idx) => (
            <div key={idx} className="bg-[#0A1128] text-white rounded-[2rem] p-5 flex gap-5 shadow-lg border border-white/10 hover:border-[#FEBA4F]/50 transition-all">
               <img src={item.images[0]} className="w-24 h-24 object-cover rounded-2xl border border-white/10" alt="Item" />
               <div className="flex-1 flex flex-col justify-center">
                 <h3 className="font-black text-base text-white line-clamp-1">{item.title.SLO}</h3>
                 <p className="text-[#FEBA4F] font-black text-lg mt-1">€{Number(item.startingPrice || 1).toLocaleString('sl-SI')}</p>
                 <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-0.5">Začetna cena</span>
               </div>
               <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-400 p-2 transition-colors self-center">
                 <Trash2 size={20} />
               </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t border-slate-200">
        <button 
          onClick={handleSubmitPackage} 
          disabled={items.length < 2 || !packageTitle} 
          className="px-10 py-4 bg-[#FEBA4F] text-[#0A1128] hover:bg-[#0A1128] hover:text-[#FEBA4F] rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl hover:shadow-2xl"
        >
          Objavi zbirko
        </button>
      </div>
    </div>
  );
};

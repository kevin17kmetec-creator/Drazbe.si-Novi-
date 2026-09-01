const fs = require('fs');

const code = `import React, { useState } from 'react';
import { CreateAuctionForm } from './CreateAuctionForm';
import { Layers, Plus, Trash2, ArrowLeft, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export const CreatePackageForm: React.FC<any> = ({ onBack, t, language, onPublishPackage, onPublishItemDirectly, isLoggedIn, userData, onNavigateToSettings }) => {
  const [packageId] = useState(() => crypto.randomUUID());
  const [packageTitle, setPackageTitle] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  
  const validateEndTime = (newItemEndTime: string) => {
      const newTime = new Date(newItemEndTime).getTime();
      if (isNaN(newTime)) throw new Error("Neveljaven čas dražbe.");
      
      const allTimes = items.map(i => new Date(i.endTime).getTime());
      
      // 1. Min 2-min gap
      for (const t of allTimes) {
          if (Math.abs(t - newTime) < 2 * 60 * 1000) {
              throw new Error("Dve dražbi ne smeta imeti iste ure zaključka. Razmik mora biti vsaj 2 minuti.");
          }
      }
      
      // 2. Max 10-min gap between consecutive
      const sorted = [...allTimes, newTime].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
          if (sorted[i] - sorted[i-1] > 10 * 60 * 1000) {
              throw new Error("Dražbe v zbirki ne smejo biti narazen več kot 10 minut.");
          }
      }
      
      // 3. Overall duration constraint
      // E.g. max duration = (number of items) * 10 mins
      if (sorted.length > 1) {
          const totalDuration = sorted[sorted.length - 1] - sorted[0];
          if (totalDuration > sorted.length * 10 * 60 * 1000) {
               throw new Error("Skupno trajanje zbirke presega dovoljeno glede na število dražb.");
          }
      }
  };

  const handlePublishItemLocally = async (item: any) => {
    try {
        validateEndTime(item.endTime);
    } catch (err: any) {
        toast.error(err.message);
        throw err; // Stop CreateAuctionForm from closing
    }
    
    // It's published live!
    try {
        if (onPublishItemDirectly) {
            await onPublishItemDirectly(item, packageTitle || "Neimenovana zbirka", packageId);
        }
        setItems([...items, { ...item, is_published: true }]);
        setIsAddingItem(false);
        toast.success("Dražba je objavljena v živo in dodana v zbirko!");
    } catch (e: any) {
        toast.error("Napaka pri objavi dražbe.");
        throw e;
    }
  };
  
  const handleSaveDraftLocally = async (item: any) => {
      try {
        validateEndTime(item.endTime);
      } catch (err: any) {
        toast.error(err.message);
        throw err;
      }
      
      setItems([...items, { ...item, is_published: false }]);
      setIsAddingItem(false);
      toast.success("Dražba uspešno shranjena v osnutek zbirke.");
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
    
    await onPublishPackage({ title: packageTitle, items, packageId });
  };
  
  const handleDeleteItem = (idx: number) => {
      const item = items[idx];
      if (item.is_published) {
          toast.error("Objavljene dražbe ne morete izbrisati iz zbirke tukaj.");
          return;
      }
      setItems(items.filter((_, i) => i !== idx));
  };

  if (isAddingItem) {
    return (
      <div className="bg-slate-50 min-h-screen">
        <div className="p-4 border-b bg-white flex justify-between items-center sticky top-0 z-50 shadow-sm">
          <h2 className="text-xl font-bold flex items-center gap-2 text-[#0A1128]">
            <Layers className="text-[#FEBA4F]" />
            {items.length > 0 ? "Dodaj naslednjo dražbo v zbirko" : "Dodaj prvo dražbo v zbirko"}
          </h2>
          <button onClick={() => setIsAddingItem(false)} className="text-red-500 font-bold px-4 py-2 hover:bg-red-50 rounded-xl transition-colors text-xs uppercase tracking-wider">
             Prekliči dodajanje
          </button>
        </div>
        <CreateAuctionForm 
          onBack={() => setIsAddingItem(false)}
          t={t}
          language={language}
          onPublish={handlePublishItemLocally}
          onSaveDraft={handleSaveDraftLocally}
          isPackageMode={true}
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
          <p className="text-slate-500 font-medium mt-1">Združite več tematskih dražb v enotno zbirko.</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-[#FEBA4F]"></div>
        <label className="block text-xs font-black uppercase tracking-widest text-[#0A1128] mb-3">Naslov zbirke</label>
        <input 
          type="text" 
          className="w-full border-2 border-slate-200 rounded-2xl p-4 focus:border-[#FEBA4F] outline-none text-lg font-bold text-[#0A1128] transition-colors shadow-inner" 
          placeholder="Npr. Zbirka delavniške opreme in orodja" 
          value={packageTitle}
          onChange={e => setPackageTitle(e.target.value)}
        />
      </div>

      <div className="mb-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
          <h2 className="text-2xl font-black text-[#0A1128]">Dražbe v zbirki ({items.length})</h2>
          <button 
            onClick={() => {
                if (!packageTitle && items.length === 0) {
                    toast.error("Prosimo, najprej vnesite naslov zbirke.");
                    return;
                }
                setIsAddingItem(true);
            }} 
            className="px-5 py-3 bg-[#0A1128] text-[#FEBA4F] hover:bg-[#FEBA4F] hover:text-[#0A1128] rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-md"
          >
            <Plus size={16} /> Dodaj dražbo
          </button>
        </div>
        
        {items.length === 0 && (
          <div className="text-center p-12 bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-bold text-base">V zbirki še ni dražb. Zbirka mora vsebovati vsaj 2 dražbi.</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((item, idx) => (
            <div key={idx} className={"bg-white text-[#0A1128] rounded-[2rem] p-5 flex gap-5 shadow-lg border-2 transition-all " + (item.is_published ? "border-green-400" : "border-slate-200 hover:border-[#FEBA4F]")}>
               <img src={item.images[0]} className="w-24 h-24 object-cover rounded-2xl border border-slate-200" alt="Item" />
               <div className="flex-1 flex flex-col justify-center">
                 <h3 className="font-black text-base line-clamp-1">{item.title.SLO}</h3>
                 <p className="text-[#0A1128] font-black text-lg mt-1">€{Number(item.startingPrice || 1).toLocaleString('sl-SI')}</p>
                 <div className="flex items-center gap-2 mt-2">
                     {item.is_published ? (
                         <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md flex items-center gap-1"><CheckCircle size={12}/> V živo</span>
                     ) : (
                         <span className="bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md">Osnutek</span>
                     )}
                 </div>
               </div>
               {!item.is_published && (
                   <button onClick={() => handleDeleteItem(idx)} className="text-slate-400 hover:text-red-500 p-2 transition-colors self-center bg-slate-50 hover:bg-red-50 rounded-xl">
                     <Trash2 size={20} />
                   </button>
               )}
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
          {items.some(i => !i.is_published) ? "Objavi zbirko (" + items.filter(i => !i.is_published).length + " novih)" : "Shrani zbirko"}
        </button>
      </div>
    </div>
  );
};
`;
fs.writeFileSync('src/components/CreatePackageForm.tsx', code);
console.log('patched CreatePackageForm');

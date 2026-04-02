import React, { useState } from 'react';
import { ArrowLeft, FileUp, Trash2, Gavel } from 'lucide-react';
import { Category, Region } from '../../types.ts';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

export const CreateAuctionForm: React.FC<{ onBack: () => void; t: any; onPublish: (item: any) => void; isLoggedIn: boolean }> = ({ onBack, t, onPublish, isLoggedIn }) => {
    const getLocalDateStr = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const now = new Date();
    const defaultEndDate = new Date();
    defaultEndDate.setDate(defaultEndDate.getDate() + 7);
    const defaultDateStr = getLocalDateStr(defaultEndDate);
    const defaultTimeStr = "20:00";

    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 3);
    const minDateStr = getLocalDateStr(minDate);

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 14);
    const maxDateStr = getLocalDateStr(maxDate);

    const [formData, setFormData] = useState({ 
        title: '', 
        category: Category.Ostalo, 
        region: Region.Osrednjeslovenska, 
        description: '', 
        startingPrice: '100', 
        minStep: '5',
        endDate: defaultDateStr,
        endTime: defaultTimeStr
    });
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);

    const handleFiles = (files: File[]) => {
        setImageFiles(prev => [...prev, ...files]);
        const newPreviews = files.map(f => URL.createObjectURL(f));
        setPreviews(prev => [...prev, ...newPreviews]);
    };

    const handlePublish = async () => {
        if (!formData.title || !formData.description) return toast.error(t('enterAllData'));
        
        // Validation for end time
        const selectedEnd = new Date(`${formData.endDate}T${formData.endTime}`);
        const now = new Date();
        
        // Use local midnight for comparison to be fair with "days from today"
        const minDateLimit = new Date();
        minDateLimit.setDate(now.getDate() + 3);
        minDateLimit.setHours(0, 0, 0, 0);

        const maxDateLimit = new Date();
        maxDateLimit.setDate(now.getDate() + 14);
        maxDateLimit.setHours(23, 59, 59, 999);

        const hour = selectedEnd.getHours();
        const isValidTime = hour >= 6 && hour < 22; // 6:00 to 21:59

        if (selectedEnd < minDateLimit || selectedEnd > maxDateLimit || !isValidTime) {
            return toast.error(t('invalidEndTime'));
        }

        setUploading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const imageUrls = [];
            
            if (session) {
                for (const file of imageFiles) {
                    const filePath = `auction-images/${Date.now()}-${file.name}`;
                    const { error } = await supabase.storage.from('auction-images').upload(filePath, file);
                    if (error) throw error;
                    const { data } = supabase.storage.from('auction-images').getPublicUrl(filePath);
                    imageUrls.push(data.publicUrl);
                }
            } else {
                // Demo user: use local object URLs
                for (const file of imageFiles) {
                    imageUrls.push(URL.createObjectURL(file));
                }
            }
            
            onPublish({ 
                title: { SLO: formData.title },
                startingPrice: formData.startingPrice,
                description: formData.description,
                category: formData.category,
                region: formData.region,
                endTime: selectedEnd.toISOString(),
                images: imageUrls.length > 0 ? imageUrls : ['https://images.unsplash.com/photo-1586191552066-d52dd1e3af86'] 
            });
        } catch (error: any) { 
            console.error("Error publishing auction:", error); 
            const errorMsg = error.message || JSON.stringify(error);
            toast.error(`Napaka pri nalaganju slik: ${errorMsg}`, { duration: Infinity, closeButton: true });
        } finally { setUploading(false); }
    };

    const handleNumericChange = (field: string, value: string) => {
        const numericValue = value.replace(/\D/g, '');
        setFormData(prev => ({ ...prev, [field]: numericValue }));
    };

    return (
        <div className="max-w-4xl mx-auto px-6 py-14 animate-in">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-[#0A1128] transition-colors mb-10 font-black text-[10px] uppercase tracking-widest"><ArrowLeft size={16} /> {t('cancel')}</button>
            <div className="bg-white rounded-[3rem] p-10 lg:p-16 shadow-2xl border border-slate-100">
                <h2 className="text-4xl font-black text-[#0A1128] mb-8 uppercase tracking-tighter">{t('newAuction')}</h2>
                <div className="space-y-8">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('auctionTitle')}</label>
                        <input type="text" placeholder={t('enterTitle')} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none" onChange={e => setFormData({...formData, title: e.target.value})} />
                    </div>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('itemDescription')}</label>
                        <textarea placeholder={t('describeItem')} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 font-bold h-40 focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none resize-none" onChange={e => setFormData({...formData, description: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('startingPriceEur')}</label>
                            <input 
                                type="text" 
                                inputMode="numeric"
                                placeholder="100" 
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none" 
                                value={formData.startingPrice}
                                onChange={e => handleNumericChange('startingPrice', e.target.value)} 
                            />
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('category')}</label>
                            <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none appearance-none cursor-pointer" onChange={e => setFormData({...formData, category: e.target.value as Category})}>
                                {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('region')}</label>
                        <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none appearance-none cursor-pointer" onChange={e => setFormData({...formData, region: e.target.value as Region})}>
                            {Object.values(Region).map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('auctionEndTime')}</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-slate-400 ml-2">{t('endDate')}</label>
                                <input 
                                    type="date" 
                                    value={formData.endDate}
                                    min={minDateStr}
                                    max={maxDateStr}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none" 
                                    onChange={e => setFormData({...formData, endDate: e.target.value})} 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-slate-400 ml-2">{t('endTime')}</label>
                                <input 
                                    type="time" 
                                    value={formData.endTime}
                                    min="06:00"
                                    max="21:59"
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none" 
                                    onChange={e => setFormData({...formData, endTime: e.target.value})} 
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('itemImages')}</label>
                        <div 
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if(e.dataTransfer.files) handleFiles(Array.from(e.dataTransfer.files)); }}
                            className={`p-12 border-4 border-dashed rounded-[2.5rem] text-center transition-all cursor-pointer relative group ${isDragging ? 'border-[#FEBA4F] bg-[#FEBA4F]/5 scale-[1.01]' : 'border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-200'}`}
                        >
                            <input type="file" multiple accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={e => e.target.files && handleFiles(Array.from(e.target.files))} />
                            <div className="flex flex-col items-center gap-4">
                                <div className={`p-6 rounded-full transition-all duration-300 ${isDragging ? 'bg-[#FEBA4F] text-[#0A1128] scale-110' : 'bg-white text-slate-300 group-hover:text-[#FEBA4F]'}`}>
                                    <FileUp size={48} strokeWidth={1.5} />
                                </div>
                                <div>
                                    <p className="text-lg font-black text-[#0A1128]">{t('dragImages')}</p>
                                    <p className="text-slate-400 font-bold text-sm">{t('supportedFormats')}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {previews.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 animate-in">
                            {previews.map((src, i) => (
                                <div key={i} className="relative group aspect-square rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm transition-transform hover:scale-105">
                                    <img src={src} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button onClick={() => {
                                            setPreviews(prev => prev.filter((_, idx) => idx !== i));
                                            setImageFiles(prev => prev.filter((_, idx) => idx !== i));
                                        }} className="bg-red-500 text-white p-2.5 rounded-xl shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                            <Trash2 size={18} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <button onClick={handlePublish} disabled={uploading} className="w-full bg-[#0A1128] text-white py-8 rounded-[2rem] font-black uppercase tracking-widest text-lg hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-[0.98]">
                        {uploading ? (
                            <>
                                <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                                {t('processing')}
                            </>
                        ) : (
                            <>
                                <Gavel size={24} />
                                {t('publishAuction')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

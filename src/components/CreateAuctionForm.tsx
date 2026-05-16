import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, FileUp, Trash2, Gavel, Wand2, X, Eye, ChevronLeft, ChevronRight, GripHorizontal } from 'lucide-react';
import { Category, Region, AuctionItem } from '../../types.ts';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { GoogleGenAI } from '@google/genai';
import imageCompression from 'browser-image-compression';
import { AuctionCard } from './AuctionCard';
import AuctionView from './AuctionView';

const REGION_LOCATIONS: Record<Region, string[]> = {
    [Region.Prekmurje]: ['Murska Sobota', 'Lendava', 'Ljutomer', 'Beltinci', 'Gornja Radgona'],
    [Region.Stajerska]: ['Maribor', 'Celje', 'Ptuj', 'Velenje', 'Slovenska Bistrica', 'Žalec'],
    [Region.Koroska]: ['Slovenj Gradec', 'Ravne na Koroškem', 'Dravograd', 'Prevalje', 'Mežica'],
    [Region.Gorenjska]: ['Kranj', 'Jesenice', 'Škofja Loka', 'Radovljica', 'Bled', 'Tržič'],
    [Region.Primorska]: ['Koper', 'Nova Gorica', 'Izola', 'Piran', 'Postojna', 'Sežana'],
    [Region.Notranjska]: ['Cerknica', 'Ilirska Bistrica', 'Pivka', 'Loška Dolina', 'Bloke'],
    [Region.Dolenjska]: ['Novo mesto', 'Kočevje', 'Trebnje', 'Črnomelj', 'Ribnica', 'Metlika'],
    [Region.Osrednjeslovenska]: ['Ljubljana', 'Domžale', 'Kamnik', 'Grosuplje', 'Vrhnika']
};

import { CustomDatePicker, CustomTimePicker } from './CustomDateTime';

const SignedImg = ({ src, alt, className, onClick }: { src: string, alt: string, className?: string, onClick?: () => void }) => {
    const [signedUrl, setSignedUrl] = useState<string>('');
    useEffect(() => {
        if (!src) return;
        if (src.startsWith('http')) { setSignedUrl(src); return; }
        supabase.storage.from('auction-images').createSignedUrl(src, 3600).then(({data}) => {
            if (data?.signedUrl) setSignedUrl(data.signedUrl);
        });
    }, [src]);
    return <img src={signedUrl || src} alt={alt} loading="lazy" className={className} onClick={onClick} referrerPolicy="no-referrer" />;
};

export const CreateAuctionForm: React.FC<{ 
    onBack: () => void; 
    t: any; 
    onPublish: (item: any) => void; 
    isLoggedIn: boolean;
    initialData?: any;
}> = ({ onBack, t, onPublish, isLoggedIn, initialData }) => {
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
        title: initialData?.title?.SLO || (typeof initialData?.title === 'string' ? initialData.title : ''), 
        category: initialData?.category || Category.Ostalo, 
        region: initialData?.region || Region.Stajerska, 
        location: initialData?.location?.SLO || (typeof initialData?.location === 'string' ? initialData.location : REGION_LOCATIONS[initialData?.region as Region || Region.Stajerska]?.[0] || ''),
        condition: initialData?.condition?.SLO || (typeof initialData?.condition === 'string' ? initialData.condition : 'Rabljeno'),
        description: initialData?.description?.SLO || (typeof initialData?.description === 'string' ? initialData.description : ''), 
        startingPrice: initialData?.startingPrice?.toString() || initialData?.currentBid?.toString() || '1', 
        minStep: '5',
        endDate: defaultDateStr,
        endTime: defaultTimeStr
    });
    const [existingImages, setExistingImages] = useState<string[]>(initialData?.images || []);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<Record<number, { state: string, percent: number }>>({});
    const [enhancingIndex, setEnhancingIndex] = useState<number | null>(null);
    const [isCompressing, setIsCompressing] = useState(false);
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    useEffect(() => {
        if (initialData?.created_at && initialData?.end_time) {
            const created = new Date(initialData.created_at);
            const ended = new Date(initialData.end_time);
            const durationDays = Math.max(1, Math.round((ended.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
            
            const newEndDate = new Date();
            newEndDate.setDate(newEndDate.getDate() + durationDays);
            
            setFormData(prev => ({
                ...prev,
                endDate: getLocalDateStr(newEndDate),
                endTime: `${String(ended.getHours()).padStart(2, '0')}:${String(ended.getMinutes()).padStart(2, '0')}`
            }));
        } else if (initialData?.endTime) {
            // Fallback for mock data if needed
            const ended = new Date(initialData.endTime);
            const newEndDate = new Date();
            newEndDate.setDate(newEndDate.getDate() + 7);
            setFormData(prev => ({
                ...prev,
                endDate: getLocalDateStr(newEndDate),
                endTime: `${String(ended.getHours()).padStart(2, '0')}:${String(ended.getMinutes()).padStart(2, '0')}`
            }));
        }
    }, [initialData]);

    useEffect(() => {
        if (!REGION_LOCATIONS[formData.region].includes(formData.location)) {
            setFormData(prev => ({ ...prev, location: REGION_LOCATIONS[formData.region][0] }));
        }
    }, [formData.region]);

    const handleFiles = async (files: File[]) => {
        if (previews.length + files.length > 10) {
            toast.error(t('maxImagesError'));
            files = files.slice(0, 10 - previews.length);
        }
        if (files.length === 0) return;

        setIsCompressing(true);
        try {
            const compressedFiles = await Promise.all(
                files.map(async (file) => {
                    const options = { maxSizeMB: 1, maxWidthOrHeight: 1200, useWebWorker: true, initialQuality: 0.8 };
                    return await imageCompression(file, options);
                })
            );
            setImageFiles(prev => [...prev, ...compressedFiles]);
            const newPreviews = compressedFiles.map(f => URL.createObjectURL(f));
            setPreviews(prev => [...prev, ...newPreviews]);
        } catch (error) {
            console.error('Error compressing files', error);
            toast.error(t('imageUploadError'));
        } finally {
            setIsCompressing(false);
        }
    };

    const moveImage = (index: number, direction: 'left' | 'right') => {
        if (direction === 'left' && index > 0) {
            setPreviews(prev => {
                const newArr = [...prev];
                [newArr[index - 1], newArr[index]] = [newArr[index], newArr[index - 1]];
                return newArr;
            });
            setImageFiles(prev => {
                const newArr = [...prev];
                [newArr[index - 1], newArr[index]] = [newArr[index], newArr[index - 1]];
                return newArr;
            });
        } else if (direction === 'right' && index < previews.length - 1) {
            setPreviews(prev => {
                const newArr = [...prev];
                [newArr[index], newArr[index + 1]] = [newArr[index + 1], newArr[index]];
                return newArr;
            });
            setImageFiles(prev => {
                const newArr = [...prev];
                [newArr[index], newArr[index + 1]] = [newArr[index + 1], newArr[index]];
                return newArr;
            });
        }
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedItemIndex === null || draggedItemIndex === dropIndex) return;
        
        const newPreviews = [...previews];
        const newFiles = [...imageFiles];
        
        const draggedPreview = newPreviews[draggedItemIndex];
        const draggedFile = newFiles[draggedItemIndex];
        
        newPreviews.splice(draggedItemIndex, 1);
        newPreviews.splice(dropIndex, 0, draggedPreview);
        
        newFiles.splice(draggedItemIndex, 1);
        newFiles.splice(dropIndex, 0, draggedFile);
        
        setPreviews(newPreviews);
        setImageFiles(newFiles);
        setDraggedItemIndex(null);
    };

    const enhanceImage = async (index: number) => {
        try {
            setEnhancingIndex(index);
            const file = imageFiles[index];
            
            // Convert file to base64
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Data = (reader.result as string).split(',')[1];
                const mimeType = file.type;

                try {
                    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
                    if (!apiKey) {
                        throw new Error('Gemini API Key is missing. Prosimo preverite .env datoteko in dodajte VITE_GEMINI_API_KEY.');
                    }
                    const ai = new GoogleGenAI({ apiKey });
                    
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash-image',
                        contents: {
                            parts: [
                                {
                                    inlineData: {
                                        data: base64Data,
                                        mimeType: mimeType,
                                    },
                                },
                                {
                                    text: 'Enhance the quality, lighting, and sharpness of this image. Keep the original subject exactly the same, just make it look more professional and appealing.',
                                },
                            ],
                        },
                    });

                    let newImageUrl = null;
                    let newBase64 = null;
                    // Iterate through parts to find the image part as per skill
                    for (const part of response.candidates?.[0]?.content?.parts || []) {
                        if (part.inlineData) {
                            newBase64 = part.inlineData.data;
                            newImageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${newBase64}`;
                            break;
                        }
                    }

                    if (newImageUrl && newBase64) {
                        // Create a new File object from the base64 data
                        const byteCharacters = atob(newBase64);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const newFile = new File([byteArray], `enhanced-${file.name}`, { type: 'image/png' });

                        setImageFiles(prev => {
                            const newFiles = [...prev];
                            newFiles[index] = newFile;
                            return newFiles;
                        });
                        setPreviews(prev => {
                            const newPreviews = [...prev];
                            newPreviews[index] = newImageUrl;
                            return newPreviews;
                        });
                        toast.success(t('imageEnhanced'));
                    } else {
                        // If no image part was returned, it might have just returned text
                        toast.info(t('imageNotChanged'));
                    }
                    
                } catch (err: any) {
                    console.error("Gemini API error:", err);
                    if (err.message?.includes('API Key is missing')) {
                         toast.error('Gemini API ključ manjka. Prosimo preverite .env datoteko.', { duration: 5000 });
                    } else {
                         toast.error(t('imageEnhanceError'));
                    }
                } finally {
                    setEnhancingIndex(null);
                }
            };
        } catch (error) {
            console.error("Error enhancing image:", error);
            toast.error(t('imageEnhanceError'));
            setEnhancingIndex(null);
        }
    };

    const [showPreview, setShowPreview] = useState(false);
    const cancelRef = useRef(false);
    const uploadedFilesRef = useRef<string[]>([]);

    useEffect(() => {
        // cleanup on unmount
        return () => {
            uploadedFilesRef.current = [];
        };
    }, []);

    const handlePublish = async () => {
        if (!formData.title || !formData.description) return toast.error(t('enterAllData'));
        if (existingImages.length + imageFiles.length < 3) return toast.error(t('minImagesError'));
        if (existingImages.length + imageFiles.length > 10) return toast.error(t('maxImagesError'));
        
        const startingPriceNum = parseInt(formData.startingPrice);
        if (isNaN(startingPriceNum) || startingPriceNum < 1) {
            return toast.error(t('priceMin1'));
        }

        const selectedEnd = new Date(`${formData.endDate}T${formData.endTime}`);
        
        setUploading(true);
        setUploadProgress({});
        cancelRef.current = false;
        uploadedFilesRef.current = [];

        try {
            let imageUrls: string[] = [...existingImages];
            
            if (isLoggedIn) {
                // Sequential upload allows cancellation easily
                for (let i = 0; i < imageFiles.length; i++) {
                    if (cancelRef.current) throw new Error('CANCELED');
                    
                    const compressedFile = imageFiles[i];
                    setUploadProgress(prev => ({ ...prev, [i]: { state: t('preparing'), percent: 50 } }));
                    
                    if (cancelRef.current) throw new Error('CANCELED');
                    setUploadProgress(prev => ({ ...prev, [i]: { state: t('uploading'), percent: 60 } }));
                    
                    const fileName = `${Date.now()}-${compressedFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                    const arrayBuffer = await compressedFile.arrayBuffer();
                    
                    const { error: uploadError } = await supabase.storage.from('auction-images').upload(fileName, arrayBuffer, {
                        contentType: compressedFile.type,
                        upsert: true
                    });
                    
                    if (uploadError) {
                        setUploadProgress(prev => ({ ...prev, [i]: { state: 'Napaka', percent: 0 } }));
                        throw uploadError;
                    }

                    uploadedFilesRef.current.push(fileName);
                    imageUrls.push(fileName);
                    setUploadProgress(prev => ({ ...prev, [i]: { state: 'Zaključeno', percent: 100 } }));
                }

                if (cancelRef.current) throw new Error('CANCELED');
            } else {
                for (const file of imageFiles) {
                    imageUrls.push(URL.createObjectURL(file));
                }
            }
            
            await onPublish({ 
                title: { SLO: formData.title },
                startingPrice: formData.startingPrice,
                description: formData.description,
                category: formData.category,
                region: formData.region,
                condition: formData.condition,
                location: { SLO: formData.location, EN: formData.location, DE: formData.location },
                endTime: selectedEnd.toISOString(),
                images: imageUrls
            });
        } catch (error: any) { 
            if (error.message === 'CANCELED') {
                toast.error("Nalaganje prekinjeno.");
                if (uploadedFilesRef.current.length > 0) {
                    await supabase.storage.from('auction-images').remove(uploadedFilesRef.current);
                }
                return;
            }
            console.error("Error publishing auction:", error); 
            const errorMsg = error.message || JSON.stringify(error);
            toast.error(`${t('imageUploadError')} ${errorMsg}`, { duration: 5000 });
        } finally { 
            setUploading(false); 
        }
    };

    const handleCancelUpload = () => {
        cancelRef.current = true;
    };

    const handleNumericChange = (field: string, value: string) => {
        let numericValue = value.replace(/\D/g, '');
        setFormData(prev => ({ ...prev, [field]: numericValue }));
    };

    const handleStartingPriceBlur = () => {
        if (!formData.startingPrice || parseInt(formData.startingPrice) < 1) {
            setFormData(prev => ({ ...prev, startingPrice: '1' }));
        }
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
                            <div className="relative flex items-center">
                                <input 
                                    type="text" 
                                    inputMode="numeric"
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 pl-6 pr-12 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none" 
                                    value={formData.startingPrice}
                                    onChange={e => handleNumericChange('startingPrice', e.target.value)} 
                                    onBlur={handleStartingPriceBlur}
                                />
                                <span className="absolute right-6 font-black text-[#0A1128] pointer-events-none">€</span>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('category')}</label>
                            <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none appearance-none cursor-pointer" onChange={e => setFormData({...formData, category: e.target.value as Category})}>
                                {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('itemCondition')}</label>
                            <select value={formData.condition} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none appearance-none cursor-pointer" onChange={e => setFormData({...formData, condition: e.target.value})}>
                                <option value="Novo">{t('cond_new')}</option>
                                <option value="Kot novo">{t('cond_likeNew')}</option>
                                <option value="Rabljeno">{t('cond_used')}</option>
                                <option value="Potrebno obnove">{t('cond_needsFix')}</option>
                                <option value="Za dele">{t('cond_parts')}</option>
                            </select>
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('region')}</label>
                            <select value={formData.region} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none appearance-none cursor-pointer" onChange={e => setFormData({...formData, region: e.target.value as Region})}>
                                {Object.values(Region).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('city')}</label>
                            <select value={formData.location} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none appearance-none cursor-pointer" onChange={e => setFormData({...formData, location: e.target.value})}>
                                {REGION_LOCATIONS[formData.region].map(loc => <option key={loc} value={loc}>{loc}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('auctionEndTime')}</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-slate-400 ml-2">{t('endDate')}</label>
                                <CustomDatePicker 
                                    value={formData.endDate}
                                    onChange={(val) => setFormData({...formData, endDate: val})}
                                    minDateStr={minDateStr}
                                    maxDateStr={maxDateStr}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-slate-400 ml-2">{t('endTime')}</label>
                                <CustomTimePicker 
                                    value={formData.endTime}
                                    onChange={(val) => setFormData({...formData, endTime: val})}
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
                                    {isCompressing ? <div className="w-12 h-12 border-4 border-[#0A1128]/20 border-t-[#FEBA4F] rounded-full animate-spin"></div> : <FileUp size={48} strokeWidth={1.5} />}
                                </div>
                                <div>
                                    <p className="text-lg font-black text-[#0A1128]">{isCompressing ? t('preparingAndOptimizing') : t('dragImages')}</p>
                                    <p className="text-slate-400 font-bold text-sm">{t('supportedFormats')}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {(existingImages.length > 0 || previews.length > 0) && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 animate-in">
                            {existingImages.map((src, i) => (
                                <div key={`ex-${i}`} className="flex flex-col gap-2">
                                     <div className="relative group aspect-square rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm transition-transform hover:scale-105 cursor-pointer" onClick={() => setZoomedImage(src.startsWith('http') ? src : undefined)}>
                                        <SignedImg src={src} alt={`existing-${i}`} className="w-full h-full object-cover" />
                                        {i === 0 && <div className="absolute top-2 left-2 bg-[#FEBA4F] text-[#0A1128] text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest z-10">{t('mainImage')}</div>}
                                        <button onClick={(e) => { e.stopPropagation(); setExistingImages(prev => prev.filter((_, idx) => idx !== i)); }} type="button" className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 shadow-lg z-20"><Trash2 size={16} /></button>
                                     </div>
                                </div>
                            ))}
                            {previews.map((src, i) => (
                                <div 
                                    key={i} 
                                    className="flex flex-col gap-2"
                                    draggable
                                    onDragStart={() => setDraggedItemIndex(i)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleDrop(e, i)}
                                >
                                    <div className="relative group aspect-square rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm transition-transform hover:scale-105 cursor-pointer" onClick={() => setZoomedImage(src)}>
                                        <img src={src} className="w-full h-full object-cover" />
                                        {existingImages.length === 0 && i === 0 && <div className="absolute top-2 left-2 bg-[#FEBA4F] text-[#0A1128] text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest z-10">{t('mainImage')}</div>}
                                        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-center pt-2">
                                            <div className="bg-white/80 backdrop-blur-sm shadow text-[#0A1128] p-1.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-white" onClick={e => e.stopPropagation()}>
                                                <GripHorizontal size={16} />
                                            </div>
                                        </div>
                                        {uploading && uploadProgress[i] && (
                                            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-3 z-20 pointer-events-none">
                                                <span className="text-white text-xs font-bold mb-3">{uploadProgress[i].state}</span>
                                                <div className="w-full bg-gray-600 rounded-full h-2 overflow-hidden">
                                                    <div className="bg-[#FEBA4F] h-full transition-all duration-300" style={{ width: `${uploadProgress[i].percent}%` }}></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={(e) => {
                                                e.preventDefault();
                                                enhanceImage(i);
                                            }} 
                                            disabled={enhancingIndex !== null}
                                            className="flex-1 bg-slate-100 text-[#0A1128] p-2 rounded-xl hover:bg-[#FEBA4F] transition-all duration-300 disabled:opacity-50 flex items-center justify-center"
                                            title="Polepšaj sliko"
                                        >
                                            {enhancingIndex === i ? (
                                                <div className="w-4 h-4 border-2 border-[#0A1128]/20 border-t-[#0A1128] rounded-full animate-spin"></div>
                                            ) : (
                                                <Wand2 size={16} strokeWidth={2.5} />
                                            )}
                                        </button>
                                        <button onClick={(e) => {
                                            e.preventDefault();
                                            setPreviews(prev => prev.filter((_, idx) => idx !== i));
                                            setImageFiles(prev => prev.filter((_, idx) => idx !== i));
                                        }} className="flex-1 bg-slate-100 text-slate-500 hover:text-white p-2 rounded-xl hover:bg-red-500 transition-all duration-300 flex items-center justify-center">
                                            <Trash2 size={16} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!uploading && (
                        <button onClick={() => setShowPreview(true)} className="w-full bg-slate-100 text-[#0A1128] py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-sm hover:bg-slate-200 transition-all shadow-sm flex flex-col sm:flex-row items-center justify-center gap-2 mb-4">
                            <Eye size={18} /> {t('auctionPreview')}
                        </button>
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

                    {uploading && (
                        <button onClick={handleCancelUpload} className="mt-4 w-full bg-red-500 text-white py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-sm hover:bg-red-600 transition-all shadow-sm flex items-center justify-center gap-2 lg:mb-4 relative overflow-hidden group">
                           <span className="relative z-10 flex items-center gap-2"><X size={18} strokeWidth={3} /> {t('cancelUpload')}</span>
                           <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                        </button>
                    )}
                </div>
            </div>

            {zoomedImage && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in" onClick={() => setZoomedImage(null)}>
                    <button onClick={() => setZoomedImage(null)} className="absolute top-6 right-6 w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-white hover:text-black transition-all cursor-pointer"><X size={20} strokeWidth={3} /></button>
                    <img src={zoomedImage} className="max-w-full max-h-full rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
                </div>
            )}

            {showPreview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 lg:p-8 overflow-y-auto" onClick={() => setShowPreview(false)}>
                    <div className="bg-[#f8fafc] w-full max-w-7xl rounded-[3rem] border border-white/20 shadow-2xl overflow-hidden relative mt-20 md:mt-0" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-white sticky top-0 z-20">
                            <h2 className="text-2xl font-black uppercase tracking-tighter text-[#0A1128]">{t('auctionPreview')}</h2>
                            <button onClick={() => setShowPreview(false)} className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all cursor-pointer"><X size={20} strokeWidth={3} /></button>
                        </div>
                        <div className="p-8 h-[80vh] overflow-y-auto flex flex-col gap-12" onClick={e => e.stopPropagation()}>
                            <div>
                               <h3 className="text-xl font-black uppercase tracking-tighter text-[#0A1128] mb-6 border-b pb-4">{t('cardPreview')}</h3>
                               <div className="w-full max-w-sm mx-auto">
                                   <AuctionCard 
                                      item={{
                                         id: 'preview',
                                         title: { SLO: formData.title || 'Naslov', EN: formData.title, DE: formData.title },
                                         description: formData.description || 'Opis',
                                         currentBid: parseInt(formData.startingPrice) || 0,
                                         startingPrice: parseInt(formData.startingPrice) || 0,
                                         bidCount: 0,
                                         images: previews.length > 0 ? previews : ['https://picsum.photos/seed/placeholder/800/800'],
                                         endTime: new Date(`${formData.endDate}T${formData.endTime}`),
                                         sellerId: 'demo',
                                         sellerName: 'Demo Prodajalec',
                                         location: { SLO: formData.location || 'Lokacija' },
                                         status: 'active',
                                         category: formData.category,
                                         region: formData.region,
                                         condition: formData.condition,
                                         createdAt: new Date()
                                      } as unknown as AuctionItem} 
                                      t={t} 
                                      language="SLO" 
                                      isVerified={isLoggedIn} 
                                      currentUserId="mock" 
                                      isWatched={false} 
                                      onWatchToggle={()=>{}} 
                                      onClick={()=>{}} 
                                      onBidSubmit={async () => undefined} 
                                      onSellerClick={()=>{}} 
                                   />
                               </div>
                            </div>
                            <div className="pb-12">
                               <h3 className="text-xl font-black uppercase tracking-tighter text-[#0A1128] mb-6 border-b pb-4">{t('pagePreview')}</h3>
                               <div className="border border-slate-200 rounded-[2.5rem] overflow-hidden bg-slate-50 w-full relative h-[600px] md:h-[800px] overflow-x-auto">
                                   <div className="pointer-events-none w-[1280px] origin-top-left transform scale-[0.4] sm:scale-[0.5] md:scale-[0.7] lg:scale-[0.8] xl:scale-[0.9]">
                                       <AuctionView 
                                          item={{
                                             id: 'preview',
                                             title: { SLO: formData.title || 'Naslov', EN: formData.title, DE: formData.title },
                                             description: formData.description || 'Opis',
                                             currentBid: parseInt(formData.startingPrice) || 0,
                                             startingPrice: parseInt(formData.startingPrice) || 0,
                                             bidCount: 0,
                                             images: previews.length > 0 ? previews : ['https://picsum.photos/seed/placeholder/800/800'],
                                             endTime: new Date(`${formData.endDate}T${formData.endTime}`),
                                             sellerId: 'demo',
                                             sellerName: 'Demo Prodajalec',
                                             location: { SLO: formData.location || 'Lokacija' },
                                             status: 'active',
                                             category: formData.category,
                                             region: formData.region,
                                             condition: formData.condition,
                                             createdAt: new Date()
                                          } as unknown as AuctionItem} 
                                          t={t} 
                                          language="SLO" 
                                          isVerified={isLoggedIn} 
                                          currentUserId="mock" 
                                          currentPlan="FREE"
                                          isWatched={false}
                                          onWatchToggle={()=>{}}
                                          onBack={()=>{}} 
                                          onBidSubmit={async () => 'success'} 
                                          onCheckout={()=>{}} 
                                          onSellerClick={()=>{}} 
                                       />
                                   </div>
                               </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

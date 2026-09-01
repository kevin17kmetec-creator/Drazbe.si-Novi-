const fs = require('fs');
let code = fs.readFileSync('src/components/CreateAuctionForm.tsx', 'utf8');

// Add onSaveDraft to props
code = code.replace(
    "onNavigateToSettings?: (tab?: 'profile' | 'personal' | 'stripe') => void;",
    "onNavigateToSettings?: (tab?: 'profile' | 'personal' | 'stripe') => void;\n    onSaveDraft?: (data: any) => Promise<void>;\n    isPackageMode?: boolean;"
);

code = code.replace(
    "onNavigateToSettings",
    "onNavigateToSettings,\n    onSaveDraft,\n    isPackageMode"
);

// Replace handlePublish signature and logic
code = code.replace(
    "const handlePublish = async () => {",
    "const handlePublish = async (e?: any, asDraft = false) => {"
);

// In the try block of handlePublish, call onSaveDraft if asDraft
code = code.replace(
    "await onPublish({ \n                id: initialData?.id,",
    "const payload = { \n                id: initialData?.id,"
);

code = code.replace(
    "shipping_cost: formData.shipping_fee_type === 'fixed' ? Number(formData.shipping_cost || 0) : null\n            });",
    "shipping_cost: formData.shipping_fee_type === 'fixed' ? Number(formData.shipping_cost || 0) : null\n            };\n            if (asDraft && onSaveDraft) {\n                await onSaveDraft(payload);\n            } else {\n                await onPublish(payload);\n            }"
);

// Find the publish button and replace it with two buttons if onSaveDraft exists
const publishBtnStr = `<button onClick={handlePublish} disabled={uploading} className="w-full bg-[#0A1128] text-white py-8 rounded-[2rem] font-black uppercase tracking-widest text-lg hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-[0.98]">
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
                    </button>`;

const newButtons = `
                    <div className={isPackageMode ? "grid grid-cols-1 md:grid-cols-2 gap-4" : ""}>
                        {isPackageMode && onSaveDraft && (
                            <button onClick={(e) => handlePublish(e, true)} disabled={uploading} className="w-full bg-white border-2 border-slate-200 text-[#0A1128] py-6 md:py-8 rounded-[2rem] font-black uppercase tracking-widest text-sm md:text-lg hover:border-[#FEBA4F] transition-all shadow-sm flex items-center justify-center gap-3 active:scale-[0.98]">
                                {uploading ? (
                                    <div className="w-6 h-6 border-4 border-[#0A1128]/20 border-t-[#0A1128] rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Layers size={24} className="text-slate-400" />
                                        Shrani v zbirko (Osnutek)
                                    </>
                                )}
                            </button>
                        )}
                        <button onClick={(e) => handlePublish(e, false)} disabled={uploading} className="w-full bg-[#0A1128] text-white py-6 md:py-8 rounded-[2rem] font-black uppercase tracking-widest text-sm md:text-lg hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-[0.98]">
                            {uploading ? (
                                <>
                                    <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    {t('processing')}
                                </>
                            ) : (
                                <>
                                    <Gavel size={24} />
                                    {isPackageMode ? 'Objavi zdaj v živo' : t('publishAuction')}
                                </>
                            )}
                        </button>
                    </div>
`;

code = code.replace(publishBtnStr, newButtons);
fs.writeFileSync('src/components/CreateAuctionForm.tsx', code);
console.log('patched create auction form');

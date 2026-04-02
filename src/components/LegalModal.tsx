import React from 'react';
import { X } from 'lucide-react';

export const LegalModal: React.FC<{ type: 'terms' | 'privacy' | 'how'; onClose: () => void; t: any }> = ({ type, onClose, t }) => {
    const titles = { terms: t('legalTerms'), privacy: t('legalPrivacy'), how: t('legalHow') };
    const content = {
        terms: "Splošni pogoji poslovanja spletne platforme Drazba.si urejajo pravice in obveznosti ponudnikov in dražiteljev. Vsaka oddana ponudba je pravno zavezujoča po 18. členu Zakona o dražbah. Neplačilo v 24 urah po končani dražbi se obravnava kot kršitev pogodbe.",
        privacy: "Skladno z uredbo GDPR vaše podatke varujemo z najvišjimi varnostnimi standardi. Podatki se uporabljajo izključno za namene izvedbe dražb in verifikacije uporabnikov. Vaši podatki ne bodo posredovani tretjim osebam brez vaše privolitve.",
        how: "Za sodelovanje se registrirajte, opravite verifikacijo in oddajte svojo prvo ponudbo. Dražbe delujejo po sistemu 'videno-kupljeno'. Vsako prebitje ponudbe v zadnji minuti podaljša dražbo za dodatni 2 minuti."
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0A1128]/95 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative bg-white w-full max-w-2xl rounded-[3rem] p-10 lg:p-14 shadow-2xl animate-in border-4 border-[#FEBA4F]">
                <button onClick={onClose} className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24} /></button>
                <h3 className="text-3xl font-black text-[#0A1128] uppercase tracking-tighter mb-8">{titles[type]}</h3>
                <div className="text-slate-600 font-bold leading-relaxed text-lg whitespace-pre-line mb-10">
                    {content[type]}
                </div>
                <button onClick={onClose} className="w-full bg-[#0A1128] text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl">Razumem</button>
            </div>
        </div>
    );
};

const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

const targetStr = `<div className="flex flex-col gap-3 w-full lg:w-auto shrink-0">
                        <button
                          onClick={() => {
                            setSelectedItem(soldItem);
                            setActiveView("detail");
                            window.scrollTo({ top: 0, behavior: "instant" });
                          }}
                          className="bg-slate-100 text-[#0A1128] px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#FEBA4F] transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          Odpri dražbo
                        </button>`;

const replacementStr = `<div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
                        <div className="flex flex-col gap-3 flex-1 min-w-[180px]">
                        <button
                          onClick={() => {
                            setSelectedItem(soldItem);
                            setActiveView("detail");
                            window.scrollTo({ top: 0, behavior: "instant" });
                          }}
                          className="bg-slate-100 text-[#0A1128] px-4 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#FEBA4F] transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          Odpri dražbo
                        </button>`;

content = content.replace(targetStr, replacementStr);

const targetStr2 = `                        {soldItem.payment_status === "paid" && (
                          <button
                            onClick={() => {
                              setInvoiceModalData({
                                isOpen: true,
                                auction: soldItem,
                                seller: userData,
                                buyer: buyer
                              });
                            }}
                            className="bg-slate-100 text-[#0A1128] border-2 border-slate-200 px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm hover:border-slate-400 hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                          >
                            <FileText size={18} /> Račun
                          </button>
                        )}

                        {/* Sporočila button: ONLY shown for personal pickup, NOT for postal shipping */}
                        {!isPostalShipping && (
                          <button
                            onClick={() => {
                              setActiveConversationId(soldItem.id);
                              setActiveView("messages");
                              window.scrollTo({ top: 0, behavior: "instant" });
                            }}
                            className="bg-[#FEBA4F] text-[#0A1128] px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#0A1128] hover:text-[#FEBA4F] transition-all flex items-center justify-center gap-2 shadow-sm"
                          >
                            <MessageSquare size={18} /> Sporočila
                          </button>
                        )}`;

const replacementStr2 = `                        {soldItem.payment_status === "paid" && (
                          <button
                            onClick={() => {
                              setInvoiceModalData({
                                isOpen: true,
                                auction: soldItem,
                                seller: userData,
                                buyer: buyer
                              });
                            }}
                            className="bg-slate-100 text-[#0A1128] border-2 border-slate-200 px-4 py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm hover:border-slate-400 hover:bg-slate-200 transition-all flex items-center justify-center gap-2 mt-auto"
                          >
                            <FileText size={16} /> Račun
                          </button>
                        )}
                        </div>
                        <div className="flex flex-col gap-3 flex-1 min-w-[180px]">
                        {/* Sporočila button: ONLY shown for personal pickup, NOT for postal shipping */}
                        {!isPostalShipping ? (
                          <button
                            onClick={() => {
                              setActiveConversationId(soldItem.id);
                              setActiveView("messages");
                              window.scrollTo({ top: 0, behavior: "instant" });
                            }}
                            className="bg-[#FEBA4F] text-[#0A1128] px-4 py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#0A1128] hover:text-[#FEBA4F] transition-all flex items-center justify-center gap-2 shadow-sm"
                          >
                            <MessageSquare size={16} /> Sporočila
                          </button>
                        ) : (
                          <div className="h-[52px] hidden sm:block"></div>
                        )}`;

content = content.replace(targetStr2, replacementStr2);

fs.writeFileSync('App.tsx', content);

const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

const targetStr = `                      <div className="flex flex-col gap-3 w-full md:w-auto">
                        {wonItem.payment_status === "paid" ? (
                          <div className="flex flex-col items-center md:items-end gap-2">
                            <div className="bg-green-50 text-green-600 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-2 border-2 border-green-100">
                              <CheckCircle2 size={18} /> Plačano
                            </div>
                            {wonItem.paid_at && (
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                Plačano dne:{" "}
                                {new Date(wonItem.paid_at).toLocaleDateString(
                                  "sl-SI",
                                )}
                              </span>
                            )}
                            {wonItem.buyer_received ? (
                              <div className="mt-2 text-green-500 font-bold text-xs uppercase flex items-center gap-1">
                                <CheckCircle2 size={14} /> Predmet prejet
                              </div>
                            ) : (
                              <button
                                onClick={() =>
                                  setReceiptConfirmModal({
                                    isOpen: true,
                                    auctionId: wonItem.id,
                                    sellerId: wonItem.sellerId,
                                  })
                                }
                                className="mt-2 bg-white border-2 border-slate-200 text-[#0A1128] px-4 py-2 rounded-xl font-bold text-xs hover:border-[#FEBA4F] transition-all"
                              >
                                Potrdi prejem
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const seller = usersMap.get(wonItem.sellerId);
                                setInvoiceModalData({
                                  isOpen: true,
                                  auction: wonItem,
                                  seller: seller,
                                  buyer: userData
                                });
                              }}
                              className="mt-2 bg-slate-100 text-[#0A1128] border-2 border-slate-200 px-4 py-2 rounded-xl font-bold text-xs hover:border-slate-400 hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5"
                            >
                              <FileText size={14} /> Račun
                            </button>
                            {wonItem.delivery_method !== "post" && (
                              <button
                                onClick={() => {
                                  setActiveConversationId(wonItem.id);
                                  setActiveView("messages");
                                  window.scrollTo({
                                    top: 0,
                                    behavior: "instant",
                                  });
                                }}
                                className="mt-2 bg-[#FEBA4F] text-[#0A1128] px-4 py-2 rounded-xl font-bold text-xs hover:bg-white hover:border hover:border-[#FEBA4F] transition-all flex items-center justify-center gap-2"
                              >
                                <MessageSquare size={14} /> Sporočila
                              </button>
                            )}
                          </div>
                        ) : (`;

const replacementStr = `                      <div className="flex flex-col gap-3 w-full lg:w-auto shrink-0 mt-4 md:mt-0">
                        {wonItem.payment_status === "paid" ? (
                          <div className="flex flex-col items-center md:items-end gap-3 w-full">
                            <div className="flex flex-col items-center md:items-end gap-1 w-full">
                              <div className="bg-green-50 text-green-600 px-6 py-2 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-2 border-2 border-green-100 w-full justify-center md:w-auto md:justify-end">
                                <CheckCircle2 size={16} /> Plačano
                              </div>
                              {wonItem.paid_at && (
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                  Plačano dne:{" "}
                                  {new Date(wonItem.paid_at).toLocaleDateString(
                                    "sl-SI",
                                  )}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 w-full shrink-0">
                              <div className="flex flex-col gap-3 flex-1 min-w-[150px]">
                                <button
                                  onClick={() => {
                                    setSelectedItem(wonItem);
                                    setActiveView("detail");
                                    window.scrollTo({ top: 0, behavior: "instant" });
                                  }}
                                  className="bg-slate-100 text-[#0A1128] px-4 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#FEBA4F] transition-all shadow-sm flex items-center justify-center gap-2 h-[42px]"
                                >
                                  Odpri dražbo
                                </button>
                                
                                <button
                                  onClick={() => {
                                    const seller = usersMap.get(wonItem.sellerId);
                                    setInvoiceModalData({
                                      isOpen: true,
                                      auction: wonItem,
                                      seller: seller,
                                      buyer: userData
                                    });
                                  }}
                                  className="bg-slate-100 text-[#0A1128] border-2 border-slate-200 px-4 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:border-slate-400 hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5 h-[42px] mt-auto"
                                >
                                  <FileText size={14} /> Račun
                                </button>
                              </div>

                              <div className="flex flex-col gap-3 flex-1 min-w-[150px]">
                                {wonItem.delivery_method !== "post" ? (
                                  <button
                                    onClick={() => {
                                      setActiveConversationId(wonItem.id);
                                      setActiveView("messages");
                                      window.scrollTo({
                                        top: 0,
                                        behavior: "instant",
                                      });
                                    }}
                                    className="bg-[#FEBA4F] text-[#0A1128] px-4 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#0A1128] hover:text-[#FEBA4F] transition-all flex items-center justify-center gap-2 h-[42px]"
                                  >
                                    <MessageSquare size={14} /> Sporočila
                                  </button>
                                ) : (
                                  <div className="h-[42px] hidden sm:block"></div>
                                )}

                                <div className="flex flex-col items-center justify-center gap-2 mt-auto h-[42px] w-full">
                                  {wonItem.buyer_received ? (
                                    <div className="text-green-500 font-bold text-[10px] uppercase flex items-center gap-1 w-full justify-center bg-green-50 py-2 rounded-xl border border-green-100">
                                      <CheckCircle2 size={12} /> Predmet prejet
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        setReceiptConfirmModal({
                                          isOpen: true,
                                          auctionId: wonItem.id,
                                          sellerId: wonItem.sellerId,
                                        })
                                      }
                                      className="bg-white border-2 border-slate-200 text-[#0A1128] px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:border-[#FEBA4F] transition-all w-full h-[42px] flex items-center justify-center"
                                    >
                                      Potrdi prejem
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (`;

content = content.replace(targetStr, replacementStr);

fs.writeFileSync('App.tsx', content);

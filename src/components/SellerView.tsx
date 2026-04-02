import React, { useState, useMemo } from 'react';
import { 
  Star, MapPin, Calendar, Building2, User, CheckCircle2, 
  TrendingUp, History, MessageSquare, ArrowLeft, ShieldCheck,
  Award, Package, ThumbsUp, AlertCircle
} from 'lucide-react';
import { Seller, AuctionItem, Review, Region } from '../../types';
import { MOCK_REVIEWS } from '../../data';

interface SellerViewProps {
  seller: Seller;
  onBack: () => void;
  onAuctionClick: (item: AuctionItem) => void;
  t: any;
  language: string;
  isLoggedIn: boolean;
  currentUserWinnings?: AuctionItem[];
  auctions: AuctionItem[];
}

const SellerView: React.FC<SellerViewProps> = ({ 
  seller, onBack, onAuctionClick, t, language, isLoggedIn, currentUserWinnings = [], auctions
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'past' | 'reviews'>('active');
  const [newReview, setNewReview] = useState({ rating: 5, comment: '', wouldRecommend: true });
  const [reviews, setReviews] = useState<Review[]>(MOCK_REVIEWS[seller.id] || []);

  const sellerAuctions = useMemo(() => 
    auctions.filter(a => a.sellerId === seller.id),
  [seller.id, auctions]);

  const activeAuctions = useMemo(() => 
    sellerAuctions.filter(a => a.status === 'active'),
  [sellerAuctions]);

  const pastAuctions = useMemo(() => 
    sellerAuctions.filter(a => a.status === 'completed'),
  [sellerAuctions]);

  const canLeaveReview = isLoggedIn && currentUserWinnings.some(w => w.sellerId === seller.id);

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReview.comment) return;

    const review: Review = {
      id: `rev-${Date.now()}`,
      author: 'Trenutni uporabnik',
      rating: newReview.rating,
      comment: newReview.comment,
      date: new Date().toLocaleDateString('sl-SI'),
      isVerified: true,
      wouldRecommend: newReview.wouldRecommend
    };

    setReviews([review, ...reviews]);
    setNewReview({ rating: 5, comment: '', wouldRecommend: true });
  };

  return (
    <div className="max-w-[1600px] mx-auto py-16 px-6 animate-in">
      {/* Back Button */}
      <button 
        onClick={onBack} 
        className="flex items-center gap-2 text-slate-400 mb-10 font-black uppercase text-[10px] tracking-widest hover:text-[#0A1128] transition-colors"
      >
        <ArrowLeft size={16}/> {t('back')}
      </button>

      {/* Seller Header Card */}
      <div className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-100 mb-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FEBA4F]/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        
        <div className="flex flex-col lg:flex-row gap-12 relative z-10">
          {/* Profile Picture / Icon */}
          <div className="flex-shrink-0">
            <div className="w-32 h-32 lg:w-48 lg:h-48 rounded-[3rem] bg-slate-50 border-4 border-white shadow-xl flex items-center justify-center overflow-hidden relative group">
              {seller.type === 'business' ? (
                <Building2 size={64} className="text-slate-300 group-hover:scale-110 transition-transform" />
              ) : (
                <User size={64} className="text-slate-300 group-hover:scale-110 transition-transform" />
              )}
              <div className="absolute bottom-4 right-4 bg-green-500 text-white p-2 rounded-2xl shadow-lg">
                <ShieldCheck size={20} />
              </div>
            </div>
          </div>

          {/* Seller Info */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter text-[#0A1128] italic">
                {seller.name[language] || seller.name['SLO']}
              </h1>
              <div className="bg-[#FEBA4F]/10 text-[#FEBA4F] px-4 py-1.5 rounded-xl font-black uppercase text-[10px] tracking-widest border border-[#FEBA4F]/20">
                {seller.type === 'business' ? t('businessSeller') : t('individualSeller')}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-slate-400 font-bold mb-8">
              <span className="flex items-center gap-2"><MapPin size={18} className="text-[#FEBA4F]" /> {seller.location[language] || seller.location['SLO']}</span>
              <span className="flex items-center gap-2"><Calendar size={18} className="text-[#FEBA4F]" /> {t('memberSince')} {seller.memberSince}</span>
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-lg">
                <Star size={16} className="text-[#FEBA4F] fill-[#FEBA4F]" />
                <span className="text-[#0A1128] font-black">{seller.rating}</span>
                <span className="text-slate-400">({seller.reviewCount} {t('userReviewsTab').toLowerCase()})</span>
              </div>
            </div>

            <p className="text-slate-600 font-bold leading-relaxed text-lg max-w-3xl mb-10">
              {seller.description[language] || seller.description['SLO']}
            </p>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('totalSold')}</p>
                <p className="text-2xl font-black text-[#0A1128]">{seller.totalSold}</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('positiveFeedback')}</p>
                <p className="text-2xl font-black text-green-600">{seller.positiveFeedback}%</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('activeAuctionsTab')}</p>
                <p className="text-2xl font-black text-[#FEBA4F]">{activeAuctions.length}</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('verifiedStatus')}</p>
                <div className="flex items-center gap-2 text-green-600 font-black text-sm uppercase">
                  <CheckCircle2 size={16} /> {t('verifiedSeller')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-8 mb-12 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('active')}
          className={`pb-6 text-sm font-black uppercase tracking-widest transition-all relative ${activeTab === 'active' ? 'text-[#0A1128]' : 'text-slate-400 hover:text-[#0A1128]'}`}
        >
          <div className="flex items-center gap-2"><TrendingUp size={18}/> {t('activeAuctionsTab')} ({activeAuctions.length})</div>
          {activeTab === 'active' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#FEBA4F] rounded-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('past')}
          className={`pb-6 text-sm font-black uppercase tracking-widest transition-all relative ${activeTab === 'past' ? 'text-[#0A1128]' : 'text-slate-400 hover:text-[#0A1128]'}`}
        >
          <div className="flex items-center gap-2"><History size={18}/> {t('pastAuctionsTab')} ({pastAuctions.length})</div>
          {activeTab === 'past' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#FEBA4F] rounded-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('reviews')}
          className={`pb-6 text-sm font-black uppercase tracking-widest transition-all relative ${activeTab === 'reviews' ? 'text-[#0A1128]' : 'text-slate-400 hover:text-[#0A1128]'}`}
        >
          <div className="flex items-center gap-2"><MessageSquare size={18}/> {t('userReviewsTab')} ({reviews.length})</div>
          {activeTab === 'reviews' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#FEBA4F] rounded-full"></div>}
        </button>
      </div>

      {/* Tab Content */}
      <div className="animate-in">
        {activeTab === 'active' && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-10">
            {activeAuctions.length > 0 ? (
              activeAuctions.map(item => (
                <div key={item.id} onClick={() => onAuctionClick(item)} className="cursor-pointer">
                  {/* Reuse the card style logic here or pass a simplified card component */}
                  <div className="bg-[#0A1128] rounded-[2.5rem] overflow-hidden shadow-2xl hover:-translate-y-2 transition-all duration-300 group flex flex-col h-full border border-white/5 relative">
                    <div className="relative h-64 overflow-hidden">
                      <img src={item.images[0]} alt={item.title[language]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-90 group-hover:opacity-100" />
                      <div className="absolute top-4 left-4 bg-[#0A1128]/90 backdrop-blur-sm px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white shadow-lg flex items-center gap-1.5 border border-white/10">
                        <MapPin size={10} className="text-[#FEBA4F]" /> {item.location[language] || item.location['SLO']}
                      </div>
                      <div className="absolute top-4 right-4 bg-[#FEBA4F] text-[#0A1128] backdrop-blur-sm px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg">
                        {item.region}
                      </div>
                    </div>
                    <div className="p-8 flex flex-col flex-1">
                      <h3 className="text-lg font-black leading-tight text-white hover:text-[#FEBA4F] transition-colors line-clamp-2 mb-4">{item.title[language] || item.title['SLO']}</h3>
                      <div className="mt-auto pt-6 border-t border-white/10">
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('currentBid')}</p>
                            <p className="text-2xl font-black text-[#FEBA4F]">€{item.currentBid.toLocaleString('sl-SI')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('bidCount')}</p>
                            <p className="text-sm font-black text-[#FEBA4F]">{item.bidCount}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-24 text-center">
                <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                  <TrendingUp size={40} />
                </div>
                <p className="text-slate-400 font-bold text-xl">{t('noActiveAuctions')}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'past' && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-10">
            {pastAuctions.length > 0 ? (
              pastAuctions.map(item => (
                <div key={item.id} className="opacity-75 grayscale hover:grayscale-0 transition-all">
                   <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-100 flex flex-col h-full relative">
                    <div className="relative h-64 overflow-hidden">
                      <img src={item.images[0]} alt={item.title[language]} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="bg-white text-[#0A1128] px-6 py-2 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl">
                          {t('ended')}
                        </div>
                      </div>
                    </div>
                    <div className="p-8 flex flex-col flex-1">
                      <h3 className="text-lg font-black leading-tight text-[#0A1128] line-clamp-2 mb-4">{item.title[language] || item.title['SLO']}</h3>
                      <div className="mt-auto pt-6 border-t border-slate-100">
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('finalPrice')}</p>
                            <p className="text-2xl font-black text-[#0A1128]">€{item.currentBid.toLocaleString('sl-SI')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('bidCount')}</p>
                            <p className="text-sm font-black text-[#0A1128]">{item.bidCount}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-24 text-center">
                <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                  <History size={40} />
                </div>
                <p className="text-slate-400 font-bold text-xl">{t('noPastAuctions')}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="max-w-4xl mx-auto">
            {/* Add Review Section */}
            {canLeaveReview && (
              <div className="bg-slate-50 rounded-[3rem] p-10 border-2 border-dashed border-slate-200 mb-12">
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-[#FEBA4F] p-3 rounded-2xl shadow-lg">
                    <Award size={24} className="text-[#0A1128]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-[#0A1128] uppercase tracking-tighter italic">{t('leaveReview')}</h3>
                    <p className="text-slate-400 font-bold">{t('reviewNotice')}</p>
                  </div>
                </div>

                <form onSubmit={handleAddReview} className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('rating')}</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button 
                            key={star} 
                            type="button"
                            onClick={() => setNewReview({...newReview, rating: star})}
                            className={`p-2 rounded-xl transition-all ${newReview.rating >= star ? 'text-[#FEBA4F] bg-[#FEBA4F]/10' : 'text-slate-300 bg-white'}`}
                          >
                            <Star size={24} fill={newReview.rating >= star ? 'currentColor' : 'none'} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 flex-1">
                       <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('recommend')}</label>
                       <div className="flex gap-3">
                          <button 
                            type="button"
                            onClick={() => setNewReview({...newReview, wouldRecommend: true})}
                            className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all border-2 ${newReview.wouldRecommend ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-slate-100 text-slate-400'}`}
                          >
                            {t('yesRecommend')}
                          </button>
                          <button 
                            type="button"
                            onClick={() => setNewReview({...newReview, wouldRecommend: false})}
                            className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all border-2 ${!newReview.wouldRecommend ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-100 text-slate-400'}`}
                          >
                            {t('noRecommend')}
                          </button>
                       </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('comment')}</label>
                    <textarea 
                      value={newReview.comment}
                      onChange={e => setNewReview({...newReview, comment: e.target.value})}
                      placeholder={t('commentPlaceholder')}
                      className="w-full bg-white border border-slate-200 rounded-2xl py-5 px-6 font-bold h-32 outline-none focus:border-[#FEBA4F] transition-all resize-none"
                    />
                  </div>

                  <button type="submit" className="w-full bg-[#0A1128] text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl">
                    {t('publishReview')}
                  </button>
                </form>
              </div>
            )}

            {!canLeaveReview && isLoggedIn && (
              <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 mb-12 flex items-center gap-4 text-slate-500">
                <AlertCircle size={20} />
                <p className="text-sm font-bold">{t('reviewRestriction')}</p>
              </div>
            )}

            {/* Reviews List */}
            <div className="space-y-6">
              {reviews.length > 0 ? (
                reviews.map(review => (
                  <div key={review.id} className="bg-white rounded-[2.5rem] p-8 shadow-lg border border-slate-100">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-[#0A1128] font-black border border-slate-100">
                          {review.author[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-[#0A1128]">{review.author}</h4>
                            {review.isVerified && <CheckCircle2 size={14} className="text-green-500" />}
                          </div>
                          <p className="text-[10px] font-black text-slate-400 uppercase">{review.date}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} size={14} className={s <= review.rating ? 'text-[#FEBA4F] fill-[#FEBA4F]' : 'text-slate-200'} />
                        ))}
                      </div>
                    </div>
                    <p className="text-slate-600 font-bold leading-relaxed mb-6 italic">"{review.comment}"</p>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                      {review.wouldRecommend ? (
                        <span className="text-green-600 flex items-center gap-1.5"><ThumbsUp size={14} /> {t('yesRecommend')}</span>
                      ) : (
                        <span className="text-red-500 flex items-center gap-1.5">{t('noRecommend')}</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-24 text-center">
                  <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                    <MessageSquare size={40} />
                  </div>
                  <p className="text-slate-400 font-bold text-xl">{t('noReviews')}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerView;

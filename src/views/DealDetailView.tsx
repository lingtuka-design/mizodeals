import React, { useState, useEffect } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { useData } from '../context/DataContext';
import { STORE_BADGES } from '../config/constants';
import { formatINR, getDealSavings, copyTextToClipboard } from '../utils/formatters';
import { shareDealToWhatsApp, generateWhatsAppDealShareText, getDealLandingUrl } from '../utils/affiliate';
import { isLootDeal, isDealExpired, formatDealTime, getHighResImageUrl } from '../utils/dealLogic';
import { PriceHistoryChart } from '../components/deals/PriceHistoryChart';
import { PriceAlertModal } from '../components/common/PriceAlertModal';
import { DealCard } from '../components/deals/DealCard';
import { useBookmarks } from '../hooks/useBookmarks';
import { useToast } from '../components/common/Toast';
import type { Deal } from '../types';
import { 
  ArrowLeft, 
  ExternalLink, 
  Share2, 
  Heart, 
  Flame, 
  Star, 
  Truck, 
  ShieldCheck, 
  BellRing,
  Copy,
  AlertTriangle,
  Sparkles
} from 'lucide-react';

export const DealDetailView: React.FC = () => {
  const { id } = useParams({ strict: false }) as { id: string };
  const { deals } = useData();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const { showToast } = useToast();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [fetchedDeal, setFetchedDeal] = useState<Deal | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [liveSync, setLiveSync] = useState<{
    price?: number;
    originalPrice?: number;
    discountPercent?: number;
    isAvailable?: boolean;
    isLive: boolean;
  } | null>(null);

  const currentId = id?.toLowerCase() || '';
  const initialDeal = deals.find(
    (d) => d.id.toLowerCase() === currentId || d.asin.toLowerCase() === currentId
  );
  const deal = initialDeal || fetchedDeal;

  useEffect(() => {
    if (!deal && currentId) {
      setIsSearching(true);
      fetch('/api/deals?status=all&limit=100')
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data: any) => {
          if (data?.success && Array.isArray(data.deals)) {
            const match = data.deals.find(
              (d: any) =>
                d.id?.toLowerCase() === currentId || d.asin?.toLowerCase() === currentId
            );
            if (match) setFetchedDeal(match);
          }
        })
        .catch(() => {})
        .finally(() => setIsSearching(false));
    }
  }, [currentId, deal]);

  useEffect(() => {
    if (deal?.asin && (!deal.store || deal.store === 'amazon') && /^[A-Z0-9]{10}$/i.test(deal.asin)) {
      fetch(`/api/deal?asin=${deal.asin}`)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data: any) => {
          if (data?.success) {
            setLiveSync({
              price: typeof data.livePrice === 'number' ? data.livePrice : undefined,
              originalPrice: typeof data.liveMrp === 'number' ? data.liveMrp : undefined,
              discountPercent: typeof data.discountPercent === 'number' ? data.discountPercent : undefined,
              isAvailable: data.isAvailable,
              isLive: true,
            });
          }
        })
        .catch(() => {});
    }
  }, [deal?.asin, deal?.store]);

  if (isSearching) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-stone-800 border-t-transparent mb-4"></div>
        <p className="text-sm font-medium text-stone-600">Loading deal details...</p>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-stone-900 mb-2">Deal Not Found</h2>
        <p className="text-sm text-stone-500 mb-6">This deal may have been removed or link is incorrect.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-xl hover:bg-stone-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Browse All Deals</span>
        </Link>
      </div>
    );
  }

  const currentDealPrice = liveSync?.price ?? deal.dealPrice;
  const currentOriginalPrice = liveSync?.originalPrice ?? deal.originalPrice;
  const currentDiscountPercent = liveSync?.discountPercent ?? deal.discountPercent;
  const { savingsAmount } = getDealSavings(currentOriginalPrice, currentDealPrice);
  const storeBadge = STORE_BADGES[deal.store] || STORE_BADGES.amazon;
  const bookmarked = isBookmarked(deal.id);
  const isAvailable = liveSync ? liveSync.isAvailable !== false : true;
  const isExpired = isDealExpired(deal) || !isAvailable || (liveSync?.isLive && currentDiscountPercent < 15);
  const isLoot = !isExpired && currentDiscountPercent >= 50;

  // Active alternative deals (same category or active loot deals)
  const activeAlternatives = deals
    .filter((d) => d.id !== deal.id && !isDealExpired(d))
    .slice(0, 4);

  const handleCopyLink = async () => {
    const success = await copyTextToClipboard(getDealLandingUrl(deal));
    if (success) showToast('Mizodeals link copied!', 'success');
  };

  const handleCopyWhatsAppCopy = async () => {
    const text = generateWhatsAppDealShareText(deal);
    const success = await copyTextToClipboard(text);
    if (success) showToast('WhatsApp deal message copied!', 'success');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Deals</span>
        </Link>
      </div>

      {/* EXPIRED DEAL NOTIFICATION BANNER */}
      {isExpired && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-amber-900">
              He deal hi a expired tawh a, thil man hi a to leh tawh a ni maithei!
            </h3>
            <p className="text-xs text-amber-800/90 mt-0.5 leading-relaxed">
              Amazon-in flash price discount an ti tawp tawh a ni thei. Hnuai lamah hian Amazon-a a man thar i check thei a, emaw thil dang a tlawm lai (active deals) kan rawt te hi i en nghal thei e.
            </p>
          </div>
        </div>
      )}

      <div className={`bg-white border rounded-3xl p-6 sm:p-10 shadow-xs space-y-8 ${
        isExpired ? 'border-stone-300/80 bg-stone-50/30' : 'border-[#EAE6DF]'
      }`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Image */}
          <a
            href={deal.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[#FAF9F5] border border-[#EAE6DF] block group cursor-pointer"
            title={`Open ${deal.title} on ${storeBadge.name}`}
          >
            <img
              src={getHighResImageUrl(deal.imageUrl, deal.asin, deal.store)}
              alt={deal.title}
              onLoad={(e) => {
                if (e.currentTarget.naturalWidth <= 2 && deal.imageUrl) {
                  e.currentTarget.src = deal.imageUrl;
                }
              }}
              onError={(e) => {
                if (deal.imageUrl && e.currentTarget.src !== deal.imageUrl) {
                  e.currentTarget.src = deal.imageUrl; // Fallback to original image
                }
              }}
              className={`w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300 ${isExpired ? 'opacity-80 grayscale-[20%]' : ''}`}
            />
            {isExpired ? (
              <div className="absolute top-3 left-3">
                <span className="bg-stone-800 text-white text-xs font-bold px-2.5 py-1 rounded-xl shadow-sm flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  DEAL EXPIRED
                </span>
              </div>
            ) : (
              <div className="absolute top-3 left-3">
                <span className="bg-emerald-600 text-white text-xs font-black px-2.5 py-1 rounded-xl shadow-sm">
                  {currentDiscountPercent}% OFF
                </span>
              </div>
            )}
          </a>

          {/* Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {isExpired ? (
                <span className="inline-flex items-center gap-1 bg-stone-700 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                  ❌ PRICE CHANGED
                </span>
              ) : isLoot ? (
                <span className="inline-flex items-center gap-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-extrabold px-2.5 py-0.5 rounded-full shadow-xs">
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  LOOT DEAL
                </span>
              ) : null}

              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${storeBadge.bg} ${storeBadge.text} ${storeBadge.border}`}>
                {storeBadge.name}
              </span>
              <span className="text-xs text-stone-500">{formatDealTime(deal.createdAt)}</span>
            </div>

            <a
              href={deal.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={`text-xl sm:text-2xl font-bold leading-snug hover:text-orange-600 transition-colors block cursor-pointer ${isExpired ? 'text-stone-600' : 'text-stone-900'}`}
              title={`Open ${deal.title} on ${storeBadge.name}`}
            >
              <h1>{deal.title}</h1>
            </a>

            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg text-xs font-bold text-amber-800">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>{deal.rating}</span>
              </div>
              <span className="text-xs text-stone-500">
                {deal.ratingsCount.toLocaleString('en-IN')} Customer Ratings
              </span>
            </div>

            {/* Pricing Card */}
            <div className="p-4 bg-[#FAF9F5] border border-[#EAE6DF] rounded-2xl">
              {liveSync?.isLive && isAvailable && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Amazon Official Live Price Sync</span>
                </div>
              )}
              {isExpired ? (
                <div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-bold text-stone-600">
                      Was Deal Price: {formatINR(currentDealPrice)}
                    </span>
                    <span className="text-sm font-semibold text-stone-400 line-through">
                      MRP {formatINR(currentOriginalPrice)}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-amber-800 mt-1">
                    {!isAvailable
                      ? 'He thil hi Amazon-ah a zo rih (Out of Stock) a ni.'
                      : 'Special promotional discount has expired. Amazon live price may be higher.'}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-black text-stone-900 tracking-tight">
                      {formatINR(currentDealPrice)}
                    </span>
                    <span className="text-base font-semibold text-stone-400 line-through">
                      {formatINR(currentOriginalPrice)}
                    </span>
                  </div>
                  {savingsAmount > 0 && (
                    <p className="text-xs font-bold text-emerald-700 mt-1">
                      Instant Discount: {formatINR(savingsAmount)} ({currentDiscountPercent}% OFF)
                    </p>
                  )}
                  {deal.couponText && (
                    <div className="mt-2 text-xs font-medium bg-amber-100/80 text-amber-900 border border-amber-300 rounded-lg p-2">
                      🎟️ {deal.couponText}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Northeast Delivery Note */}
            <div className="flex items-start gap-2 text-xs text-stone-600 bg-white p-3 rounded-xl border border-[#EAE6DF]">
              <Truck className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
              <span>
                <strong>Mizoram Delivery:</strong> Eligible for Amazon India delivery across Aizawl, Lunglei, Champhai, and surrounding pincodes.
              </span>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              {isExpired ? (
                <a
                  href={deal.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-sm rounded-xl border border-stone-300 transition-colors"
                >
                  <span>Check Current Price on Amazon</span>
                  <ExternalLink className="w-4 h-4 text-stone-600" />
                </a>
              ) : (
                <a
                  href={deal.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm rounded-xl shadow-xs transition-colors"
                >
                  <span>Buy Now on {storeBadge.name}</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => shareDealToWhatsApp(deal)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-semibold text-xs rounded-xl border border-[#25D366]/40 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#25D366]" />
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAlertOpen(true)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs rounded-xl border border-[#EAE6DF] transition-colors"
                >
                  <BellRing className="w-3.5 h-3.5 text-orange-600" />
                  <span>Price Alert</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    toggleBookmark(deal.id);
                    showToast(bookmarked ? 'Removed from saved deals' : 'Saved to wishlist', 'info');
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 font-semibold text-xs rounded-xl border transition-colors ${
                    bookmarked 
                      ? 'bg-rose-50 text-rose-600 border-rose-200' 
                      : 'bg-stone-100 text-stone-700 border-[#EAE6DF] hover:bg-stone-200'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${bookmarked ? 'fill-current' : ''}`} />
                  <span>{bookmarked ? 'Saved' : 'Save'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Price History Chart */}
        <PriceHistoryChart
          history={deal.priceHistory}
          originalPrice={deal.originalPrice}
          dealPrice={deal.dealPrice}
          lowestEverPrice={deal.lowestEverPrice}
        />

        {/* Affiliate Verification Footer */}
        <div className="pt-6 border-t border-[#EAE6DF] flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Verified Amazon Associate Partner (`lalmalsawmtlu-21`)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1 text-xs font-semibold text-stone-700 hover:text-stone-900 underline underline-offset-2"
            >
              <Copy className="w-3 h-3" /> Copy Link
            </button>
            <span className="text-stone-300">|</span>
            <button
              type="button"
              onClick={handleCopyWhatsAppCopy}
              className="inline-flex items-center gap-1 text-xs font-semibold text-stone-700 hover:text-stone-900 underline underline-offset-2"
            >
              Copy WhatsApp Copy
            </button>
          </div>
        </div>
      </div>

      {/* RECOMMENDED ACTIVE DEALS FOR EXPIRED ITEMS */}
      {isExpired && activeAlternatives.length > 0 && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-600" />
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-900">
                A Tlawm Lai Deal Active Dangte (Alternative Deals)
              </h3>
              <p className="text-xs text-stone-500">
                He thil man a to leh tak avangin heng a hnuaia active loot deal-te hi thlang rawh le:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeAlternatives.map((altDeal) => (
              <DealCard
                key={altDeal.id}
                deal={altDeal}
                isBookmarked={isBookmarked(altDeal.id)}
                onToggleBookmark={toggleBookmark}
              />
            ))}
          </div>
        </div>
      )}

      <PriceAlertModal
        deal={deal}
        isOpen={isAlertOpen}
        onClose={() => setIsAlertOpen(false)}
      />
    </div>
  );
};

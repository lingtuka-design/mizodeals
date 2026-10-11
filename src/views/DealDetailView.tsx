import React, { useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { INITIAL_DEALS } from '../data/deals';
import { STORE_BADGES } from '../config/constants';
import { formatINR, getDealSavings, copyTextToClipboard } from '../utils/formatters';
import { shareDealToWhatsApp, generateWhatsAppDealShareText } from '../utils/affiliate';
import { PriceHistoryChart } from '../components/deals/PriceHistoryChart';
import { PriceAlertModal } from '../components/common/PriceAlertModal';
import { useBookmarks } from '../hooks/useBookmarks';
import { useToast } from '../components/common/Toast';
import { 
  ArrowLeft, 
  ExternalLink, 
  Share2, 
  Heart, 
  Flame, 
  Star, 
  CheckCircle2, 
  Truck, 
  ShieldCheck, 
  BellRing,
  Copy
} from 'lucide-react';

export const DealDetailView: React.FC = () => {
  const { id } = useParams({ strict: false }) as { id: string };
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const { showToast } = useToast();
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const deal = INITIAL_DEALS.find((d) => d.id === id);

  if (!deal) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-stone-900 mb-2">Deal Not Found</h2>
        <p className="text-sm text-stone-500 mb-6">This deal may have expired or is no longer listed.</p>
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

  const { savingsAmount } = getDealSavings(deal.originalPrice, deal.dealPrice);
  const storeBadge = STORE_BADGES[deal.store] || STORE_BADGES.amazon;
  const bookmarked = isBookmarked(deal.id);

  const handleCopyLink = async () => {
    const success = await copyTextToClipboard(deal.affiliateUrl);
    if (success) showToast('Affiliate deal link copied!', 'success');
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

      <div className="bg-white border border-[#EAE6DF] rounded-3xl p-6 sm:p-10 shadow-xs space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Image */}
          <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[#FAF9F5] border border-[#EAE6DF]">
            <img
              src={deal.imageUrl}
              alt={deal.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3">
              <span className="bg-emerald-600 text-white text-xs font-black px-2.5 py-1 rounded-xl shadow-sm">
                {deal.discountPercent}% OFF
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {deal.isLootDeal && (
                <span className="inline-flex items-center gap-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  LOOT DEAL
                </span>
              )}
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${storeBadge.bg} ${storeBadge.text} ${storeBadge.border}`}>
                {storeBadge.name}
              </span>
              <span className="text-xs text-stone-500">{deal.verifiedAt}</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 leading-snug">
              {deal.title}
            </h1>

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
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-black text-stone-900 tracking-tight">
                  {formatINR(deal.dealPrice)}
                </span>
                <span className="text-base font-semibold text-stone-400 line-through">
                  {formatINR(deal.originalPrice)}
                </span>
              </div>
              {savingsAmount > 0 && (
                <p className="text-xs font-bold text-emerald-700 mt-1">
                  Instant Discount: {formatINR(savingsAmount)} ({deal.discountPercent}% OFF)
                </p>
              )}
              {deal.couponText && (
                <div className="mt-2 text-xs font-medium bg-amber-100/80 text-amber-900 border border-amber-300 rounded-lg p-2">
                  🎟️ {deal.couponText}
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
              <a
                href={deal.affiliateUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm rounded-xl shadow-xs transition-colors"
              >
                <span>Buy Now on {storeBadge.name}</span>
                <ExternalLink className="w-4 h-4" />
              </a>

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

        {/* Overview */}
        {deal.description && (
          <div>
            <h3 className="text-base font-bold text-stone-900 mb-2">Description</h3>
            <p className="text-sm text-stone-700 leading-relaxed">{deal.description}</p>
          </div>
        )}

        {/* Highlights */}
        {deal.highlights && deal.highlights.length > 0 && (
          <div>
            <h3 className="text-base font-bold text-stone-900 mb-3">Key Features</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-stone-700">
              {deal.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2 bg-[#FAF9F5] border border-[#EAE6DF] p-2.5 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>
        )}

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

      <PriceAlertModal
        deal={deal}
        isOpen={isAlertOpen}
        onClose={() => setIsAlertOpen(false)}
      />
    </div>
  );
};

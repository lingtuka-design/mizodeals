import React from 'react';
import { 
  X, 
  ExternalLink, 
  Share2, 
  Heart, 
  Flame, 
  Star, 
  CheckCircle2, 
  ShieldCheck, 
  Truck, 
  BellRing,
  Copy
} from 'lucide-react';
import type { Deal } from '../../types';
import { STORE_BADGES } from '../../config/constants';
import { formatINR, getDealSavings, copyTextToClipboard } from '../../utils/formatters';
import { shareDealToWhatsApp, generateWhatsAppDealShareText, getDealLandingUrl } from '../../utils/affiliate';
import { PriceHistoryChart } from './PriceHistoryChart';
import { useToast } from '../common/Toast';
import { getHighResImageUrl } from '../../utils/dealLogic';

interface DealDetailModalProps {
  deal: Deal | null;
  isOpen: boolean;
  onClose: () => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (id: string) => void;
  onOpenAlert?: (deal: Deal) => void;
}

export const DealDetailModal: React.FC<DealDetailModalProps> = ({
  deal,
  isOpen,
  onClose,
  isBookmarked = false,
  onToggleBookmark,
  onOpenAlert,
}) => {
  const { showToast } = useToast();
  const [imgSrc, setImgSrc] = React.useState(deal ? getHighResImageUrl(deal.imageUrl, deal.asin, deal.store) : '');

  React.useEffect(() => {
    if (deal) {
      setImgSrc(getHighResImageUrl(deal.imageUrl, deal.asin, deal.store));
    }
  }, [deal?.imageUrl, deal?.asin, deal?.store]);

  if (!isOpen || !deal) return null;

  const { savingsAmount } = getDealSavings(deal.originalPrice, deal.dealPrice);
  const storeBadge = STORE_BADGES[deal.store] || STORE_BADGES.amazon;

  const handleCopyLink = async () => {
    const success = await copyTextToClipboard(getDealLandingUrl(deal));
    if (success) showToast('Mizodeals link copied!', 'success');
  };

  const handleCopyWhatsAppCopy = async () => {
    const text = generateWhatsAppDealShareText(deal);
    const success = await copyTextToClipboard(text);
    if (success) showToast('WhatsApp viral deal copy copied!', 'success');
  };

  const isExpired = deal.status === 'expired';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white border border-[#EAE6DF] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xs border-b border-[#EAE6DF] px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isExpired ? (
              <span className="inline-flex items-center gap-1 bg-stone-800 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                DEAL EXPIRED
              </span>
            ) : deal.isLootDeal ? (
              <span className="inline-flex items-center gap-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                <Flame className="w-3 h-3 fill-current" />
                LOOT DEAL
              </span>
            ) : null}
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${storeBadge.bg} ${storeBadge.text} ${storeBadge.border}`}>
              {storeBadge.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onToggleBookmark?.(deal.id);
                showToast(isBookmarked ? 'Removed from saved deals' : 'Saved to your deals list', 'info');
              }}
              className={`p-2 rounded-xl border border-[#EAE6DF] transition-colors ${
                isBookmarked ? 'text-rose-500 bg-rose-50' : 'text-stone-500 hover:bg-stone-100'
              }`}
              title={isBookmarked ? 'Remove Bookmark' : 'Bookmark'}
            >
              <Heart className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-100 border border-[#EAE6DF] transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto px-4 sm:px-6 py-5 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            {/* Image section */}
            <a
              href={deal.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[#FAF9F5] border border-[#EAE6DF] block group cursor-pointer"
              title={`Open ${deal.title} on ${storeBadge.name}`}
            >
              <img
                src={imgSrc || deal.imageUrl}
                alt={deal.title}
                onError={(e) => {
                  if (imgSrc !== deal.imageUrl && deal.imageUrl) {
                    setImgSrc(deal.imageUrl);
                  } else if (deal.asin && !e.currentTarget.src.includes('images-eu.ssl-images-amazon.com')) {
                    e.currentTarget.src = `https://images-eu.ssl-images-amazon.com/images/P/${deal.asin}.01.MAIN._SCRMZZZZZZ_.jpg`;
                  }
                }}
                className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute top-3 left-3">
                <span className="bg-emerald-600 text-white text-xs font-black px-2.5 py-1 rounded-xl shadow-sm">
                  {deal.discountPercent}% OFF
                </span>
              </div>
            </a>

            {/* Price & Meta Column */}
            <div className="flex flex-col justify-between">
              <div>
                <a
                  href={deal.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-lg sm:text-xl font-bold text-stone-900 leading-snug hover:text-orange-600 transition-colors block cursor-pointer"
                  title={`Open ${deal.title} on ${storeBadge.name}`}
                >
                  {deal.title}
                </a>

                <div className="flex items-center gap-2.5 mt-3">
                  <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg text-xs font-bold text-amber-800">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span>{deal.rating}</span>
                  </div>
                  <span className="text-xs text-stone-500">
                    {deal.ratingsCount.toLocaleString('en-IN')} Amazon Ratings
                  </span>
                </div>

                {/* Price block */}
                <div className="mt-4 p-3.5 bg-[#FAF9F5] border border-[#EAE6DF] rounded-2xl">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
                      {formatINR(deal.dealPrice)}
                    </span>
                    <span className="text-sm font-semibold text-stone-400 line-through">
                      {formatINR(deal.originalPrice)}
                    </span>
                  </div>
                  {savingsAmount > 0 && (
                    <p className="text-xs font-bold text-emerald-700 mt-1">
                      Direct Savings: {formatINR(savingsAmount)} ({deal.discountPercent}% drop)
                    </p>
                  )}
                  {deal.couponText && (
                    <div className="mt-2 text-xs font-medium bg-amber-100/80 text-amber-900 border border-amber-300 rounded-lg p-2">
                      💡 {deal.couponText}
                    </div>
                  )}
                </div>

                {/* Mizoram Delivery Note */}
                <div className="mt-3 flex items-start gap-2 text-[11px] text-stone-600 bg-white p-2.5 rounded-xl border border-[#EAE6DF]">
                  <Truck className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Mizoram Delivery Tip:</strong> Eligible for fast delivery to Aizawl, Lunglei, Champhai & district pin codes via Amazon India.
                  </span>
                </div>
              </div>

              {/* Action CTAs */}
              <div className="mt-5 space-y-2">
                {isExpired ? (
                  <a
                    href={deal.affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-sm rounded-xl border border-stone-300 transition-all cursor-pointer"
                  >
                    <span>Check Current Price on Amazon</span>
                    <ExternalLink className="w-4 h-4 text-stone-600" />
                  </a>
                ) : (
                  <a
                    href={deal.affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm rounded-xl shadow-sm transition-all"
                  >
                    <span>Grab Deal on {storeBadge.name}</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => shareDealToWhatsApp(deal)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-semibold text-xs rounded-xl border border-[#25D366]/40 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5 text-[#25D366]" />
                    <span>Share WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAlert?.(deal);
                    }}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#FAF9F5] hover:bg-[#F2EFE9] text-stone-800 font-semibold text-xs rounded-xl border border-[#EAE6DF] transition-colors"
                  >
                    <BellRing className="w-3.5 h-3.5 text-orange-600" />
                    <span>Price Alert</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Price Drop Tracker Chart */}
          <PriceHistoryChart
            history={deal.priceHistory}
            originalPrice={deal.originalPrice}
            dealPrice={deal.dealPrice}
            lowestEverPrice={deal.lowestEverPrice}
          />

          {/* Highlights & Description */}
          {deal.description && (
            <div>
              <h4 className="text-sm font-bold text-stone-900 mb-1.5">Overview</h4>
              <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                {deal.description}
              </p>
            </div>
          )}

          {deal.highlights && deal.highlights.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-stone-900 mb-2">Key Highlights</h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-700">
                {deal.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-1.5 bg-[#FAF9F5] border border-[#EAE6DF] p-2 rounded-xl">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {deal.specs && Object.keys(deal.specs).length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-stone-900 mb-2">Technical Specifications</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(deal.specs).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center text-xs p-2 bg-[#FAF9F5] rounded-xl border border-[#EAE6DF]">
                    <span className="text-stone-500">{key}</span>
                    <span className="font-semibold text-stone-900">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Copy actions footer */}
          <div className="pt-3 border-t border-[#EAE6DF] flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
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
                <Copy className="w-3 h-3" /> Copy Affiliate Link
              </button>
              <span className="text-stone-300">|</span>
              <button
                type="button"
                onClick={handleCopyWhatsAppCopy}
                className="inline-flex items-center gap-1 text-xs font-semibold text-stone-700 hover:text-stone-900 underline underline-offset-2"
              >
                Copy WhatsApp Text
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

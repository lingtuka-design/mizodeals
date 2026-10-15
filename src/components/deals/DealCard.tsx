import React from 'react';
import { 
  ExternalLink, 
  Share2, 
  Heart, 
  Flame, 
  Star, 
  Clock, 
  CheckCircle2,
  Copy,
  Sparkles,
  AlertTriangle,
  TrendingDown
} from 'lucide-react';
import type { Deal } from '../../types';
import { STORE_BADGES } from '../../config/constants';
import { formatINR, getDealSavings, copyTextToClipboard } from '../../utils/formatters';
import { shareDealToWhatsApp, generateWhatsAppDealShareText } from '../../utils/affiliate';
import { isLootDeal, isNewDeal, isDealExpired, formatDealTime } from '../../utils/dealLogic';
import { useToast } from '../common/Toast';

interface DealCardProps {
  deal: Deal;
  isBookmarked?: boolean;
  onToggleBookmark?: (id: string) => void;
  onOpenDetails?: (deal: Deal) => void;
  onOpenAlert?: (deal: Deal) => void;
}

export const DealCard: React.FC<DealCardProps> = ({
  deal,
  isBookmarked = false,
  onToggleBookmark,
  onOpenDetails,
}) => {
  const { showToast } = useToast();
  const { savingsAmount } = getDealSavings(deal.originalPrice, deal.dealPrice);
  const storeBadge = STORE_BADGES[deal.store] || STORE_BADGES.amazon;

  const isLoot = isLootDeal(deal);
  const isNew = isNewDeal(deal);
  const isExpired = isDealExpired(deal);

  const handleWhatsAppShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    shareDealToWhatsApp(deal);
  };

  const handleCopyWhatsAppCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const text = generateWhatsAppDealShareText(deal);
    const success = await copyTextToClipboard(text);
    if (success) {
      showToast('WhatsApp deal message copied!', 'success');
    }
  };

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleBookmark?.(deal.id);
    showToast(isBookmarked ? 'Removed from saved deals' : 'Saved to your deals list', 'info');
  };

  const handleOpenDetails = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenDetails?.(deal);
  };

  return (
    <div 
      className={`group relative bg-white border rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between ${
        isExpired 
          ? 'border-stone-300/80 bg-stone-50/50 opacity-70 hover:opacity-100 grayscale-[25%]' 
          : 'border-[#EAE6DF] hover:border-orange-300'
      }`}
    >
      {/* Top badges bar */}
      <div>
        <div className="flex items-center justify-between gap-1.5 mb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Status 1: EXPIRED BADGE */}
            {isExpired ? (
              <span className="inline-flex items-center gap-1 bg-stone-700 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                DEAL EXPIRED
              </span>
            ) : (
              <>
                {/* Status 2: HOT LOOT DEAL BADGE */}
                {isLoot && (
                  <span className="inline-flex items-center gap-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs animate-pulse">
                    <Flame className="w-3 h-3 fill-current" />
                    LOOT DEAL
                  </span>
                )}

                {/* Status 3: NEW DEAL BADGE */}
                {isNew && (
                  <span className="inline-flex items-center gap-0.5 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                    <Sparkles className="w-2.5 h-2.5 text-emerald-200 fill-emerald-200" />
                    NEW
                  </span>
                )}
              </>
            )}

            <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${storeBadge.bg} ${storeBadge.text} ${storeBadge.border}`}>
              {storeBadge.name}
            </span>

            {/* Relative Timestamp */}
            <span className="inline-flex items-center text-[10px] text-stone-500 gap-1 bg-[#FAF9F5] px-2 py-0.5 rounded-full border border-[#EAE6DF]">
              <Clock className="w-3 h-3 text-stone-400" />
              {formatDealTime(deal.createdAt)}
            </span>
          </div>

          {/* Bookmark Button */}
          <button
            type="button"
            onClick={handleBookmarkClick}
            className={`p-1.5 rounded-full transition-colors z-10 ${
              isBookmarked 
                ? 'text-rose-500 bg-rose-50' 
                : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
            }`}
            title={isBookmarked ? 'Remove Bookmark' : 'Save Deal'}
            aria-label="Bookmark deal"
          >
            <Heart className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Product Image: DIRECT AMAZON LINK */}
        <a
          href={deal.affiliateUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#FAF9F5] border border-[#EAE6DF]/60 mb-3 group-hover:border-stone-300 block cursor-pointer"
          title={`Open ${deal.title} on ${storeBadge.name}`}
        >
          <img
            src={deal.imageUrl}
            alt={deal.title}
            loading="lazy"
            onError={(e) => {
              if (deal.asin && !e.currentTarget.src.includes('images-eu.ssl-images-amazon.com')) {
                e.currentTarget.src = `https://images-eu.ssl-images-amazon.com/images/P/${deal.asin}.01.MAIN._SCRMZZZZZZ_.jpg`;
              }
            }}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
          />

          {isExpired ? (
            <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-[1px] flex items-center justify-center p-2 text-center">
              <span className="bg-stone-900/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg border border-stone-700 shadow-md">
                Price Ended / Expired
              </span>
            </div>
          ) : (
            <div className="absolute bottom-2 left-2">
              <span className="bg-emerald-600 text-white text-xs font-black px-2 py-0.5 rounded-lg shadow-sm">
                {deal.discountPercent}% OFF
              </span>
            </div>
          )}

          {deal.couponText && !isExpired && (
            <div className="absolute top-2 left-2 max-w-[85%]">
              <span className="inline-flex items-center text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300/80 px-2 py-0.5 rounded-md truncate shadow-2xs">
                Coupon Available
              </span>
            </div>
          )}
        </a>

        {/* Product Title: DIRECT AMAZON LINK */}
        <a
          href={deal.affiliateUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={`block text-sm font-semibold line-clamp-2 leading-snug transition-colors cursor-pointer ${
            isExpired ? 'text-stone-500 hover:text-stone-800' : 'text-stone-900 hover:text-orange-600'
          }`}
          title={`Open ${deal.title} on ${storeBadge.name}`}
        >
          {deal.title}
        </a>

        {/* Rating and Reviews */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md text-[11px] font-bold text-amber-800">
            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
            <span>{deal.rating}</span>
          </div>
          <span className="text-xs text-stone-400">
            ({deal.ratingsCount.toLocaleString('en-IN')})
          </span>
          {!isExpired && (
            <>
              <span className="text-stone-300">•</span>
              <span className="text-[11px] font-medium text-emerald-700 flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Verified
              </span>
            </>
          )}
        </div>

        {/* Price & Savings Block */}
        <div className="mt-3 pt-2.5 border-t border-[#EAE6DF]/70">
          {isExpired ? (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-stone-500">
                  Was: {formatINR(deal.dealPrice)}
                </span>
                <span className="text-xs font-medium text-stone-400 line-through">
                  MRP {formatINR(deal.originalPrice)}
                </span>
              </div>
              <p className="text-[11px] font-medium text-amber-700 mt-0.5">
                Price may have changed on Amazon
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-stone-900 tracking-tight">
                  {formatINR(deal.dealPrice)}
                </span>
                <span className="text-xs font-medium text-stone-400 line-through">
                  {formatINR(deal.originalPrice)}
                </span>
              </div>
              {savingsAmount > 0 && (
                <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                  You save {formatINR(savingsAmount)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 pt-3 border-t border-[#EAE6DF] space-y-2">
        {/* Primary Buy CTA: DIRECT AMAZON LINK */}
        {isExpired ? (
          <a
            href={deal.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="w-full flex items-center justify-center gap-1.5 py-3 px-4 bg-stone-200 hover:bg-stone-300 active:bg-stone-400 text-stone-800 font-bold text-xs rounded-xl transition-all cursor-pointer border border-stone-300 shadow-2xs"
          >
            <span>Check Current Price on Amazon</span>
            <ExternalLink className="w-3.5 h-3.5 text-stone-600" />
          </a>
        ) : (
          <a
            href={deal.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="w-full flex items-center justify-center gap-1.5 py-3 px-4 bg-stone-900 hover:bg-stone-800 active:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-all duration-150 cursor-pointer"
          >
            <span>Buy on {storeBadge.name}</span>
            <ExternalLink className="w-3.5 h-3.5 text-stone-300" />
          </a>
        )}

        {/* WhatsApp Viral Share & Secondary Actions */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="flex items-center justify-center gap-1 py-1.5 px-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-semibold text-[11px] rounded-lg border border-[#25D366]/30 transition-colors cursor-pointer"
            title="Share Deal to WhatsApp"
          >
            <Share2 className="w-3 h-3 text-[#25D366]" />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handleCopyWhatsAppCopy}
            className="flex items-center justify-center gap-1 py-1.5 px-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-[11px] rounded-lg border border-[#EAE6DF] transition-colors cursor-pointer"
            title="Copy pre-formatted WhatsApp text"
          >
            <Copy className="w-3 h-3 text-stone-500" />
            <span>Copy</span>
          </button>

          <button
            type="button"
            onClick={handleOpenDetails}
            className="flex items-center justify-center gap-1 py-1.5 px-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-[11px] rounded-lg border border-[#EAE6DF] transition-colors cursor-pointer"
            title="View price history chart and full specs"
          >
            <TrendingDown className="w-3 h-3 text-orange-600" />
            <span>Details</span>
          </button>
        </div>
      </div>
    </div>
  );
};

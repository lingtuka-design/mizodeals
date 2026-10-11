import React from 'react';
import { 
  ExternalLink, 
  Share2, 
  Heart, 
  Flame, 
  Star, 
  Clock, 
  BellRing,
  CheckCircle2,
  Copy
} from 'lucide-react';
import type { Deal } from '../../types';
import { STORE_BADGES } from '../../config/constants';
import { formatINR, getDealSavings, copyTextToClipboard } from '../../utils/formatters';
import { shareDealToWhatsApp, generateWhatsAppDealShareText } from '../../utils/affiliate';
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
  onOpenAlert,
}) => {
  const { showToast } = useToast();
  const { savingsAmount } = getDealSavings(deal.originalPrice, deal.dealPrice);
  const storeBadge = STORE_BADGES[deal.store] || STORE_BADGES.amazon;

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyTextToClipboard(deal.affiliateUrl);
    if (success) {
      showToast('Deal link copied to clipboard!', 'success');
    }
  };

  const handleWhatsAppShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    shareDealToWhatsApp(deal);
  };

  const handleCopyWhatsAppCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = generateWhatsAppDealShareText(deal);
    const success = await copyTextToClipboard(text);
    if (success) {
      showToast('WhatsApp deal message copied!', 'success');
    }
  };

  const handleCardClick = () => {
    if (onOpenDetails) {
      onOpenDetails(deal);
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className="group relative bg-white border border-[#EAE6DF] hover:border-stone-300 rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer"
    >
      {/* Top badges bar */}
      <div>
        <div className="flex items-center justify-between gap-1.5 mb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {deal.isLootDeal && (
              <span className="inline-flex items-center gap-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                <Flame className="w-3 h-3 fill-current" />
                LOOT DEAL
              </span>
            )}
            <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${storeBadge.bg} ${storeBadge.text} ${storeBadge.border}`}>
              {storeBadge.name}
            </span>
            <span className="inline-flex items-center text-[10px] text-stone-500 gap-1 bg-[#FAF9F5] px-2 py-0.5 rounded-full border border-[#EAE6DF]">
              <Clock className="w-3 h-3 text-stone-400" />
              {deal.verifiedAt}
            </span>
          </div>

          {/* Bookmark Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark?.(deal.id);
              showToast(isBookmarked ? 'Removed from saved deals' : 'Saved to your deals list', 'info');
            }}
            className={`p-1.5 rounded-full transition-colors ${
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

        {/* Product Image */}
        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#FAF9F5] border border-[#EAE6DF]/60 mb-3 group-hover:border-stone-200">
          <img
            src={deal.imageUrl}
            alt={deal.title}
            loading="lazy"
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute bottom-2 left-2">
            <span className="bg-emerald-600 text-white text-xs font-black px-2 py-0.5 rounded-lg shadow-sm">
              {deal.discountPercent}% OFF
            </span>
          </div>
          {deal.couponText && (
            <div className="absolute top-2 left-2 max-w-[85%]">
              <span className="inline-flex items-center text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300/80 px-2 py-0.5 rounded-md truncate shadow-2xs">
                Coupon Available
              </span>
            </div>
          )}
        </div>

        {/* Product Title */}
        <h3 className="text-sm font-semibold text-stone-900 line-clamp-2 leading-snug group-hover:text-orange-600 transition-colors">
          {deal.title}
        </h3>

        {/* Rating and Reviews */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md text-[11px] font-bold text-amber-800">
            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
            <span>{deal.rating}</span>
          </div>
          <span className="text-xs text-stone-400">
            ({deal.ratingsCount.toLocaleString('en-IN')})
          </span>
          <span className="text-stone-300">•</span>
          <span className="text-[11px] font-medium text-emerald-700 flex items-center gap-0.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Verified
          </span>
        </div>

        {/* Price & Savings Block */}
        <div className="mt-3 pt-2.5 border-t border-[#EAE6DF]/70">
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
      </div>

      {/* Action Buttons */}
      <div className="mt-4 pt-3 border-t border-[#EAE6DF] space-y-2">
        {/* Primary Buy CTA */}
        <a
          href={deal.affiliateUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={(e) => e.stopPropagation()}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-stone-900 hover:bg-stone-800 active:bg-black text-white font-semibold text-xs rounded-xl shadow-xs transition-all duration-150 cursor-pointer"
        >
          <span>Buy on {storeBadge.name}</span>
          <ExternalLink className="w-3.5 h-3.5 text-stone-300" />
        </a>

        {/* WhatsApp Viral Share & Secondary Actions */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="flex items-center justify-center gap-1 py-1.5 px-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-semibold text-[11px] rounded-lg border border-[#25D366]/30 transition-colors"
            title="Share Deal to WhatsApp"
          >
            <Share2 className="w-3 h-3 text-[#25D366]" />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handleCopyWhatsAppCopy}
            className="flex items-center justify-center gap-1 py-1.5 px-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-[11px] rounded-lg border border-[#EAE6DF] transition-colors"
            title="Copy pre-formatted WhatsApp text"
          >
            <Copy className="w-3 h-3 text-stone-500" />
            <span>Copy Text</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenAlert?.(deal);
            }}
            className="flex items-center justify-center gap-1 py-1.5 px-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-[11px] rounded-lg border border-[#EAE6DF] transition-colors"
            title="Set Price Drop Alert"
          >
            <BellRing className="w-3 h-3 text-orange-600" />
            <span>Alert</span>
          </button>
        </div>
      </div>
    </div>
  );
};

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
import { StoreLogo } from '../common/StoreLogo';
import { formatINR, getDealSavings, copyTextToClipboard } from '../../utils/formatters';
import { shareDealToWhatsApp, generateWhatsAppDealShareText } from '../../utils/affiliate';
import { isLootDeal, isNewDeal, isDealExpired, formatDealTime, getHighResImageUrl } from '../../utils/dealLogic';
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

  const [imgSrc, setImgSrc] = React.useState(getHighResImageUrl(deal.imageUrl, deal.asin, deal.store));
  const [imageError, setImageError] = React.useState(!deal.imageUrl && !deal.asin);

  React.useEffect(() => {
    setImgSrc(getHighResImageUrl(deal.imageUrl, deal.asin, deal.store));
    setImageError(!deal.imageUrl && !deal.asin);
  }, [deal.imageUrl, deal.asin, deal.store]);

  return (
    <div 
      className={`group relative bg-white border rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between ${
        isExpired 
          ? 'border-stone-200 bg-stone-50/50 opacity-70 hover:opacity-100 grayscale-[25%]' 
          : 'border-stone-200 hover:border-[#C72026]/60'
      }`}
    >
      <div>
        {/* Product Image Container with IndiaDesire Discount Tag & Store Pill */}
        <div className="relative aspect-square w-full bg-white border-b border-stone-100 flex items-center justify-center overflow-hidden">
          {/* IndiaDesire Top-Left Discount Badge */}
          {!isExpired ? (
            <span className="absolute top-2 left-2 z-10 bg-gradient-to-r from-[#C72026] to-[#E65100] text-white text-[10.5px] sm:text-xs font-black px-2 py-0.5 rounded-md shadow-xs tracking-tight">
              {deal.discountPercent}% OFF
            </span>
          ) : (
            <span className="absolute top-2 left-2 z-10 bg-stone-800 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xs">
              EXPIRED
            </span>
          )}

          {/* Top-Right Bookmark Heart */}
          <button
            type="button"
            onClick={handleBookmarkClick}
            className={`absolute top-2 right-2 z-10 p-1.5 rounded-full backdrop-blur-xs transition-colors ${
              isBookmarked 
                ? 'text-rose-500 bg-rose-50/90' 
                : 'text-stone-400 hover:text-stone-700 bg-white/80 hover:bg-white shadow-2xs'
            }`}
            title={isBookmarked ? 'Remove Bookmark' : 'Save Deal'}
            aria-label="Bookmark deal"
          >
            <Heart className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>

          {/* Direct Store Affiliate Image Link */}
          <a
            href={deal.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="w-full h-full p-3 sm:p-4 flex items-center justify-center block cursor-pointer"
            title={`Open ${deal.title} on ${storeBadge.name}`}
          >
            {!imageError ? (
              <img
                src={imgSrc}
                alt={deal.title}
                loading="lazy"
                onLoad={(e) => {
                  if (e.currentTarget.naturalWidth <= 2 || e.currentTarget.naturalHeight <= 2) {
                    if (deal.imageUrl && imgSrc !== deal.imageUrl) {
                      setImgSrc(deal.imageUrl);
                    } else {
                      setImageError(true);
                    }
                  }
                }}
                onError={() => {
                  if (deal.imageUrl && imgSrc !== deal.imageUrl) {
                    setImgSrc(deal.imageUrl);
                  } else {
                    setImageError(true);
                  }
                }}
                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-stone-50 p-2 text-center">
                <span className="p-2 rounded-full bg-red-100 text-[#C72026] mb-1">
                  <Flame className="w-4 h-4 fill-current" />
                </span>
                <span className="text-[11px] font-bold text-stone-700">{storeBadge.name} Deal</span>
                <span className="text-[9px] text-stone-400">Tap to shop</span>
              </div>
            )}
          </a>

          {/* Coupon pill if present */}
          {deal.couponText && !isExpired && (
            <div className="absolute bottom-2 left-2 max-w-[85%] z-10">
              <span className="inline-flex items-center text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded shadow-xs">
                Coupon Applied
              </span>
            </div>
          )}
        </div>

        {/* Card Body (Title, Price, Meta) */}
        <div className="p-2.5 sm:p-3 space-y-2">
          {/* Product Title */}
          <a
            href={deal.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={`block text-xs sm:text-[13.5px] font-semibold line-clamp-2 leading-snug transition-colors cursor-pointer min-h-[2rem] sm:min-h-[2.4rem] ${
              isExpired ? 'text-stone-500 hover:text-stone-800' : 'text-stone-900 hover:text-[#C72026]'
            }`}
            title={`Open ${deal.title} on ${storeBadge.name}`}
          >
            {deal.title}
          </a>

          {/* Price Block: Big Bold Now Price + Strikethrough Was Price */}
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base sm:text-xl font-black text-stone-900 tracking-tight">
                {formatINR(deal.dealPrice)}
              </span>
              <span className="text-xs sm:text-sm text-stone-400 line-through font-normal">
                {formatINR(deal.originalPrice)}
              </span>
            </div>
            {savingsAmount > 0 && !isExpired && (
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.2 rounded shrink-0">
                Save {formatINR(savingsAmount)}
              </span>
            )}
          </div>

          {/* Meta Info: Store Badge & Time Posted */}
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-stone-500 pt-1 border-t border-stone-100">
            <div className="flex items-center gap-1 font-medium truncate">
              <Clock className="w-3 h-3 text-stone-400 shrink-0" />
              <span className="truncate">{formatDealTime(deal.createdAt)}</span>
            </div>
            <span className={`inline-flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${storeBadge.bg} ${storeBadge.text} ${storeBadge.border}`}>
              <StoreLogo store={deal.store} className="w-2.5 h-2.5 rounded-[2px] shrink-0" />
              <span>{storeBadge.name}</span>
            </span>
          </div>
        </div>
      </div>

      {/* IndiaDesire Signature Action Button: Shop Now + Share Row */}
      <div className="p-2.5 sm:p-3 pt-0 space-y-1.5">
        {/* Primary Shop Now Button */}
        <a
          href={deal.affiliateUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={`w-full flex items-center justify-center gap-1.5 py-2 sm:py-2.5 px-3 font-bold text-xs sm:text-sm rounded-lg shadow-xs transition-colors cursor-pointer ${
            isExpired
              ? 'bg-stone-200 hover:bg-stone-300 text-stone-700'
              : 'bg-[#C72026] hover:bg-[#B01A20] active:bg-[#96141A] text-white'
          }`}
          title={`Shop ${deal.title} on ${storeBadge.name}`}
        >
          <StoreLogo store={deal.store} className="w-3.5 h-3.5 rounded-[2px] shrink-0" />
          <span>{isExpired ? 'Check Price' : 'Shop Now'}</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
        </a>

        {/* 3-Button Viral Row: WhatsApp + Copy + Details */}
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="flex items-center justify-center gap-1 py-1 px-1 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-bold text-[10px] sm:text-[11px] rounded border border-[#25D366]/30 transition-colors cursor-pointer"
            title="Share to WhatsApp"
          >
            <Share2 className="w-2.5 h-2.5 text-[#25D366] shrink-0" />
            <span className="truncate">Share</span>
          </button>

          <button
            type="button"
            onClick={handleCopyWhatsAppCopy}
            className="flex items-center justify-center gap-1 py-1 px-1 bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold text-[10px] sm:text-[11px] rounded border border-stone-200 transition-colors cursor-pointer"
            title="Copy WhatsApp text"
          >
            <Copy className="w-2.5 h-2.5 text-stone-500 shrink-0" />
            <span className="truncate">Copy</span>
          </button>

          <button
            type="button"
            onClick={handleOpenDetails}
            className="flex items-center justify-center gap-1 py-1 px-1 bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold text-[10px] sm:text-[11px] rounded border border-stone-200 transition-colors cursor-pointer"
            title="View Price History & Specs"
          >
            <TrendingDown className="w-2.5 h-2.5 text-[#C72026] shrink-0" />
            <span className="truncate">Details</span>
          </button>
        </div>
      </div>
    </div>
  );
};

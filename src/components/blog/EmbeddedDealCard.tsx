import React from 'react';
import { ExternalLink, Share2, Star, CheckCircle2 } from 'lucide-react';
import type { Deal } from '../../types';
import { formatINR, getDealSavings } from '../../utils/formatters';
import { shareDealToWhatsApp } from '../../utils/affiliate';
import { STORE_BADGES } from '../../config/constants';

interface EmbeddedDealCardProps {
  deal: Deal;
}

export const EmbeddedDealCard: React.FC<EmbeddedDealCardProps> = ({ deal }) => {
  const { savingsAmount } = getDealSavings(deal.originalPrice, deal.dealPrice);
  const storeBadge = STORE_BADGES[deal.store] || STORE_BADGES.amazon;

  return (
    <div className="my-6 p-4 sm:p-5 bg-white border-2 border-[#EAE6DF] hover:border-orange-300 rounded-2xl shadow-xs transition-all">
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        {/* Thumbnail */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-[#FAF9F5] border border-[#EAE6DF] shrink-0">
          <img
            src={deal.imageUrl}
            alt={deal.title}
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute top-1.5 left-1.5">
            <span className="bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md">
              {deal.discountPercent}% OFF
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start mb-1 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${storeBadge.bg} ${storeBadge.text} ${storeBadge.border}`}>
              {storeBadge.name}
            </span>
            <span className="text-[10px] font-medium text-emerald-700 flex items-center gap-0.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified Deal
            </span>
          </div>

          <h4 className="text-sm sm:text-base font-bold text-stone-900 line-clamp-2 leading-snug">
            {deal.title}
          </h4>

          <div className="flex items-center gap-2 justify-center sm:justify-start my-2">
            <span className="text-xl font-black text-stone-900">{formatINR(deal.dealPrice)}</span>
            <span className="text-xs text-stone-400 line-through">{formatINR(deal.originalPrice)}</span>
            {savingsAmount > 0 && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                Save {formatINR(savingsAmount)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 justify-center sm:justify-start text-xs text-stone-500">
            <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded text-[11px] font-bold text-amber-800">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              <span>{deal.rating}</span>
            </div>
            <span>({deal.ratingsCount.toLocaleString('en-IN')} reviews)</span>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="w-full sm:w-auto shrink-0 flex flex-col gap-2">
          <a
            href={deal.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            <span>Buy on {storeBadge.name}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={() => shareDealToWhatsApp(deal)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-4 py-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-semibold text-xs rounded-xl border border-[#25D366]/30 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 text-[#25D366]" />
            <span>Share WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import type { Deal } from '../../types';
import { DealCard } from './DealCard';
import { PackageSearch, Sparkles } from 'lucide-react';

interface DealGridProps {
  deals: Deal[];
  isBookmarked: (id: string) => boolean;
  onToggleBookmark: (id: string) => void;
  onOpenDetails: (deal: Deal) => void;
  onOpenAlert: (deal: Deal) => void;
  onResetFilters?: () => void;
}

export const DealGrid: React.FC<DealGridProps> = ({
  deals,
  isBookmarked,
  onToggleBookmark,
  onOpenDetails,
  onOpenAlert,
  onResetFilters,
}) => {
  if (deals.length === 0) {
    return (
      <div className="bg-white border border-[#EAE6DF] rounded-2xl p-8 sm:p-12 text-center my-6 shadow-2xs">
        <div className="w-12 h-12 rounded-2xl bg-[#FAF9F5] border border-[#EAE6DF] flex items-center justify-center mx-auto mb-3 text-stone-400">
          <PackageSearch className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-stone-900 mb-1">No deals found matching your criteria</h3>
        <p className="text-xs sm:text-sm text-stone-500 max-w-md mx-auto mb-4">
          Try loosening your search keywords or switching to "All Deals" to see active price drops.
        </p>
        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Show All Deals</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {deals.map((deal) => (
        <DealCard
          key={deal.id}
          deal={deal}
          isBookmarked={isBookmarked(deal.id)}
          onToggleBookmark={onToggleBookmark}
          onOpenDetails={onOpenDetails}
          onOpenAlert={onOpenAlert}
        />
      ))}
    </div>
  );
};

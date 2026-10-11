import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { INITIAL_DEALS } from '../data/deals';
import { DealCard } from '../components/deals/DealCard';
import { DealDetailModal } from '../components/deals/DealDetailModal';
import { PriceAlertModal } from '../components/common/PriceAlertModal';
import { useBookmarks } from '../hooks/useBookmarks';
import { Heart, Sparkles, ArrowLeft } from 'lucide-react';
import type { Deal } from '../types';

export const SavedDealsView: React.FC = () => {
  const { savedIds, isBookmarked, toggleBookmark } = useBookmarks();
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [alertDeal, setAlertDeal] = useState<Deal | null>(null);

  const bookmarkedDeals = INITIAL_DEALS.filter((d) => savedIds.includes(d.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#EAE6DF] rounded-3xl p-6 sm:p-8 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold mb-3">
            <Heart className="w-3.5 h-3.5 fill-current" />
            <span>Personal Wishlist</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            Your Bookmarked Deals ({bookmarkedDeals.length})
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Deals saved on this device. Prices are continuously monitored for drops.
          </p>
        </div>

        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#FAF9F5] hover:bg-[#F2EFE9] border border-[#EAE6DF] rounded-xl text-xs font-semibold text-stone-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Discover More Deals</span>
          </Link>
        </div>
      </div>

      {bookmarkedDeals.length === 0 ? (
        <div className="bg-white border border-[#EAE6DF] rounded-3xl p-10 sm:p-16 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-100">
            <Heart className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-stone-900 mb-2">No Saved Deals Yet</h3>
          <p className="text-xs sm:text-sm text-stone-500 max-w-sm mx-auto mb-6">
            Click the heart icon on any deal card to save it here for quick access later before the discount ends.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>Browse Active Loot Deals</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {bookmarkedDeals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              isBookmarked={isBookmarked(deal.id)}
              onToggleBookmark={toggleBookmark}
              onOpenDetails={(d) => setSelectedDeal(d)}
              onOpenAlert={(d) => setAlertDeal(d)}
            />
          ))}
        </div>
      )}

      {/* Deal Detail Modal */}
      <DealDetailModal
        deal={selectedDeal}
        isOpen={Boolean(selectedDeal)}
        onClose={() => setSelectedDeal(null)}
        isBookmarked={selectedDeal ? isBookmarked(selectedDeal.id) : false}
        onToggleBookmark={toggleBookmark}
        onOpenAlert={(deal) => setAlertDeal(deal)}
      />

      {/* Price Alert Modal */}
      <PriceAlertModal
        deal={alertDeal}
        isOpen={Boolean(alertDeal)}
        onClose={() => setAlertDeal(null)}
      />
    </div>
  );
};

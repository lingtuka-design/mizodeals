import React, { useState, useMemo } from 'react';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { useData } from '../context/DataContext';
import type { Deal, DealCategory, DealsFilterParams } from '../types';
import { DealFilters } from '../components/deals/DealFilters';
import { DealGrid } from '../components/deals/DealGrid';
import { DealDetailModal } from '../components/deals/DealDetailModal';
import { PriceAlertModal } from '../components/common/PriceAlertModal';
import { useBookmarks } from '../hooks/useBookmarks';
import { Flame, Sparkles, Zap, ShieldCheck, ArrowRight, MessageCircle } from 'lucide-react';
import { WHATSAPP_CHANNEL_URL, WHATSAPP_COMMUNITY_MEMBERS } from '../config/constants';

export const HomeView: React.FC = () => {
  const { deals } = useData();
  const searchParams = useSearch({ strict: false }) as DealsFilterParams;
  const navigate = useNavigate();

  const { isBookmarked, toggleBookmark } = useBookmarks();

  // Active modal state
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [alertDeal, setAlertDeal] = useState<Deal | null>(null);

  // Filter params with defaults
  const activeFilters: DealsFilterParams = useMemo(() => ({
    category: searchParams.category || 'all',
    search: searchParams.search || '',
    sort: searchParams.sort || 'discount_desc',
    lootOnly: Boolean(searchParams.lootOnly),
    priceRange: searchParams.priceRange || 'all',
  }), [searchParams]);

  const handleFilterChange = (newFilters: Partial<DealsFilterParams>) => {
    navigate({
      to: '/',
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        ...newFilters,
      }),
    });
  };

  // Category counts calculation
  const categoryCounts = useMemo(() => {
    const counts: Record<DealCategory, number> = {
      all: deals.length,
      shoes_fashion: 0,
      electronics: 0,
      sports: 0,
      home_kitchen: 0,
      gadgets: 0,
    };

    deals.forEach((deal) => {
      if (counts[deal.category] !== undefined) {
        counts[deal.category]++;
      }
    });

    return counts;
  }, [deals]);

  // Filtered and sorted deals
  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      // Category filter
      if (activeFilters.category && activeFilters.category !== 'all' && deal.category !== activeFilters.category) {
        return false;
      }

      // Loot deal toggle
      if (activeFilters.lootOnly && !deal.isLootDeal) {
        return false;
      }

      // Price range
      if (activeFilters.priceRange && activeFilters.priceRange !== 'all') {
        if (activeFilters.priceRange === 'under_500' && deal.dealPrice >= 500) return false;
        if (activeFilters.priceRange === 'under_1500' && (deal.dealPrice < 500 || deal.dealPrice > 1500)) return false;
        if (activeFilters.priceRange === 'under_5000' && (deal.dealPrice < 1500 || deal.dealPrice > 5000)) return false;
        if (activeFilters.priceRange === 'above_5000' && deal.dealPrice <= 5000) return false;
      }

      // Keyword search
      if (activeFilters.search && activeFilters.search.trim()) {
        const query = activeFilters.search.toLowerCase().trim();
        const inTitle = deal.title.toLowerCase().includes(query);
        const inDesc = deal.description?.toLowerCase().includes(query) ?? false;
        const inCat = deal.category.toLowerCase().includes(query);
        if (!inTitle && !inDesc && !inCat) return false;
      }

      return true;
    }).sort((a, b) => {
      switch (activeFilters.sort) {
        case 'discount_desc':
          return b.discountPercent - a.discountPercent;
        case 'price_asc':
          return a.dealPrice - b.dealPrice;
        case 'price_desc':
          return b.dealPrice - a.dealPrice;
        case 'rating_desc':
          return b.rating - a.rating;
        case 'newest':
        default:
          return 0; // maintain curated order
      }
    });
  }, [activeFilters]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white border border-[#EAE6DF] rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-900 text-xs font-bold mb-3">
            <Flame className="w-3.5 h-3.5 text-orange-600 fill-orange-500" />
            <span>Mizoram's Live Affiliate Deal Hub</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight leading-tight">
            Curated Amazon Deals & Price Drops for Shoppers in Mizoram.
          </h1>

          <p className="text-xs sm:text-base text-stone-600 mt-2 sm:mt-3 leading-relaxed">
            We track Amazon price cuts on genuine trail shoes, smartphones, gadgets, and home appliances with direct Northeast delivery eligibility. Share deals instantly to WhatsApp.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-4 text-xs font-medium text-stone-600">
            <span className="flex items-center gap-1.5 bg-[#FAF9F5] px-3 py-1.5 rounded-xl border border-[#EAE6DF]">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <strong>{deals.length}</strong> Live Deals Today
            </span>
            <span className="flex items-center gap-1.5 bg-[#FAF9F5] px-3 py-1.5 rounded-xl border border-[#EAE6DF]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              100% Verified Amazon Pricing
            </span>
            <span className="flex items-center gap-1.5 bg-[#FAF9F5] px-3 py-1.5 rounded-xl border border-[#EAE6DF]">
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              Up to 68% Off Loot Deals
            </span>
          </div>
        </div>

        {/* Floating WhatsApp Card in Hero */}
        <div className="mt-6 sm:mt-0 sm:absolute sm:right-8 sm:top-1/2 sm:-translate-y-1/2 bg-[#FAF9F5] border border-[#EAE6DF] rounded-2xl p-4 sm:max-w-xs shadow-2xs">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-[#25D366] text-white flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4 fill-white" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-stone-900">VIP Loot WhatsApp</h3>
              <p className="text-[10px] text-stone-500">{WHATSAPP_COMMUNITY_MEMBERS} local subscribers</p>
            </div>
          </div>
          <p className="text-[11px] text-stone-600 mb-3 leading-tight">
            Never miss an Amazon price error or limited-hour flash deal.
          </p>
          <a
            href={WHATSAPP_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-[#25D366] hover:bg-[#20bd5a] text-stone-950 font-bold text-xs rounded-xl transition-colors shadow-2xs"
          >
            <span>Join Alerts Channel</span>
            <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="bg-[#FAF9F5] rounded-2xl">
        <DealFilters
          filters={activeFilters}
          onFilterChange={handleFilterChange}
          categoryCounts={categoryCounts}
          totalDealsCount={deals.length}
        />
      </section>

      {/* Deals Grid Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-bold text-stone-900">
            {!activeFilters.category || activeFilters.category === 'all'
              ? 'All Available Deals' 
              : `${activeFilters.category.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Deals`}
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-200 text-stone-700">
            {filteredDeals.length} deals
          </span>
        </div>

        {activeFilters.lootOnly && (
          <span className="text-xs font-bold text-orange-600 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 fill-current" /> Showing Only Loot Deals (&gt;50% Off)
          </span>
        )}
      </div>

      {/* Deals Grid */}
      <DealGrid
        deals={filteredDeals}
        isBookmarked={isBookmarked}
        onToggleBookmark={toggleBookmark}
        onOpenDetails={(deal) => setSelectedDeal(deal)}
        onOpenAlert={(deal) => setAlertDeal(deal)}
        onResetFilters={() => handleFilterChange({ category: 'all', search: '', lootOnly: false, priceRange: 'all' })}
      />

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

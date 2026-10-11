import React, { useState, useMemo } from 'react';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { useData } from '../context/DataContext';
import type { Deal, DealCategory, DealsFilterParams, DealsTabMode } from '../types';
import { DealFilters } from '../components/deals/DealFilters';
import { DealGrid } from '../components/deals/DealGrid';
import { DealDetailModal } from '../components/deals/DealDetailModal';
import { PriceAlertModal } from '../components/common/PriceAlertModal';
import { useBookmarks } from '../hooks/useBookmarks';
import { isLootDeal, isNewDeal, isDealExpired } from '../utils/dealLogic';
import { formatINR } from '../utils/formatters';
import { shareDealToWhatsApp } from '../utils/affiliate';
import { 
  Flame, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  ArrowRight, 
  MessageCircle, 
  Share2, 
  ExternalLink,
  Tag
} from 'lucide-react';
import { WHATSAPP_CHANNEL_URL, WHATSAPP_COMMUNITY_MEMBERS, STORE_BADGES } from '../config/constants';

export const HomeView: React.FC = () => {
  const { deals } = useData();
  const searchParams = useSearch({ strict: false }) as DealsFilterParams;
  const navigate = useNavigate();

  const { isBookmarked, toggleBookmark } = useBookmarks();

  // Active modal state
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [alertDeal, setAlertDeal] = useState<Deal | null>(null);

  // Active Feed Tab: 'all' | 'loot' | 'new'
  const activeTab: DealsTabMode = (searchParams.tab as DealsTabMode) || 'all';

  // Filter params with defaults
  const activeFilters: DealsFilterParams = useMemo(() => ({
    category: searchParams.category || 'all',
    search: searchParams.search || '',
    sort: searchParams.sort || (activeTab === 'new' ? 'newest' : 'discount_desc'),
    lootOnly: activeTab === 'loot' || Boolean(searchParams.lootOnly),
    tab: activeTab,
    priceRange: searchParams.priceRange || 'all',
  }), [searchParams, activeTab]);

  const handleFilterChange = (newFilters: Partial<DealsFilterParams>) => {
    navigate({
      to: '/',
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        ...newFilters,
      }),
    });
  };

  // Only active deals on the homepage (Expired deals are hidden from public feed per specification)
  const activeDeals = useMemo(() => {
    return deals.filter((deal) => !isDealExpired(deal));
  }, [deals]);

  // Featured Hot Loot Deals (Top 3 for Hero Spotlight)
  const topLootDeals = useMemo(() => {
    return activeDeals.filter(isLootDeal).slice(0, 3);
  }, [activeDeals]);

  // Category counts calculation based on active deals
  const categoryCounts = useMemo(() => {
    const counts: Record<DealCategory, number> = {
      all: activeDeals.length,
      shoes_fashion: 0,
      electronics: 0,
      sports: 0,
      home_kitchen: 0,
      gadgets: 0,
    };

    activeDeals.forEach((deal) => {
      if (counts[deal.category] !== undefined) {
        counts[deal.category]++;
      }
    });

    return counts;
  }, [activeDeals]);

  // Filtered and sorted deals
  const filteredDeals = useMemo(() => {
    return activeDeals.filter((deal) => {
      // Tab filter
      if (activeTab === 'loot' && !isLootDeal(deal)) {
        return false;
      }
      if (activeTab === 'new' && !isNewDeal(deal, 6)) {
        return false;
      }

      // Category filter
      if (activeFilters.category && activeFilters.category !== 'all' && deal.category !== activeFilters.category) {
        return false;
      }

      // Loot deal toggle
      if (activeFilters.lootOnly && !isLootDeal(deal)) {
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
      if (activeTab === 'new') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
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
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return b.discountPercent - a.discountPercent;
      }
    });
  }, [activeDeals, activeFilters, activeTab]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
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
            Automated price drop monitoring on genuine trail shoes, smartphones, gadgets, and home appliances. Verified delivery eligibility to Aizawl, Lunglei, Champhai & across the state.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-4 text-xs font-medium text-stone-600">
            <span className="flex items-center gap-1.5 bg-[#FAF9F5] px-3 py-1.5 rounded-xl border border-[#EAE6DF]">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <strong>{activeDeals.length}</strong> Active Deals Live
            </span>
            <span className="flex items-center gap-1.5 bg-[#FAF9F5] px-3 py-1.5 rounded-xl border border-[#EAE6DF]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              100% Verified Amazon Pricing
            </span>
            <span className="flex items-center gap-1.5 bg-[#FAF9F5] px-3 py-1.5 rounded-xl border border-[#EAE6DF]">
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              Loot Discounts &gt;= 50%
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
            Instant flash notifications before stock runs out in Northeast delivery hub.
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

      {/* 1. HOT LOOT DEALS SPOTLIGHT (Feature 1: Top of Homepage) */}
      {topLootDeals.length > 0 && (
        <section className="bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border border-orange-200/80 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-orange-600 text-white rounded-xl shadow-xs">
                <Flame className="w-4 h-4 fill-current" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-black text-stone-900">
                  Top Loot Deals (Mipui Hip Ber &amp; 50%+ Off)
                </h2>
                <p className="text-xs text-stone-600">
                  High ratings (4.0+) paired with steep promotional discounts.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleFilterChange({ tab: 'loot', lootOnly: true })}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 shrink-0"
            >
              <span>View All Loots</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topLootDeals.map((deal) => {
              const storeBadge = STORE_BADGES[deal.store] || STORE_BADGES.amazon;
              return (
                <div
                  key={deal.id}
                  onClick={() => setSelectedDeal(deal)}
                  className="bg-white border border-[#EAE6DF] hover:border-orange-300 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-2xs">
                        <Flame className="w-2.5 h-2.5 fill-current" />
                        {deal.discountPercent}% OFF LOOT
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${storeBadge.bg} ${storeBadge.text} ${storeBadge.border}`}>
                        {storeBadge.name}
                      </span>
                    </div>

                    <div className="aspect-16/10 rounded-xl overflow-hidden bg-[#FAF9F5] mb-3">
                      <img
                        src={deal.imageUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    <h3 className="text-xs sm:text-sm font-bold text-stone-900 line-clamp-2 leading-snug group-hover:text-orange-600 transition-colors">
                      {deal.title}
                    </h3>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#EAE6DF] flex items-center justify-between">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-extrabold text-stone-900">{formatINR(deal.dealPrice)}</span>
                        <span className="text-xs text-stone-400 line-through">{formatINR(deal.originalPrice)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          shareDealToWhatsApp(deal);
                        }}
                        className="p-1.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] rounded-lg transition-colors"
                        title="Broadcast on WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5 text-[#25D366]" />
                      </button>
                      <a
                        href={deal.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg shadow-2xs"
                        title="Buy on Amazon"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 2. FEED TABS (Hot Loot, New Deals, All Active) */}
      <div className="flex items-center gap-2 border-b border-[#EAE6DF] pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => handleFilterChange({ tab: 'all', lootOnly: false })}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'all'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-white text-stone-700 border border-[#EAE6DF] hover:bg-stone-50'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>All Active Deals ({activeDeals.length})</span>
        </button>

        <button
          type="button"
          onClick={() => handleFilterChange({ tab: 'loot', lootOnly: true })}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'loot'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs'
              : 'bg-white text-stone-700 border border-[#EAE6DF] hover:border-orange-300'
          }`}
        >
          <Flame className={`w-4 h-4 ${activeTab === 'loot' ? 'fill-current' : 'text-orange-500'}`} />
          <span>Hot Loot Deals (&gt;=50% Off)</span>
        </button>

        <button
          type="button"
          onClick={() => handleFilterChange({ tab: 'new', lootOnly: false, sort: 'newest' })}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'new'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-stone-700 border border-[#EAE6DF] hover:border-emerald-300'
          }`}
        >
          <Sparkles className={`w-4 h-4 ${activeTab === 'new' ? 'fill-current' : 'text-emerald-600'}`} />
          <span>✨ New Deals (Thar Berte)</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <section className="bg-[#FAF9F5] rounded-2xl">
        <DealFilters
          filters={activeFilters}
          onFilterChange={handleFilterChange}
          categoryCounts={categoryCounts}
          totalDealsCount={activeDeals.length}
        />
      </section>

      {/* Deals Grid Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-bold text-stone-900">
            {activeTab === 'loot' 
              ? '🔥 Hot Loot Deals Catalog' 
              : activeTab === 'new'
              ? '✨ New Deals (Darkar Tlemte Chhunga Lo Lut)'
              : !activeFilters.category || activeFilters.category === 'all'
              ? 'Live Deals Feed' 
              : `${activeFilters.category.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Deals`}
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-200 text-stone-700">
            {filteredDeals.length} results
          </span>
        </div>

        {activeTab === 'new' && (
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            Darkar 6 chhunga lo lut thar chauh
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
        onResetFilters={() => handleFilterChange({ category: 'all', search: '', lootOnly: false, priceRange: 'all', tab: 'all' })}
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

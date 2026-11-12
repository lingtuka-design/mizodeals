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
import { 
  Flame, 
  Zap, 
  ShieldCheck, 
  ArrowRight, 
  MessageCircle
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

  // Filter params with defaults (Default sort is newest so live scraped deals appear on top)
  const activeFilters: DealsFilterParams = useMemo(() => ({
    category: searchParams.category || 'all',
    search: searchParams.search || '',
    sort: searchParams.sort || 'newest',
    lootOnly: activeTab === 'loot' || Boolean(searchParams.lootOnly),
    tab: activeTab,
    priceRange: searchParams.priceRange || 'all',
    store: searchParams.store || 'all',
  }), [searchParams, activeTab]);

  const handleFilterChange = (newFilters: Partial<DealsFilterParams>) => {
    navigate({
      to: '/',
      search: (prev: Record<string, unknown>) => {
        const next: Record<string, unknown> = {
          ...prev,
          ...newFilters,
        };
        // Clean out default / empty values so URL stays completely clean (e.g. https://mizodeals.com/)
        if (!next.category || next.category === 'all') delete next.category;
        if (!next.search) delete next.search;
        if (!next.sort || next.sort === 'newest') delete next.sort;
        if (!next.lootOnly || next.lootOnly === 'false' || next.lootOnly === false) delete next.lootOnly;
        if (!next.tab || next.tab === 'all') delete next.tab;
        if (!next.priceRange || next.priceRange === 'all') delete next.priceRange;
        if (!next.store || next.store === 'all') delete next.store;
        return next;
      },
      resetScroll: false,
      replace: true,
    });
  };

  // Only active deals on the homepage (Expired deals are hidden from public feed per specification)
  const activeDeals = useMemo(() => {
    return deals.filter((deal) => !isDealExpired(deal));
  }, [deals]);

  // Featured Hot Loot Deals (Top Loot Spotlight - swipeable carousel on mobile, responsive grid on desktop)
  const topLootDeals = useMemo(() => {
    return [...activeDeals]
      .filter(isLootDeal)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [activeDeals]);

  // Whether the Top Loot Deals spotlight section is currently visible on the page
  const isTopLootVisible = useMemo(() => {
    return (!activeFilters.store || activeFilters.store === 'all') && topLootDeals.length > 0;
  }, [activeFilters.store, topLootDeals.length]);

  const topLootDealIds = useMemo(() => {
    return new Set(topLootDeals.map((d) => d.id));
  }, [topLootDeals]);

  const isWinterwear = (deal: Deal) => {
    const t = deal.title.toLowerCase();
    const d = (deal.description || '').toLowerCase();
    const c = deal.category as string;
    if (c === 'winterwear') return true;
    return /hoodie|jacket|sweater|sweatshirt|fleece|winter|thermal|cardigan|coat|muffler|beanie|lukhum|gloves|scarf|woolen/i.test(t) ||
      /hoodie|jacket|sweater|sweatshirt|fleece|winter|thermal|muffler|beanie|gloves/i.test(d);
  };

  // Category counts calculation based on active deals
  const categoryCounts = useMemo(() => {
    const counts: Record<DealCategory, number> = {
      all: activeDeals.length,
      winterwear: 0,
      shoes_fashion: 0,
      electronics: 0,
      sports: 0,
      home_kitchen: 0,
      gadgets: 0,
      beauty: 0,
    };

    activeDeals.forEach((deal) => {
      if (counts[deal.category] !== undefined) {
        counts[deal.category]++;
      }
      if (isWinterwear(deal)) {
        counts.winterwear++;
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

      // Store filter
      if (activeFilters.store && activeFilters.store !== 'all') {
        const store = deal.store || 'amazon';
        if (store !== activeFilters.store) return false;
      }

      // Category filter
      if (activeFilters.category && activeFilters.category !== 'all') {
        if (activeFilters.category === 'winterwear') {
          if (!isWinterwear(deal)) return false;
        } else if (deal.category !== activeFilters.category) {
          return false;
        }
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
          return b.discountPercent - a.discountPercent || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'price_asc':
          return a.dealPrice - b.dealPrice;
        case 'price_desc':
          return b.dealPrice - a.dealPrice;
        case 'rating_desc':
          return b.rating - a.rating;
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [activeDeals, activeFilters, activeTab]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* 1. IndiaDesire Top Announcement Bar */}
      <div className="bg-red-50 border border-red-200/80 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="bg-[#C72026] text-white font-extrabold text-[10px] px-2 py-0.5 rounded shrink-0 uppercase tracking-wider">
            Live
          </span>
          <p className="text-stone-800 font-medium truncate">
            <strong>Mizoram's #1 Loot Deals Hub</strong> — Amazon, Meesho, Flipkart, Nykaa &amp; Myntra price drops verified 24x7!
          </p>
        </div>
        <a
          href={WHATSAPP_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1 text-[#C72026] hover:text-[#96141A] font-bold shrink-0"
        >
          <span>Get WhatsApp Alerts &rarr;</span>
        </a>
      </div>

      {/* 2. IndiaDesire Hero Section */}
      <section className="relative overflow-hidden bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="max-w-3xl space-y-2 sm:space-y-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-red-100 text-[#C72026] text-[11px] font-extrabold tracking-wide">
              <Flame className="w-3.5 h-3.5 fill-[#C72026]" />
              FESTIVE &amp; WINTER SALE SEASON IS LIVE
            </span>

            <h1 className="text-xl sm:text-3xl font-black text-stone-900 tracking-tight leading-snug">
              Mizoram's smartest way to <span className="text-[#C72026]">shop for less</span>
            </h1>

            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-2xl">
              Hand-picked loot deals, coupons, and verified price drops from Amazon, Meesho, Flipkart, Nykaa &amp; Myntra — checked and updated every few minutes.
            </p>

            {/* IndiaDesire Hero CTA Actions */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleFilterChange({ tab: 'loot', lootOnly: true })}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C72026] hover:bg-[#B01A20] active:bg-[#96141A] text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Flame className="w-4 h-4 fill-white" />
                <span>Browse Loot Deals</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </button>

              <a
                href={WHATSAPP_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-stone-950 text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-colors"
              >
                <MessageCircle className="w-4 h-4 fill-stone-950" />
                <span>Get WhatsApp Alerts</span>
              </a>
            </div>

            {/* Stats Band */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 pt-2 text-[11px] sm:text-xs text-stone-600 border-t border-stone-100">
              <span className="flex items-center gap-1">
                <strong className="text-stone-900 font-extrabold">{activeDeals.length}+</strong> deals active
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                100% verified stores
              </span>
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                24x7 price-drop alerts
              </span>
            </div>
          </div>

          {/* Quick VIP Card on Desktop */}
          <div className="hidden lg:block shrink-0 max-w-xs w-full bg-stone-50 border border-stone-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#25D366] text-stone-950 flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4 fill-stone-950" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-stone-900">VIP WhatsApp Group</h3>
                <p className="text-[10px] text-stone-500">{WHATSAPP_COMMUNITY_MEMBERS} local members</p>
              </div>
            </div>
            <p className="text-[11px] text-stone-600 mb-3 leading-tight">
              Aizawl &amp; Mizoram delivery hub stock a zawh hmaa loot deal man tlawm hriat zung zung nan.
            </p>
            <a
              href={WHATSAPP_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-[#25D366] hover:bg-[#20bd5a] text-stone-950 font-bold text-xs rounded-lg transition-colors shadow-2xs"
            >
              <span>Join WhatsApp Channel</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </section>

      {/* 3. IndiaDesire Section Heading: "Loot Deals Of The Hour" */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg sm:text-2xl font-black text-[#C72026] flex items-center gap-1.5 tracking-tight">
            <Flame className="w-5 h-5 sm:w-6 sm:h-6 fill-[#C72026]" />
            <span>
              {activeTab === 'loot' 
                ? 'Loot Deals Of The Hour' 
                : activeFilters.store && activeFilters.store !== 'all'
                ? `${STORE_BADGES[activeFilters.store]?.name || activeFilters.store} Deals`
                : activeFilters.category && activeFilters.category !== 'all'
                ? `${activeFilters.category.replace('_', ' ').toUpperCase()} Deals`
                : 'Loot Deals Of The Hour'}
            </span>
          </h2>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
            {filteredDeals.length} deals
          </span>
        </div>

        {/* Quick Tabs Toggle */}
        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => handleFilterChange({ tab: 'all', lootOnly: false })}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange({ tab: 'loot', lootOnly: true })}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
              activeTab === 'loot'
                ? 'bg-[#C72026] text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            <Flame className={`w-3 h-3 ${activeTab === 'loot' ? 'fill-white' : 'text-[#C72026]'}`} />
            <span>50%+ Off</span>
          </button>
        </div>
      </div>

      {/* 4. IndiaDesire Deal Filters (Search, Stores, Categories, Sort) */}
      <section className="bg-white border border-stone-200 rounded-xl p-3 sm:p-4 shadow-2xs">
        <DealFilters
          filters={activeFilters}
          onFilterChange={handleFilterChange}
          categoryCounts={categoryCounts}
          totalDealsCount={activeDeals.length}
        />
      </section>

      {/* 5. Main Deals Grid (.dgrid in IndiaDesire: 2-col on mobile, 4-col on desktop) */}
      <DealGrid
        deals={filteredDeals}
        isBookmarked={isBookmarked}
        onToggleBookmark={toggleBookmark}
        onOpenDetails={(deal) => setSelectedDeal(deal)}
        onOpenAlert={(deal) => setAlertDeal(deal)}
        onResetFilters={() => handleFilterChange({ category: 'all', search: '', lootOnly: false, priceRange: 'all', tab: 'all', store: 'all' })}
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

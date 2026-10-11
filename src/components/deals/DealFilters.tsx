import React from 'react';
import { 
  Search, 
  X, 
  Flame, 
  ArrowUpDown, 
  Filter,
  Sparkles,
  Shirt,
  Tv,
  Activity,
  Home,
  Smartphone
} from 'lucide-react';
import type { DealCategory, DealsFilterParams } from '../../types';

interface DealFiltersProps {
  filters: DealsFilterParams;
  onFilterChange: (newFilters: Partial<DealsFilterParams>) => void;
  categoryCounts: Record<DealCategory, number>;
  totalDealsCount: number;
}

const CATEGORIES: { id: DealCategory; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'all', label: 'All Deals', icon: Sparkles },
  { id: 'shoes_fashion', label: 'Fashion & Shoes', icon: Shirt },
  { id: 'electronics', label: 'Electronics', icon: Tv },
  { id: 'sports', label: 'Sports & Fitness', icon: Activity },
  { id: 'home_kitchen', label: 'Home & Kitchen', icon: Home },
  { id: 'gadgets', label: 'Gadgets & Tech', icon: Smartphone },
];

const PRICE_RANGES = [
  { id: 'all', label: 'All Prices' },
  { id: 'under_500', label: 'Under ₹500' },
  { id: 'under_1500', label: 'Under ₹1,500' },
  { id: 'under_5000', label: 'Under ₹5,000' },
  { id: 'above_5000', label: '₹5,000+' },
] as const;

export const DealFilters: React.FC<DealFiltersProps> = ({
  filters,
  onFilterChange,
  categoryCounts,
  totalDealsCount,
}) => {
  const activeCategory = filters.category || 'all';

  return (
    <div className="space-y-4">
      {/* Search Bar & Loot Deals Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            placeholder="Search deals, phones, shoes, laptops, brands..."
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-[#EAE6DF] focus:border-orange-500 rounded-xl text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all shadow-2xs"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onFilterChange({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 rounded-full"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort & Loot Toggle Controls */}
        <div className="flex items-center gap-2">
          {/* Loot Toggle */}
          <button
            type="button"
            onClick={() => onFilterChange({ lootOnly: !filters.lootOnly })}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
              filters.lootOnly
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent shadow-xs'
                : 'bg-white border-[#EAE6DF] text-stone-700 hover:border-stone-300'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${filters.lootOnly ? 'fill-current' : 'text-orange-500'}`} />
            <span>Loot Only</span>
          </button>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={filters.sort || 'discount_desc'}
              onChange={(e) => onFilterChange({ sort: e.target.value as DealsFilterParams['sort'] })}
              className="appearance-none bg-white border border-[#EAE6DF] hover:border-stone-300 pl-8 pr-8 py-2.5 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer shadow-2xs"
            >
              <option value="discount_desc">Highest Discount</option>
              <option value="newest">Recently Verified</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating_desc">Top Customer Rated</option>
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Category Pills (Horizontal Scroll on Mobile) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = activeCategory === cat.id;
          const count = cat.id === 'all' ? totalDealsCount : (categoryCounts[cat.id] || 0);

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onFilterChange({ category: cat.id })}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border shrink-0 ${
                isSelected
                  ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                  : 'bg-white text-stone-700 border-[#EAE6DF] hover:border-stone-300 hover:bg-stone-50/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-stone-500'}`} />
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                  isSelected ? 'bg-stone-800 text-stone-200' : 'bg-stone-100 text-stone-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Price Range Sub-Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 text-xs">
        <span className="text-[11px] font-semibold text-stone-500 flex items-center gap-1 shrink-0 mr-1">
          <Filter className="w-3 h-3 text-stone-400" />
          Budget:
        </span>
        {PRICE_RANGES.map((range) => {
          const isSelected = (filters.priceRange || 'all') === range.id;
          return (
            <button
              key={range.id}
              type="button"
              onClick={() => onFilterChange({ priceRange: range.id })}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors border shrink-0 ${
                isSelected
                  ? 'bg-orange-50 text-orange-900 border-orange-300 font-semibold'
                  : 'bg-white text-stone-600 border-[#EAE6DF] hover:bg-stone-50'
              }`}
            >
              {range.label}
            </button>
          );
        })}

        {/* Clear filters shortcut */}
        {(filters.search || filters.category !== 'all' || filters.lootOnly || (filters.priceRange && filters.priceRange !== 'all')) && (
          <button
            type="button"
            onClick={() => onFilterChange({ category: 'all', search: '', lootOnly: false, priceRange: 'all' })}
            className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 underline underline-offset-2 shrink-0 ml-2"
          >
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
};

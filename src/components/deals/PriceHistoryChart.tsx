import React from 'react';
import type { PricePoint } from '../../types';
import { formatINR } from '../../utils/formatters';
import { TrendingDown, Award } from 'lucide-react';

interface PriceHistoryChartProps {
  history?: PricePoint[];
  originalPrice: number;
  dealPrice: number;
  lowestEverPrice?: number;
}

export const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({
  history = [],
  originalPrice,
  dealPrice,
  lowestEverPrice,
}) => {
  if (!history || history.length === 0) return null;

  const prices = history.map((h) => h.price);
  const maxPrice = Math.max(...prices, originalPrice);
  const minPrice = Math.min(...prices, dealPrice);
  const priceRange = maxPrice - minPrice || 1;

  const lowest = lowestEverPrice ?? minPrice;
  const isAllTimeLow = dealPrice <= lowest;

  return (
    <div className="bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
          <TrendingDown className="w-4 h-4 text-orange-600" />
          <span>Price History & Drop Tracker</span>
        </div>
        {isAllTimeLow && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Award className="w-3 h-3 text-emerald-600" />
            All-Time Low Price!
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-2 h-28 pt-4 pb-2 px-1">
        {history.map((point, index) => {
          // Normalize height between 20% and 95%
          const normalizedHeight = Math.round(
            20 + ((point.price - minPrice) / priceRange) * 70
          );
          const isCurrent = index === history.length - 1;

          return (
            <div key={point.date} className="flex-1 flex flex-col items-center gap-1.5 group relative">
              <span className="text-[10px] font-semibold text-stone-600 transition-opacity">
                {formatINR(point.price)}
              </span>
              <div className="w-full flex justify-center items-end h-18">
                <div
                  style={{ height: `${normalizedHeight}%` }}
                  className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${
                    isCurrent
                      ? 'bg-orange-600 shadow-sm'
                      : 'bg-stone-300 group-hover:bg-stone-400'
                  }`}
                />
              </div>
              <span className="text-[10px] font-medium text-stone-500 truncate">
                {point.date}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-[#EAE6DF] flex items-center justify-between text-xs text-stone-600">
        <div>
          <span className="text-stone-400">MRP: </span>
          <span className="font-medium line-through text-stone-500">{formatINR(originalPrice)}</span>
        </div>
        <div>
          <span className="text-stone-400">Lowest Recorded: </span>
          <span className="font-semibold text-emerald-700">{formatINR(lowest)}</span>
        </div>
      </div>
    </div>
  );
};

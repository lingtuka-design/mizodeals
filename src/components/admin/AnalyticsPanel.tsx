import React, { useState, useEffect } from 'react';
import { RefreshCw, Users, Eye, Globe, Smartphone, Monitor, MapPin, ArrowUpRight, Clock } from 'lucide-react';

interface AnalyticsData {
  totalViews: number;
  todayUniqueVisitors: number;
  todayViews: number;
  topCities: { city: string; region: string; count: number }[];
  topDevices: { device: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  recentViews: { path: string; city: string; device: string; referrer: string; created_at: string }[];
  serverTime: string;
}

export const AnalyticsPanel: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/track');
      if (!res.ok) throw new Error('Failed to load analytics data');
      const json = await res.json();
      if (json.success && json.stats) {
        setData(json.stats);
      } else {
        throw new Error(json.error || 'Invalid response');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#EAE6DF] shadow-2xs">
        <div>
          <h3 className="text-base font-bold text-stone-900">Live Visitor & Traffic Analytics</h3>
          <p className="text-xs text-stone-500">
            Real-time privacy-friendly tracking powered by Cloudflare D1 Edge.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchAnalytics}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs rounded-xl transition-colors shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Stats</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 font-medium">
          {error}
        </div>
      )}

      {/* Top 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Today's Unique Visitors */}
        <div className="bg-white p-5 rounded-2xl border border-[#EAE6DF] shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold">Today's Visitors</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-stone-900">
            {loading ? '...' : (data?.todayUniqueVisitors || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-stone-500">Unique shoppers today</p>
        </div>

        {/* Today's Pageviews */}
        <div className="bg-white p-5 rounded-2xl border border-[#EAE6DF] shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold">Today's Pageviews</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Eye className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-stone-900">
            {loading ? '...' : (data?.todayViews || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-stone-500">Total deal views & clicks today</p>
        </div>

        {/* All-time Pageviews */}
        <div className="bg-white p-5 rounded-2xl border border-[#EAE6DF] shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold">Total Lifetime Views</span>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Globe className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-stone-900">
            {loading ? '...' : (data?.totalViews || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-stone-500">Overall page impressions</p>
        </div>
      </div>

      {/* Grid: Top Cities & Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Cities */}
        <div className="bg-white p-5 rounded-2xl border border-[#EAE6DF] shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#EAE6DF] pb-2.5">
            <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-orange-600" />
              <span>Top Visitor Locations</span>
            </h4>
            <span className="text-[11px] text-stone-400">Cloudflare Edge Geo</span>
          </div>
          {data?.topCities && data.topCities.length > 0 ? (
            <div className="space-y-2">
              {data.topCities.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-stone-100 last:border-0">
                  <span className="font-semibold text-stone-800">
                    {item.city || 'Mizoram'}, <span className="text-stone-400 text-[11px]">{item.region || 'India'}</span>
                  </span>
                  <span className="px-2 py-0.5 bg-stone-100 rounded-lg text-stone-700 font-bold text-[11px]">
                    {item.count} views
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-400 py-4 text-center">No location records yet</p>
          )}
        </div>

        {/* Top Devices & Referrers */}
        <div className="bg-white p-5 rounded-2xl border border-[#EAE6DF] shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#EAE6DF] pb-2.5">
            <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              <span>Devices & Traffic Sources</span>
            </h4>
            <span className="text-[11px] text-stone-400">Breakdown</span>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold text-stone-500 mb-1.5">Device Types</p>
              <div className="flex gap-2">
                {data?.topDevices?.map((d, i) => (
                  <div key={i} className="flex-1 p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-center">
                    <span className="text-[10px] text-stone-500 uppercase font-bold block">{d.device}</span>
                    <span className="text-sm font-extrabold text-stone-900">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-stone-500 mb-1.5">Top Sources / Referrers</p>
              <div className="space-y-1.5">
                {data?.topReferrers && data.topReferrers.length > 0 ? (
                  data.topReferrers.slice(0, 4).map((ref, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-stone-100 last:border-0">
                      <span className="text-stone-700 truncate max-w-[220px]">{ref.referrer.includes('whatsapp') ? '💬 WhatsApp' : ref.referrer}</span>
                      <span className="text-stone-500 font-bold text-[11px]">{ref.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-stone-400">Direct traffic</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Recent Pageviews Feed */}
      <div className="bg-white p-5 rounded-2xl border border-[#EAE6DF] shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#EAE6DF] pb-2.5">
          <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-stone-500" />
            <span>Recent Page Views (Live Activity Stream)</span>
          </h4>
          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Live
          </span>
        </div>

        {data?.recentViews && data.recentViews.length > 0 ? (
          <div className="divide-y divide-stone-100 overflow-x-auto">
            {data.recentViews.map((v, i) => (
              <div key={i} className="py-2.5 flex items-center justify-between text-xs gap-3">
                <div className="min-w-0">
                  <span className="font-semibold text-stone-900 block truncate">{v.path}</span>
                  <span className="text-[11px] text-stone-400">
                    {v.city && v.city !== 'Unknown' ? `${v.city} • ` : ''}{v.device} • {v.referrer.includes('whatsapp') ? 'WhatsApp' : v.referrer}
                  </span>
                </div>
                <span className="text-[11px] text-stone-400 font-mono whitespace-nowrap shrink-0">
                  {new Date(v.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone-400 py-6 text-center">No views tracked yet today.</p>
        )}
      </div>
    </div>
  );
};

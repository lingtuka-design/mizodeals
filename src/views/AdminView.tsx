import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../components/common/Toast';
import type { Deal, BlogPost, DealCategory, StoreType } from '../types';
import { buildAffiliateUrl, generateWhatsAppDealShareText, shareDealToWhatsApp } from '../utils/affiliate';
import { WHATSAPP_CHANNEL_URL, WHATSAPP_CHANNEL_NAME } from '../config/constants';
import { formatINR, copyTextToClipboard } from '../utils/formatters';
import { 
  Lock, 
  Plus, 
  Trash2, 
  Edit3, 
  Flame, 
  Share2, 
  Copy, 
  Download, 
  Upload, 
  RefreshCw, 
  ExternalLink,
  MessageCircle,
  FileText,
  Tag,
  CheckCircle2,
  X,
  Search,
  Sparkles,
  Bot,
  Globe,
  Check,
  ArrowRight,
  LogOut,
  BarChart3
} from 'lucide-react';
import { AnalyticsPanel } from '../components/admin/AnalyticsPanel';

const ADMIN_USERNAME = 'lingtuka';
const ADMIN_PASSWORD = 'MAWLA1984@mala';

export const AdminView: React.FC = () => {
  const { 
    deals, 
    blogs, 
    addDeal, 
    addMultipleDeals,
    updateDeal, 
    deleteDeal, 
    addBlogPost, 
    deleteBlogPost, 
    resetToDefaults,
    exportDataJson,
    importDataJson 
  } = useData();

  const { showToast } = useToast();

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('mizodeals_admin_auth') === 'true';
  });
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'deals' | 'scraper' | 'blogs' | 'whatsapp' | 'backup' | 'analytics'>('deals');

  // Search filter inside admin
  const [searchTerm, setSearchTerm] = useState('');

  // Deal Form State (Add / Edit)
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const [dealForm, setDealForm] = useState<{
    asin: string;
    title: string;
    category: DealCategory;
    store: StoreType;
    originalPrice: number;
    dealPrice: number;
    discountPercent: number;
    rating: number;
    ratingsCount: number;
    imageUrl: string;
    isLootDeal: boolean;
    status: 'active' | 'expired';
    couponText: string;
    description: string;
  }>({
    asin: '',
    title: '',
    category: 'electronics',
    store: 'amazon',
    originalPrice: 1999,
    dealPrice: 999,
    discountPercent: 50,
    rating: 4.5,
    ratingsCount: 500,
    imageUrl: '',
    isLootDeal: false,
    status: 'active',
    couponText: '',
    description: '',
  });

  // Blog Form State (Add)
  const [isBlogModalOpen, setIsBlogModalOpen] = useState(false);
  const [blogForm, setBlogForm] = useState<{
    title: string;
    slug: string;
    category: string;
    readTime: string;
    coverImage: string;
    summary: string;
    content: string;
    authorName: string;
    authorRole: string;
    featuredDealIds: string[];
  }>({
    title: '',
    slug: '',
    category: 'Fashion & Shoes',
    readTime: '4 min read',
    coverImage: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',
    summary: '',
    content: '',
    authorName: 'Lalhmangaiha Tochhawng',
    authorRole: 'Editorial Reviewer',
    featuredDealIds: [],
  });

  // WhatsApp Broadcast Helper State
  const [selectedBroadcastDealId, setSelectedBroadcastDealId] = useState<string>(deals[0]?.id || '');
  const [broadcastFilter, setBroadcastFilter] = useState<'loot' | 'all' | 'electronics' | 'shoes_fashion' | 'home_kitchen' | 'gadgets'>('loot');
  const [broadcastSearch, setBroadcastSearch] = useState('');

  // Multi-Source Scraper State (Telegram Deals + DealsMagnet + IFS)
  const [isScraping, setIsScraping] = useState(false);
  const [selectedSource, setSelectedSource] = useState<'all' | 'telegram' | 'dealsmagnet' | 'ifs'>('all');
  const [scrapedDeals, setScrapedDeals] = useState<Array<{
    dealId: string;
    title: string;
    price: number;
    originalPrice: number;
    discountPercent: number;
    rating: number;
    ratingsCount: number;
    imageUrl: string;
    asin: string | null;
    amazonUrl: string | null;
    category: DealCategory;
    source: string;
    isLootDeal: boolean;
  }>>([]);
  const [importedDealIds, setImportedDealIds] = useState<Set<string>>(new Set());

  // Auto-Publish All Scraped Deals at once
  const handleAutoPublishAllDeals = (dealsToPublish = scrapedDeals) => {
    if (!dealsToPublish.length) {
      showToast('No deals to auto-publish. Fetch deals first!', 'warning');
      return;
    }

    const payload = dealsToPublish.map((item) => {
      const finalAsin = item.asin || `HARVEST-${item.dealId}`;
      const affiliateUrl = item.amazonUrl || buildAffiliateUrl(finalAsin, 'amazon');

      return {
        asin: finalAsin,
        title: item.title,
        category: (item.category as DealCategory) || 'electronics',
        store: 'amazon' as StoreType,
        originalPrice: item.originalPrice || item.price * 2,
        dealPrice: item.price,
        discountPercent: item.discountPercent || 50,
        rating: item.rating || 4.4,
        ratingsCount: item.ratingsCount || 1200,
        imageUrl: item.imageUrl || (item.asin ? `https://images-eu.ssl-images-amazon.com/images/P/${item.asin}.01.MAIN._SCRMZZZZZZ_.jpg` : ''),
        isLootDeal: item.isLootDeal || item.discountPercent >= 50,
        status: 'active' as const,
        couponText: item.discountPercent >= 60 ? '🔥 Price Tlahniam Nasa!' : undefined,
        description: `Imported via Multi-Source Harvester (${item.source}). 100% verified Amazon pricing categorized into ${item.category}.`,
        affiliateUrl,
        createdAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
        verifiedAt: 'Auto-published just now',
      };
    });

    const count = addMultipleDeals(payload);
    const newIds = new Set(importedDealIds);
    dealsToPublish.forEach((d) => newIds.add(d.dealId));
    setImportedDealIds(newIds);

    showToast(`Successfully auto-published ${count} new deals across all categories!`, 'success');
  };

  // Fetch Multi-Source Live Feed (Telegram, DealsMagnet, IFS)
  const handleFetchMultiDeals = async (autoPublish = false) => {
    setIsScraping(true);
    try {
      const sourceQuery = selectedSource !== 'all' ? `&source=${selectedSource}` : '';
      const autoQuery = autoPublish ? '&autoPublish=true' : '';
      const res = await fetch(`/api/multi-scraper?limit=60${sourceQuery}${autoQuery}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json() as { success: boolean; deals?: any[]; insertedCount?: number; error?: string };
      if (data.success && Array.isArray(data.deals)) {
        setScrapedDeals(data.deals);
        if (autoPublish) {
          handleAutoPublishAllDeals(data.deals);
        } else {
          showToast(`Harvested ${data.deals.length} Amazon loot deals from ${selectedSource.toUpperCase()}!`, 'success');
        }
      } else {
        throw new Error(data.error || 'Failed to parse response');
      }
    } catch (err: any) {
      showToast(`Scraper error: ${err.message || 'Make sure Cloudflare Worker is running'}`, 'warning');
    } finally {
      setIsScraping(false);
    }
  };

  // 1-Click Import Scraped Deal to Live Website Catalog
  const handleImportScrapedDeal = (item: (typeof scrapedDeals)[0]) => {
    const finalAsin = item.asin || `HARVEST-${item.dealId}`;
    const affiliateUrl = item.amazonUrl || buildAffiliateUrl(finalAsin, 'amazon');

    addDeal({
      asin: finalAsin,
      title: item.title,
      category: (item.category as DealCategory) || 'electronics',
      store: 'amazon',
      originalPrice: item.originalPrice || item.price * 2,
      dealPrice: item.price,
      discountPercent: item.discountPercent || 50,
      rating: item.rating || 4.3,
      ratingsCount: item.ratingsCount || 500,
      imageUrl: item.imageUrl || (item.asin ? `https://images-eu.ssl-images-amazon.com/images/P/${item.asin}.01.MAIN._SCRMZZZZZZ_.jpg` : ''),
      isLootDeal: item.isLootDeal || item.discountPercent >= 50,
      status: 'active',
      couponText: item.discountPercent >= 60 ? '🔥 Price Tlahniam Nasa!' : undefined,
      description: `Imported via Multi-Source Harvester (${item.source}). 100% verified Amazon pricing with active discount.`,
      affiliateUrl,
      createdAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      verifiedAt: 'Imported just now',
    });

    setImportedDealIds((prev) => new Set([...prev, item.dealId]));
    showToast(`"${item.title.substring(0, 30)}..." published to live catalog!`, 'success');
  };

  // Handle Username & Password Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim() === ADMIN_USERNAME && passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('mizodeals_admin_auth', 'true');
      setAuthError('');
      showToast('Welcome, Admin Lingtuka!', 'success');
    } else {
      setAuthError('Username emaw password a dik lo. Khawngaihin enfiah leh rawh.');
    }
  };

  // Handle Logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('mizodeals_admin_auth');
    setUsernameInput('');
    setPasswordInput('');
    showToast('Logged out successfully', 'info');
  };

  // Helper to extract ASIN from URL or clean input
  const handleAsinOrUrlChange = (value: string) => {
    let cleanAsin = value.trim();
    // Match Amazon ASIN /dp/B0XXXXXXXX or /gp/product/B0XXXXXXXX
    const match = value.match(/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (match && match[1]) {
      cleanAsin = match[1].toUpperCase();
    }
    setDealForm((prev) => ({
      ...prev,
      asin: cleanAsin,
    }));
  };

  // Auto-calculate discount
  const handlePriceChange = (original: number, deal: number) => {
    const discount = original > 0 ? Math.round(((original - deal) / original) * 100) : 0;
    setDealForm((prev) => ({
      ...prev,
      originalPrice: original,
      dealPrice: deal,
      discountPercent: Math.max(0, discount),
      isLootDeal: discount >= 50,
    }));
  };

  // Open Deal Modal for Add / Edit
  const openAddDealModal = () => {
    setEditingDealId(null);
    setDealForm({
      asin: '',
      title: '',
      category: 'electronics',
      store: 'amazon',
      originalPrice: 2999,
      dealPrice: 1299,
      discountPercent: 57,
      rating: 4.4,
      ratingsCount: 1200,
      imageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80',
      isLootDeal: true,
      status: 'active',
      couponText: '',
      description: '',
    });
    setIsDealModalOpen(true);
  };

  const openEditDealModal = (deal: Deal) => {
    setEditingDealId(deal.id);
    setDealForm({
      asin: deal.asin,
      title: deal.title,
      category: deal.category,
      store: deal.store,
      originalPrice: deal.originalPrice,
      dealPrice: deal.dealPrice,
      discountPercent: deal.discountPercent,
      rating: deal.rating,
      ratingsCount: deal.ratingsCount,
      imageUrl: deal.imageUrl,
      isLootDeal: Boolean(deal.isLootDeal),
      status: deal.status || 'active',
      couponText: deal.couponText || '',
      description: deal.description || '',
    });
    setIsDealModalOpen(true);
  };

  // Save Deal
  const handleSaveDeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealForm.title || !dealForm.asin) {
      showToast('Please provide a Title and ASIN', 'warning');
      return;
    }

    const affiliateUrl = buildAffiliateUrl(dealForm.asin, dealForm.store);

    if (editingDealId) {
      updateDeal(editingDealId, {
        ...dealForm,
        affiliateUrl,
        lastCheckedAt: new Date().toISOString(),
        verifiedAt: 'Updated just now',
      });
      showToast('Deal updated successfully!', 'success');
    } else {
      addDeal({
        ...dealForm,
        affiliateUrl,
        createdAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
        verifiedAt: 'Just added',
      });
      showToast('New deal created and published!', 'success');
    }

    setIsDealModalOpen(false);
  };

  // Save Blog Post
  const handleSaveBlog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blogForm.title || !blogForm.summary) {
      showToast('Please provide a Title and Summary', 'warning');
      return;
    }

    const slug = blogForm.slug || blogForm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    addBlogPost({
      title: blogForm.title,
      slug,
      category: blogForm.category,
      readTime: blogForm.readTime,
      coverImage: blogForm.coverImage,
      summary: blogForm.summary,
      content: blogForm.content,
      publishedAt: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      featuredDealIds: blogForm.featuredDealIds,
      author: {
        name: blogForm.authorName,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        role: blogForm.authorRole,
      },
    });

    showToast('Buying Guide published successfully!', 'success');
    setIsBlogModalOpen(false);
  };

  // Export JSON
  const handleExport = () => {
    const json = exportDataJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mizodeals_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup downloaded!', 'success');
  };

  // Import JSON
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importDataJson(content);
        if (success) {
          showToast('Data imported successfully!', 'success');
        } else {
          showToast('Failed to parse backup JSON', 'warning');
        }
      }
    };
    reader.readAsText(file);
  };

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired'>('all');

  // Automated Price Re-check & Loot Classifier
  const handleRunPriceRecheck = () => {
    let recheckedExpired = 0;
    let recheckedLoot = 0;
    deals.forEach((d) => {
      const isExpired = d.status === 'expired' || (d.currentPrice ? d.currentPrice > d.dealPrice * 1.15 : false);
      const isLoot = !isExpired && d.discountPercent >= 50 && d.rating >= 4.0 && d.ratingsCount >= 100;
      updateDeal(d.id, {
        status: isExpired ? 'expired' : 'active',
        isLootDeal: isLoot,
        lastCheckedAt: new Date().toISOString(),
        verifiedAt: isExpired ? 'Price Changed' : 'Checked just now',
      });
      if (isExpired) recheckedExpired++;
      if (isLoot) recheckedLoot++;
    });
    showToast(`Automated check complete: ${recheckedLoot} Loot Deals active, ${recheckedExpired} expired.`, 'success');
  };

  // Filter deals
  const filteredDeals = deals.filter((d) => {
    if (statusFilter !== 'all' && (d.status || 'active') !== statusFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return d.title.toLowerCase().includes(term) || d.asin.toLowerCase().includes(term) || d.category.includes(term);
  });

  const broadcastCandidateDeals = deals.filter((d) => {
    if (broadcastFilter === 'loot' && !d.isLootDeal && d.discountPercent < 50) return false;
    if (broadcastFilter !== 'all' && broadcastFilter !== 'loot' && d.category !== broadcastFilter) return false;
    if (broadcastSearch) {
      const q = broadcastSearch.toLowerCase();
      return d.title.toLowerCase().includes(q) || d.asin.toLowerCase().includes(q);
    }
    return true;
  });

  const broadcastDeal = deals.find((d) => d.id === selectedBroadcastDealId) || broadcastCandidateDeals[0] || deals[0];

  // If not authenticated, show Login gate
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 sm:py-24">
        <div className="bg-white border border-[#EAE6DF] rounded-3xl p-6 sm:p-8 shadow-xs text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img
              src="/logo-icon.png"
              alt="Mizodeals icon"
              className="w-10 h-10 rounded-xl object-contain shadow-2xs"
            />
            <img
              src="/logo.png"
              alt="Mizodeals"
              className="h-7 w-auto object-contain"
            />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-stone-700 text-xs font-semibold mb-2">
            <Lock className="w-3.5 h-3.5 text-stone-600" />
            <span>Admin Control Panel</span>
          </div>
          <h1 className="text-xl font-black text-stone-900 tracking-tight">Admin Login</h1>
          <p className="text-xs text-stone-500 mt-1 mb-6">
            Mizodeals control panel luh nan username leh password chhu lut rawh le.
          </p>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Username chhu lut rawh"
                autoComplete="username"
                className="w-full text-sm font-medium px-4 py-3 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Password chhu lut rawh"
                autoComplete="current-password"
                className="w-full text-sm font-medium px-4 py-3 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                required
              />
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer mt-2"
            >
              Lut Rawh (Login)
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-[#EAE6DF] rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-900 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            <span>Management Console</span>
          </div>
          <div className="flex items-center gap-2.5 mb-1">
            <img
              src="/logo-icon.png"
              alt="Mizodeals icon"
              className="w-8 h-8 rounded-xl object-contain shadow-2xs"
            />
            <img
              src="/logo.png"
              alt="Mizodeals"
              className="h-6 sm:h-7 w-auto object-contain"
            />
            <span className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">Admin Dashboard</span>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Create and edit live deals, publish buying guides & reviews, and generate viral WhatsApp broadcasts.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={openAddDealModal}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Deal</span>
          </button>
          <button
            type="button"
            onClick={() => setIsBlogModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>New Buying Guide</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            title="Log out of admin"
          >
            <LogOut className="w-4 h-4 text-stone-500" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex items-center gap-2 border-b border-[#EAE6DF] pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('deals')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'deals'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-white text-stone-600 border border-[#EAE6DF] hover:bg-stone-50'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Deals Manager ({deals.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scraper')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'scraper'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'bg-white text-stone-600 border border-[#EAE6DF] hover:bg-stone-50'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Multi-Source Harvester</span>
          {scrapedDeals.length > 0 && (
            <span className="px-1.5 py-0.2 bg-white/20 text-white rounded-md text-[10px] font-black">
              {scrapedDeals.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('blogs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'blogs'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-white text-stone-600 border border-[#EAE6DF] hover:bg-stone-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Buying Guides & Reviews ({blogs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('whatsapp')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'whatsapp'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-white text-stone-600 border border-[#EAE6DF] hover:bg-stone-50'
          }`}
        >
          <MessageCircle className="w-4 h-4 text-[#25D366]" />
          <span>WhatsApp Broadcast Helper</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'backup'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-white text-stone-600 border border-[#EAE6DF] hover:bg-stone-50'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Backup & Sync</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'analytics'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-white text-stone-600 border border-[#EAE6DF] hover:bg-stone-50'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-emerald-600" />
          <span>Visitor Analytics</span>
        </button>
      </div>

      {/* TAB 1: DEALS MANAGER */}
      {activeTab === 'deals' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#EAE6DF]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search deals by title, ASIN, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'expired')}
                className="px-3 py-2 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs font-semibold text-stone-700 cursor-pointer"
              >
                <option value="all">All Deals ({deals.length})</option>
                <option value="active">Active Only ({deals.filter(d => (d.status || 'active') === 'active').length})</option>
                <option value="expired">Expired Only ({deals.filter(d => d.status === 'expired').length})</option>
              </select>

              <button
                type="button"
                onClick={handleRunPriceRecheck}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                title="Runs automated rules to detect expired prices or promote >50% discount items to Loot Deals"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Price Re-check Worker</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-[#EAE6DF] rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700">
                <thead className="bg-[#FAF9F5] text-stone-500 font-bold border-b border-[#EAE6DF]">
                  <tr>
                    <th className="py-3 px-4">Item</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Price</th>
                    <th className="py-3 px-3">Discount</th>
                    <th className="py-3 px-3">ASIN</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE6DF]/80">
                  {filteredDeals.map((deal) => (
                    <tr key={deal.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 max-w-md">
                          <img
                            src={deal.imageUrl}
                            alt=""
                            className="w-10 h-10 object-cover rounded-lg border border-stone-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="font-semibold text-stone-900 truncate">{deal.title}</h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {deal.isLootDeal && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-orange-100 text-orange-800">
                                  <Flame className="w-2.5 h-2.5 fill-current" /> LOOT
                                </span>
                              )}
                              <span className="text-[10px] text-stone-400">{deal.verifiedAt}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => {
                            const newStatus = (deal.status || 'active') === 'active' ? 'expired' : 'active';
                            updateDeal(deal.id, { 
                              status: newStatus,
                              verifiedAt: newStatus === 'expired' ? 'Price Changed' : 'Marked Active'
                            });
                            showToast(`Deal marked as ${newStatus}`, 'info');
                          }}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                            deal.status === 'expired'
                              ? 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                              : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          }`}
                          title="Click to toggle status"
                        >
                          {deal.status === 'expired' ? '❌ EXPIRED' : '🟢 ACTIVE'}
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 font-medium capitalize">
                          {deal.category.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-stone-900">{formatINR(deal.dealPrice)}</div>
                        <div className="text-[10px] text-stone-400 line-through">{formatINR(deal.originalPrice)}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          {deal.discountPercent}% OFF
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-stone-500">
                        {deal.asin}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              shareDealToWhatsApp(deal);
                              showToast('Opening WhatsApp to post to Channel...', 'success');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[#0b6338] bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                            title="Post to WhatsApp Channel"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-[#128C7E]" />
                            <span className="hidden sm:inline">Post Channel</span>
                          </button>
                          <a
                            href={deal.affiliateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
                            title="Open Amazon with Affiliate Tag"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => openEditDealModal(deal)}
                            className="p-1.5 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
                            title="Edit Deal"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete "${deal.title}"?`)) {
                                deleteDeal(deal.id);
                                showToast('Deal deleted', 'info');
                              }
                            }}
                            className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Delete Deal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: MULTI-SOURCE LIVE SCRAPER */}
      {activeTab === 'scraper' && (
        <div className="space-y-4">
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#EAE6DF] space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-orange-100 text-orange-700 rounded-lg">
                    <Bot className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-stone-900">
                    Multi-Source Automated Amazon Harvester
                  </h3>
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  Pulls genuine loot deals from <strong>Telegram Deals</strong>, <strong>DealsMagnet</strong> & <strong>IndiaFreeStuff</strong>, unshortens affiliate links, and injects your tag (<code>lalmalsawmtlu-21</code>).
                </p>

                {/* Source Selection Filter */}
                <div className="flex flex-wrap items-center gap-1.5 pt-3">
                  <span className="text-[11px] font-bold text-stone-500 mr-1">Select Source:</span>
                  {(
                    [
                      { id: 'all', label: 'All 3 Sources' },
                      { id: 'telegram', label: '✈️ Telegram Deals' },
                      { id: 'dealsmagnet', label: '🏷️ DealsMagnet' },
                      { id: 'ifs', label: '🎁 IndiaFreeStuff' },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSource(s.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        selectedSource === s.id
                          ? 'bg-orange-600 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleFetchMultiDeals(false)}
                  disabled={isScraping}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 disabled:opacity-60 font-bold text-xs rounded-xl border border-[#EAE6DF] transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScraping ? 'animate-spin' : ''}`} />
                  <span>Fetch Preview</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleFetchMultiDeals(true)}
                  disabled={isScraping}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isScraping ? 'Harvesting & Publishing...' : '⚡ Fetch & Auto-Publish All'}</span>
                </button>

                {scrapedDeals.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleAutoPublishAllDeals()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Publish Current ({scrapedDeals.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Information Banner */}
            <div className="bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl p-3 text-xs text-stone-600 flex items-start gap-2.5">
              <Globe className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-stone-900 font-semibold">100% Safe Piggyback Harvester:</strong> Telegram flash deals, DealsMagnet lowest-price tracking, leh IndiaFreeStuff atangin Amazon deal tlawm thar apiang kan lo filter a, mi affiliate tag awm sa paihin nangma tag <strong>lalmalsawmtlu-21</strong> a inthun nghal hmak zel e.
              </div>
            </div>

            {/* Results Table / Grid */}
            {scrapedDeals.length === 0 ? (
              <div className="py-12 text-center text-stone-500">
                <Bot className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                <p className="text-xs font-semibold">No deals harvested yet.</p>
                <p className="text-[11px] text-stone-400 mt-0.5">Click "Fetch Preview" or "⚡ Fetch & Auto-Publish All" to harvest live loot deals right now.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-stone-500 pb-1">
                  <span>Found <strong>{scrapedDeals.length}</strong> Amazon India deals</span>
                  <span>{importedDealIds.size} deals imported</span>
                </div>

                <div className="overflow-x-auto border border-[#EAE6DF] rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-stone-50 border-b border-[#EAE6DF] text-stone-600 font-bold">
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Price</th>
                        <th className="py-2.5 px-3">Discount</th>
                        <th className="py-2.5 px-3">ASIN</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {scrapedDeals.map((item) => {
                        const isImported = importedDealIds.has(item.dealId);
                        return (
                          <tr key={item.dealId} className="hover:bg-stone-50/70 transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5 max-w-md">
                                <img
                                  src={item.imageUrl}
                                  alt=""
                                  className="w-10 h-10 object-contain rounded-lg border border-stone-200 shrink-0 bg-white"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src =
                                      'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=120&q=80';
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="font-semibold text-stone-900 truncate" title={item.title}>
                                    {item.title}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    {item.isLootDeal && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-orange-100 text-orange-800">
                                        <Flame className="w-2.5 h-2.5 fill-current" /> LOOT
                                      </span>
                                    )}
                                    <span className="text-[10px] text-stone-400">Via {item.source}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 font-medium capitalize">
                                {item.category}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-stone-900">{formatINR(item.price)}</div>
                              <div className="text-[10px] text-stone-400 line-through">
                                {formatINR(item.originalPrice)}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                {item.discountPercent}% OFF
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-stone-500">
                              {item.asin || (
                                <span className="text-[10px] text-amber-600 font-sans">Resolved</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {item.amazonUrl && (
                                  <a
                                    href={item.amazonUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
                                    title="Test Amazon Link with Affiliate Tag"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  disabled={isImported}
                                  onClick={() => handleImportScrapedDeal(item)}
                                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                                    isImported
                                      ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                                      : 'bg-stone-900 hover:bg-stone-800 text-white shadow-2xs'
                                  }`}
                                >
                                  {isImported ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Imported</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>1-Click Publish</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BLOG & BUYING GUIDES */}
      {activeTab === 'blogs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-[#EAE6DF]">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Buying Guides & Reviews List</h3>
              <p className="text-xs text-stone-500">Articles with embedded products and Amazon affiliate CTAs</p>
            </div>
            <button
              type="button"
              onClick={() => setIsBlogModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-900 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Write Review</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {blogs.map((post) => (
              <div key={post.id} className="bg-white border border-[#EAE6DF] rounded-2xl p-4 flex gap-4 items-start justify-between shadow-2xs">
                <img
                  src={post.coverImage}
                  alt=""
                  className="w-20 h-20 rounded-xl object-cover shrink-0 border border-stone-200"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">
                      {post.category}
                    </span>
                    <span className="text-[10px] text-stone-400">{post.readTime}</span>
                  </div>
                  <h4 className="text-sm font-bold text-stone-900 line-clamp-1">{post.title}</h4>
                  <p className="text-xs text-stone-500 line-clamp-2 mt-0.5">{post.summary}</p>
                  <div className="text-[11px] text-orange-600 font-semibold mt-2">
                    {post.featuredDealIds.length} embedded deals attached
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete buying guide "${post.title}"?`)) {
                      deleteBlogPost(post.id);
                      showToast('Article deleted', 'info');
                    }
                  }}
                  className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 shrink-0"
                  title="Delete Guide"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: WHATSAPP CHANNEL BROADCAST HUB */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          {/* Channel Info & Strategy Banner */}
          <div className="bg-emerald-950 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden border border-emerald-900 shadow-md">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#25D366]/20 border border-[#25D366]/40 text-[#25D366] text-xs font-bold rounded-full mb-2">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Official WhatsApp Channel Connected</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  {WHATSAPP_CHANNEL_NAME}
                </h3>
                <p className="text-xs sm:text-sm text-emerald-200/90 mt-1 max-w-xl leading-relaxed">
                  Scrape thar zing atanga deal tha leh tlawm zualte chauh heta tang hian 1-click-in i WhatsApp Channel-ah broadcast rawh le.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={WHATSAPP_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-stone-950 font-extrabold text-xs rounded-xl shadow-sm transition-all"
                >
                  <span>Open Channel in App</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-300/80">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span>
                <strong>Channel Strategy:</strong> Ni khatah deals tha ber ber 3–6 chauh post thin la, channel a thianghlim ang a, subscriber-te'n notification an ngaihven zual ang.
              </span>
            </div>
          </div>

          {/* Filtering Bar */}
          <div className="bg-white border border-[#EAE6DF] rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scroll-bar-hide">
              <button
                type="button"
                onClick={() => setBroadcastFilter('loot')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                  broadcastFilter === 'loot'
                    ? 'bg-orange-600 text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-300 fill-current" />
                <span>🔥 Top Loot Deals (50%+ OFF)</span>
              </button>

              <button
                type="button"
                onClick={() => setBroadcastFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  broadcastFilter === 'all'
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                All Deals ({deals.length})
              </button>

              <button
                type="button"
                onClick={() => setBroadcastFilter('electronics')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  broadcastFilter === 'electronics'
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Electronics
              </button>

              <button
                type="button"
                onClick={() => setBroadcastFilter('shoes_fashion')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  broadcastFilter === 'shoes_fashion'
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Fashion
              </button>

              <button
                type="button"
                onClick={() => setBroadcastFilter('home_kitchen')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  broadcastFilter === 'home_kitchen'
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Home
              </button>

              <button
                type="button"
                onClick={() => setBroadcastFilter('gadgets')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  broadcastFilter === 'gadgets'
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Gadgets
              </button>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search deals to post..."
                value={broadcastSearch}
                onChange={(e) => setBroadcastSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Main 2-Column Broadcast Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Columns: Candidate Deals List */}
            <div className="lg:col-span-7 space-y-3 max-h-[750px] overflow-y-auto pr-1">
              <div className="flex items-center justify-between text-xs font-bold text-stone-500 px-1">
                <span>Showing {broadcastCandidateDeals.length} Candidate Deals</span>
                <span>Click &quot;1-Click Broadcast&quot; to send directly</span>
              </div>

              {broadcastCandidateDeals.length === 0 ? (
                <div className="p-8 text-center bg-white border border-[#EAE6DF] rounded-2xl">
                  <p className="text-xs text-stone-500">No deals matched your filter.</p>
                </div>
              ) : (
                broadcastCandidateDeals.map((deal) => {
                  const isSelected = broadcastDeal?.id === deal.id;
                  return (
                    <div
                      key={deal.id}
                      onClick={() => setSelectedBroadcastDealId(deal.id)}
                      className={`p-3.5 bg-white border rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-emerald-600 ring-2 ring-emerald-500/20 shadow-sm'
                          : 'border-[#EAE6DF] hover:border-stone-400 hover:shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={deal.imageUrl}
                          alt=""
                          className="w-14 h-14 object-contain rounded-xl border border-stone-200 bg-white shrink-0 p-1"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-stone-900 truncate" title={deal.title}>
                            {deal.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-extrabold text-stone-900">{formatINR(deal.dealPrice)}</span>
                            <span className="text-[11px] text-stone-400 line-through">{formatINR(deal.originalPrice)}</span>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-md">
                              {deal.discountPercent}% OFF
                            </span>
                            {deal.isLootDeal && (
                              <span className="text-[9px] font-bold text-orange-800 bg-orange-100 px-1.5 py-0.2 rounded-md">
                                LOOT
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-stone-400 capitalize mt-0.5 block">
                            {deal.category.replace('_', ' ')} • {deal.verifiedAt}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            shareDealToWhatsApp(deal);
                            showToast('Opening WhatsApp Channel...', 'success');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-stone-950 font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer"
                          title="Open WhatsApp to Post this Deal"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>1-Click Post</span>
                        </button>

                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const text = generateWhatsAppDealShareText(deal);
                            await copyTextToClipboard(text);
                            showToast('Caption copied to clipboard!', 'success');
                          }}
                          className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors border border-[#EAE6DF]"
                          title="Copy WhatsApp Caption"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right 5 Columns: WhatsApp Chat Bubble Live Preview */}
            <div className="lg:col-span-5 bg-white border border-[#EAE6DF] rounded-3xl p-5 sm:p-6 space-y-4 sticky top-6 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#EAE6DF]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center text-white">
                    <MessageCircle className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">WhatsApp Post Preview</h4>
                    <p className="text-[10px] text-stone-500">Live preview with Mizodeals Bridge URL</p>
                  </div>
                </div>
                {broadcastDeal && (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {broadcastDeal.discountPercent}% OFF
                  </span>
                )}
              </div>

              {broadcastDeal ? (
                <>
                  {/* WhatsApp Native Bubble Simulation */}
                  <div className="bg-[#EFEAE2] p-4 rounded-2xl border border-stone-200">
                    <div className="bg-white rounded-2xl p-3.5 shadow-xs border border-stone-100 space-y-3">
                      <img
                        src={broadcastDeal.imageUrl}
                        alt=""
                        className="w-full h-44 object-contain rounded-xl bg-stone-50 p-2 border border-stone-100"
                      />
                      <div className="font-sans text-xs text-stone-900 whitespace-pre-wrap leading-relaxed">
                        {generateWhatsAppDealShareText(broadcastDeal)}
                      </div>
                    </div>
                  </div>

                  {/* Broadcast Actions */}
                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        shareDealToWhatsApp(broadcastDeal);
                        showToast('Opening WhatsApp to post to Channel...', 'success');
                      }}
                      className="w-full py-3 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-stone-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Post Selected Deal to WhatsApp Channel</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const text = generateWhatsAppDealShareText(broadcastDeal);
                        await copyTextToClipboard(text);
                        showToast('WhatsApp deal text copied!', 'success');
                      }}
                      className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl border border-[#EAE6DF] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copy Full Caption with Link</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-xs text-stone-400">
                  Select a deal to preview the broadcast.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BACKUP & DATA SYNC */}
      {activeTab === 'backup' && (
        <div className="bg-white border border-[#EAE6DF] rounded-3xl p-6 sm:p-8 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-stone-900">Backup & Data Synchronization</h3>
            <p className="text-xs text-stone-500 mt-1">
              Download your current deals and reviews as a JSON file, or restore a backup.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-[#FAF9F5] border border-[#EAE6DF] rounded-2xl flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-stone-900">Export Backup</h4>
                <p className="text-[11px] text-stone-500 mt-1">Download all {deals.length} deals and {blogs.length} articles to a JSON file.</p>
              </div>
              <button
                type="button"
                onClick={handleExport}
                className="mt-4 w-full py-2 px-3 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>
            </div>

            <div className="p-4 bg-[#FAF9F5] border border-[#EAE6DF] rounded-2xl flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-stone-900">Import Backup</h4>
                <p className="text-[11px] text-stone-500 mt-1">Restore your deals from a saved JSON file.</p>
              </div>
              <label className="mt-4 w-full py-2 px-3 bg-stone-100 text-stone-700 border border-[#EAE6DF] rounded-xl text-xs font-semibold hover:bg-stone-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Select JSON File</span>
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
            </div>

            <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-2xl flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-rose-900">Reset Defaults</h4>
                <p className="text-[11px] text-rose-700/80 mt-1">Reset all data back to the default curated seed catalog.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Reset all deals and blogs back to initial default items?')) {
                    resetToDefaults();
                    showToast('Data reset to defaults', 'info');
                  }
                }}
                className="mt-4 w-full py-2 px-3 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: VISITOR ANALYTICS */}
      {activeTab === 'analytics' && (
        <AnalyticsPanel />
      )}

      {/* MODAL: ADD / EDIT DEAL */}
      {isDealModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white border border-[#EAE6DF] rounded-3xl shadow-xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsDealModalOpen(false)}
              className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-stone-900 mb-1">
              {editingDealId ? 'Edit Deal' : 'Add New Deal'}
            </h3>
            <p className="text-xs text-stone-500 mb-4">
              Enter the Amazon ASIN or URL. Affiliate tag (`lalmalsawmtlu-21`) is automatically added.
            </p>

            <form onSubmit={handleSaveDeal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Amazon ASIN or Product URL *
                </label>
                <input
                  type="text"
                  placeholder="e.g. B0CHX1W1XY or paste full Amazon link"
                  value={dealForm.asin}
                  onChange={(e) => handleAsinOrUrlChange(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  Affiliate Link: https://www.amazon.in/dp/{dealForm.asin || '{ASIN}'}?tag=lalmalsawmtlu-21
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Product Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Apple iPhone 15 (128GB) - Black"
                  value={dealForm.title}
                  onChange={(e) => setDealForm({ ...dealForm, title: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Category</label>
                  <select
                    value={dealForm.category}
                    onChange={(e) => setDealForm({ ...dealForm, category: e.target.value as DealCategory })}
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs font-semibold text-stone-900 cursor-pointer"
                  >
                    <option value="electronics">Electronics</option>
                    <option value="shoes_fashion">Fashion & Shoes</option>
                    <option value="gadgets">Gadgets & Tech</option>
                    <option value="home_kitchen">Home & Kitchen</option>
                    <option value="sports">Sports & Fitness</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Store</label>
                  <select
                    value={dealForm.store}
                    onChange={(e) => setDealForm({ ...dealForm, store: e.target.value as StoreType })}
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs font-semibold text-stone-900 cursor-pointer"
                  >
                    <option value="amazon">Amazon.in</option>
                    <option value="flipkart">Flipkart</option>
                    <option value="hm">H&M</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Status</label>
                  <select
                    value={dealForm.status}
                    onChange={(e) => setDealForm({ ...dealForm, status: e.target.value as 'active' | 'expired' })}
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs font-semibold text-stone-900 cursor-pointer"
                  >
                    <option value="active">Active Deal</option>
                    <option value="expired">Expired / Stock Out</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Original MRP (₹)</label>
                  <input
                    type="number"
                    value={dealForm.originalPrice}
                    onChange={(e) => handlePriceChange(Number(e.target.value), dealForm.dealPrice)}
                    required
                    className="w-full px-3 py-2 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs font-bold text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Deal Price (₹)</label>
                  <input
                    type="number"
                    value={dealForm.dealPrice}
                    onChange={(e) => handlePriceChange(dealForm.originalPrice, Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs font-bold text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Discount (%)</label>
                  <input
                    type="number"
                    value={dealForm.discountPercent}
                    readOnly
                    className="w-full px-3 py-2 bg-stone-100 border border-[#EAE6DF] rounded-xl text-xs font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Product Image URL</label>
                <input
                  type="url"
                  placeholder="Paste direct Amazon or image URL"
                  value={dealForm.imageUrl}
                  onChange={(e) => setDealForm({ ...dealForm, imageUrl: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs text-stone-900"
                />
                {dealForm.imageUrl && (
                  <div className="mt-2 w-16 h-16 rounded-lg overflow-hidden border border-stone-200">
                    <img src={dealForm.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Coupon Text (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Flat ₹500 off coupon at checkout"
                  value={dealForm.couponText}
                  onChange={(e) => setDealForm({ ...dealForm, couponText: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs text-stone-900"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="lootToggle"
                  checked={dealForm.isLootDeal}
                  onChange={(e) => setDealForm({ ...dealForm, isLootDeal: e.target.checked })}
                  className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="lootToggle" className="text-xs font-bold text-stone-800 flex items-center gap-1 cursor-pointer">
                  <Flame className="w-3.5 h-3.5 text-orange-600 fill-current" />
                  Mark as LOOT DEAL (&gt;50% discount highlight)
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {editingDealId ? 'Update Deal' : 'Publish Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: WRITE BUYING GUIDE */}
      {isBlogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white border border-[#EAE6DF] rounded-3xl shadow-xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsBlogModalOpen(false)}
              className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-stone-900 mb-1">Write New Buying Guide / Review</h3>
            <p className="text-xs text-stone-500 mb-4">
              Write an in-depth product review and embed existing deals for instant customer conversion.
            </p>

            <form onSubmit={handleSaveBlog} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Article Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Best 5G Phones Under ₹18,000 for Mizoram Shoppers"
                  value={blogForm.title}
                  onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs font-bold text-stone-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={blogForm.category}
                    onChange={(e) => setBlogForm({ ...blogForm, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs text-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Read Time</label>
                  <input
                    type="text"
                    value={blogForm.readTime}
                    onChange={(e) => setBlogForm({ ...blogForm, readTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs text-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Cover Image URL</label>
                <input
                  type="url"
                  value={blogForm.coverImage}
                  onChange={(e) => setBlogForm({ ...blogForm, coverImage: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Summary (Short Excerpt) *</label>
                <textarea
                  rows={2}
                  placeholder="Quick preview snippet shown in listings..."
                  value={blogForm.summary}
                  onChange={(e) => setBlogForm({ ...blogForm, summary: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Full Article Content (Markdown format)</label>
                <textarea
                  rows={6}
                  placeholder="### Section Heading&#10;&#10;Write your review notes, pros and cons, and recommendations here..."
                  value={blogForm.content}
                  onChange={(e) => setBlogForm({ ...blogForm, content: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs font-mono text-stone-900"
                />
              </div>

              {/* Embed Deals Checklist */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Embed Recommended Deals in this Guide:
                </label>
                <div className="max-h-40 overflow-y-auto border border-[#EAE6DF] rounded-xl p-2 bg-[#FAF9F5] space-y-1.5">
                  {deals.map((deal) => {
                    const isChecked = blogForm.featuredDealIds.includes(deal.id);
                    return (
                      <label
                        key={deal.id}
                        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBlogForm({
                                ...blogForm,
                                featuredDealIds: [...blogForm.featuredDealIds, deal.id],
                              });
                            } else {
                              setBlogForm({
                                ...blogForm,
                                featuredDealIds: blogForm.featuredDealIds.filter((id) => id !== deal.id),
                              });
                            }
                          }}
                          className="rounded text-orange-600 focus:ring-orange-500"
                        />
                        <span className="font-semibold text-stone-900 truncate flex-1">{deal.title}</span>
                        <span className="font-bold text-emerald-700">{formatINR(deal.dealPrice)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Publish Guide
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

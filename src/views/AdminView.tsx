import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../components/common/Toast';
import type { Deal, BlogPost, DealCategory, StoreType } from '../types';
import { buildAffiliateUrl, generateWhatsAppDealShareText, shareDealToWhatsApp } from '../utils/affiliate';
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
  Sparkles
} from 'lucide-react';

const ADMIN_PASSKEY = '2026';

export const AdminView: React.FC = () => {
  const { 
    deals, 
    blogs, 
    addDeal, 
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
  const [passkeyInput, setPasskeyInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'deals' | 'blogs' | 'whatsapp' | 'backup'>('deals');

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

  // Handle Passkey Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passkeyInput === ADMIN_PASSKEY) {
      setIsAuthenticated(true);
      sessionStorage.setItem('mizodeals_admin_auth', 'true');
      setAuthError('');
      showToast('Welcome to Mizodeals Admin Panel!', 'success');
    } else {
      setAuthError('Invalid Admin Passkey. Default is 2026');
    }
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
        verifiedAt: 'Updated just now',
      });
      showToast('Deal updated successfully!', 'success');
    } else {
      addDeal({
        ...dealForm,
        affiliateUrl,
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

  // Filter deals
  const filteredDeals = deals.filter((d) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return d.title.toLowerCase().includes(term) || d.asin.toLowerCase().includes(term) || d.category.includes(term);
  });

  const broadcastDeal = deals.find((d) => d.id === selectedBroadcastDealId) || deals[0];

  // If not authenticated, show PIN gate
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-20">
        <div className="bg-white border border-[#EAE6DF] rounded-3xl p-8 shadow-sm text-center">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black text-stone-900">Mizodeals Admin Login</h1>
          <p className="text-xs text-stone-500 mt-1 mb-6">
            Enter admin passkey to create deals, review posts, and manage products.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={passkeyInput}
                onChange={(e) => setPasskeyInput(e.target.value)}
                placeholder="Enter Passkey (Default: 2026)"
                className="w-full text-center tracking-widest text-lg font-bold px-4 py-3 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                autoFocus
              />
              {authError && <p className="text-xs text-rose-600 mt-1.5 font-medium">{authError}</p>}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer"
            >
              Access Admin Panel
            </button>
          </form>

          <p className="text-[11px] text-stone-400 mt-4">
            Default passkey is <strong>2026</strong>
          </p>
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
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            Mizodeals Admin Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Create and edit live deals, publish buying guides & reviews, and generate viral WhatsApp broadcasts.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-stone-500 whitespace-nowrap">
                Showing {filteredDeals.length} of {deals.length} deals
              </span>
            </div>
          </div>

          <div className="bg-white border border-[#EAE6DF] rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700">
                <thead className="bg-[#FAF9F5] text-stone-500 font-bold border-b border-[#EAE6DF]">
                  <tr>
                    <th className="py-3 px-4">Item</th>
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
                            onClick={() => shareDealToWhatsApp(deal)}
                            className="p-1.5 text-[#128C7E] hover:bg-[#25D366]/10 rounded-lg transition-colors"
                            title="Share on WhatsApp"
                          >
                            <Share2 className="w-3.5 h-3.5" />
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

      {/* TAB 3: WHATSAPP BROADCAST HELPER */}
      {activeTab === 'whatsapp' && (
        <div className="bg-white border border-[#EAE6DF] rounded-3xl p-6 sm:p-8 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
              WhatsApp Viral Broadcast Generator
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Select any deal to preview the pre-formatted viral WhatsApp post with prices, emojis, discount %, and your affiliate tag.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Select Deal to Broadcast:
              </label>
              <select
                value={selectedBroadcastDealId}
                onChange={(e) => setSelectedBroadcastDealId(e.target.value)}
                className="w-full p-3 bg-[#FAF9F5] border border-[#EAE6DF] rounded-xl text-xs font-semibold text-stone-900 cursor-pointer"
              >
                {deals.map((deal) => (
                  <option key={deal.id} value={deal.id}>
                    [{deal.discountPercent}% OFF] {deal.title.substring(0, 60)}...
                  </option>
                ))}
              </select>

              {broadcastDeal && (
                <div className="mt-4 p-4 bg-[#FAF9F5] border border-[#EAE6DF] rounded-2xl flex items-center gap-3">
                  <img
                    src={broadcastDeal.imageUrl}
                    alt=""
                    className="w-14 h-14 object-cover rounded-xl border border-stone-200"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 line-clamp-1">{broadcastDeal.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-extrabold text-stone-900">{formatINR(broadcastDeal.dealPrice)}</span>
                      <span className="text-xs text-stone-400 line-through">{formatINR(broadcastDeal.originalPrice)}</span>
                      <span className="text-xs font-bold text-emerald-700">{broadcastDeal.discountPercent}% OFF</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Broadcast Copy Preview */}
            {broadcastDeal && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-stone-700">
                  Broadcast Copy Preview:
                </label>
                <div className="p-4 bg-[#075E54]/5 border border-[#25D366]/30 rounded-2xl font-mono text-xs text-stone-800 whitespace-pre-wrap leading-relaxed">
                  {generateWhatsAppDealShareText(broadcastDeal)}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => shareDealToWhatsApp(broadcastDeal)}
                    className="flex-1 py-2.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-stone-950 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Send to WhatsApp Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const text = generateWhatsAppDealShareText(broadcastDeal);
                      await copyTextToClipboard(text);
                      showToast('WhatsApp copy copied!', 'success');
                    }}
                    className="py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs rounded-xl border border-[#EAE6DF] transition-colors flex items-center gap-1.5"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy Text</span>
                  </button>
                </div>
              </div>
            )}
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

              <div className="grid grid-cols-2 gap-3">
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

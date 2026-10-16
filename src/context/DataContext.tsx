import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Deal, BlogPost } from '../types';
import { INITIAL_DEALS } from '../data/deals';
import { BLOG_POSTS } from '../data/blogs';
import { buildAffiliateUrl, ensureAffiliateTag } from '../utils/affiliate';

const STORAGE_DEALS_KEY = 'mizodeals_all_deals_v6';
const STORAGE_BLOGS_KEY = 'mizodeals_all_blogs_v1';

interface DataContextType {
  deals: Deal[];
  blogs: BlogPost[];
  addDeal: (deal: Omit<Deal, 'id'>) => Deal;
  addMultipleDeals: (newDeals: Array<Omit<Deal, 'id'>>) => number;
  updateDeal: (id: string, updated: Partial<Deal>) => void;
  deleteDeal: (id: string) => void;
  addBlogPost: (post: Omit<BlogPost, 'id'>) => BlogPost;
  updateBlogPost: (id: string, updated: Partial<BlogPost>) => void;
  deleteBlogPost: (id: string) => void;
  resetToDefaults: () => void;
  exportDataJson: () => string;
  importDataJson: (jsonString: string) => boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deals, setDeals] = useState<Deal[]>(() => {
    try {
      // Clean up legacy v1..v5 caches to ensure instantaneous delivery of fresh catalog
      localStorage.removeItem('mizodeals_all_deals_v1');
      localStorage.removeItem('mizodeals_all_deals_v2');
      localStorage.removeItem('mizodeals_all_deals_v3');
      localStorage.removeItem('mizodeals_all_deals_v4');
      localStorage.removeItem('mizodeals_all_deals_v5');

      const stored = localStorage.getItem(STORAGE_DEALS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((d: Deal) => ({
            ...d,
            affiliateUrl: ensureAffiliateTag(d.affiliateUrl || buildAffiliateUrl(d.asin, d.store)),
          }));
        }
      }
    } catch (e) {
      console.error('Failed to load deals from localStorage', e);
    }
    return INITIAL_DEALS;
  });

  const [blogs, setBlogs] = useState<BlogPost[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_BLOGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(parsed.map((p: BlogPost) => p.id));
          const missing = BLOG_POSTS.filter((p) => !existingIds.has(p.id));
          if (missing.length === 0) return parsed;
          return [...parsed, ...missing];
        }
      }
    } catch (e) {
      console.error('Failed to load blogs from localStorage', e);
    }
    return BLOG_POSTS;
  });

  // Sync deals to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DEALS_KEY, JSON.stringify(deals));
    } catch (e) {
      console.error('Failed to save deals to localStorage', e);
    }
  }, [deals]);

  // Fetch latest live deals from Cloudflare D1 database on mount
  useEffect(() => {
    let isMounted = true;
    fetch('/api/deals?status=all&limit=400')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch from D1');
        return res.json() as Promise<{ success: boolean; deals?: Deal[]; source?: string }>;
      })
      .then((data) => {
        if (isMounted && data.success && Array.isArray(data.deals) && data.deals.length > 0) {
          setDeals((prev) => {
            // Prioritize freshly fetched D1 deals
            const d1Asins = new Set(data.deals!.map((d) => d.asin.toLowerCase()));
            const remainingLocal = prev.filter((d) => !d1Asins.has(d.asin.toLowerCase()));
            const merged = [...data.deals!, ...remainingLocal];
            return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          });
        }
      })
      .catch((err) => {
        // Silently keep local seed deals if offline or in dev
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync blogs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BLOGS_KEY, JSON.stringify(blogs));
    } catch (e) {
      console.error('Failed to save blogs to localStorage', e);
    }
  }, [blogs]);

  const addDeal = useCallback((dealData: Omit<Deal, 'id'>) => {
    const newDeal: Deal = {
      ...dealData,
      id: `deal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    setDeals((prev) => [newDeal, ...prev]);
    return newDeal;
  }, []);

  const addMultipleDeals = useCallback((newDealsData: Array<Omit<Deal, 'id'>>) => {
    if (!newDealsData.length) return 0;
    let addedCount = 0;
    setDeals((prev) => {
      const existingAsins = new Set(prev.map((d) => d.asin.toLowerCase()));
      const toAdd: Deal[] = [];

      newDealsData.forEach((d) => {
        if (!existingAsins.has(d.asin.toLowerCase())) {
          existingAsins.add(d.asin.toLowerCase());
          toAdd.push({
            ...d,
            id: `deal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}-${toAdd.length}`,
          });
        }
      });

      addedCount = toAdd.length;
      return [...toAdd, ...prev];
    });
    return addedCount;
  }, []);

  const updateDeal = useCallback((id: string, updated: Partial<Deal>) => {
    setDeals((prev) =>
      prev.map((deal) => (deal.id === id ? { ...deal, ...updated } : deal))
    );
  }, []);

  const deleteDeal = useCallback((id: string) => {
    setDeals((prev) => prev.filter((deal) => deal.id !== id));
  }, []);

  const addBlogPost = useCallback((postData: Omit<BlogPost, 'id'>) => {
    const newPost: BlogPost = {
      ...postData,
      id: `post-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    setBlogs((prev) => [newPost, ...prev]);
    return newPost;
  }, []);

  const updateBlogPost = useCallback((id: string, updated: Partial<BlogPost>) => {
    setBlogs((prev) =>
      prev.map((post) => (post.id === id ? { ...post, ...updated } : post))
    );
  }, []);

  const deleteBlogPost = useCallback((id: string) => {
    setBlogs((prev) => prev.filter((post) => post.id !== id));
  }, []);

  const resetToDefaults = useCallback(() => {
    setDeals(INITIAL_DEALS);
    setBlogs(BLOG_POSTS);
    localStorage.removeItem(STORAGE_DEALS_KEY);
    localStorage.removeItem(STORAGE_BLOGS_KEY);
  }, []);

  const exportDataJson = useCallback(() => {
    return JSON.stringify({ deals, blogs }, null, 2);
  }, [deals, blogs]);

  const importDataJson = useCallback((jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.deals) && Array.isArray(data.blogs)) {
        setDeals(data.deals);
        setBlogs(data.blogs);
        return true;
      }
    } catch (e) {
      console.error('Import failed', e);
    }
    return false;
  }, []);

  return (
    <DataContext.Provider
      value={{
        deals,
        blogs,
        addDeal,
        addMultipleDeals,
        updateDeal,
        deleteDeal,
        addBlogPost,
        updateBlogPost,
        deleteBlogPost,
        resetToDefaults,
        exportDataJson,
        importDataJson,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

import React from 'react';
import { useData } from '../context/DataContext';
import { BlogCard } from '../components/blog/BlogCard';
import { BookOpen, Sparkles } from 'lucide-react';

export const BlogListView: React.FC = () => {
  const { blogs } = useData();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#EAE6DF] rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100 border border-[#EAE6DF] text-stone-700 text-xs font-bold mb-3">
          <BookOpen className="w-3.5 h-3.5 text-orange-600" />
          <span>Mizodeals Curated Buying Guides</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
          In-Depth Product Reviews & Northeast Buying Guides
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 mt-2 max-w-2xl leading-relaxed">
          Tested recommendations, seasonal gear picks, and smart shopping advice written specifically for buyers in Mizoram and Northeast India.
        </p>
      </div>

      {/* Guide Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {blogs.map((post) => (
          <BlogCard key={post.id} post={post} />
        ))}
      </div>

      {/* Suggestion Card */}
      <div className="p-6 bg-[#FAF9F5] border border-[#EAE6DF] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div>
          <h3 className="text-sm font-bold text-stone-900 flex items-center justify-center sm:justify-start gap-1.5">
            <Sparkles className="w-4 h-4 text-orange-600" />
            Want a specific product tested or compared?
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Drop your suggestion in our WhatsApp Channel and our team will review it.
          </p>
        </div>
        <a
          href="https://chat.whatsapp.com/invite/mizodeals-vip-loot"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors shrink-0"
        >
          Request a Review on WhatsApp
        </a>
      </div>
    </div>
  );
};

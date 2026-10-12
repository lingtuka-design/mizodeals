import React from 'react';
import { Link } from '@tanstack/react-router';
import { Clock, ArrowRight, Tag, BookOpen, Sparkles, ChevronRight } from 'lucide-react';
import type { BlogPost } from '../../types';

interface HeroBuyingGuidesProps {
  blogs: BlogPost[];
}

export const HeroBuyingGuides: React.FC<HeroBuyingGuidesProps> = ({ blogs }) => {
  if (!blogs || blogs.length === 0) return null;

  const featuredPost = blogs[0];
  const sidebarPosts = blogs.slice(1, 4);

  return (
    <div className="mt-8 pt-6 border-t border-[#EAE6DF]">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-orange-100 text-orange-700 rounded-lg">
            <BookOpen className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-stone-900 flex items-center gap-2">
              <span>Buying Guides &amp; Product Reviews</span>
              <span className="hidden sm:inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300/60">
                <Sparkles className="w-2.5 h-2.5 text-amber-600 fill-amber-600" />
                Expert Tested
              </span>
            </h2>
            <p className="text-[11px] sm:text-xs text-stone-500">
              Curated buying advice, durability tests &amp; deal breakdowns for shoppers in Mizoram
            </p>
          </div>
        </div>

        <Link
          to="/blog"
          className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 group"
        >
          <span>View All Guides ({blogs.length})</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* 1. DESKTOP VIEW: News Headlines Editorial Layout (Lead Story + 3 Stacked Sidebar Guides) */}
      <div className="hidden md:grid md:grid-cols-12 gap-5 items-stretch">
        {/* Left Column: Latest / Featured Lead Guide */}
        <div className="md:col-span-7 lg:col-span-8 flex flex-col">
          <Link
            to="/blog/$slug"
            params={{ slug: featuredPost.slug }}
            className="group relative bg-[#FAF9F5] hover:bg-white border border-[#EAE6DF] hover:border-orange-300 rounded-2xl p-4 sm:p-5 transition-all shadow-2xs hover:shadow-md flex flex-col justify-between h-full cursor-pointer"
          >
            <div>
              {/* Cover Image */}
              <div className="relative aspect-16/9 w-full rounded-xl overflow-hidden bg-stone-200 border border-[#EAE6DF]/80 mb-4">
                <img
                  src={featuredPost.coverImage}
                  alt={featuredPost.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span className="bg-stone-900/85 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-xs">
                    {featuredPost.category}
                  </span>
                  <span className="bg-orange-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-2xs">
                    LATEST GUIDE
                  </span>
                </div>

                {featuredPost.featuredDealIds && featuredPost.featuredDealIds.length > 0 && (
                  <div className="absolute bottom-3 right-3">
                    <span className="bg-white/95 backdrop-blur-xs text-stone-900 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-[#EAE6DF] flex items-center gap-1 shadow-xs">
                      <Tag className="w-3 h-3 text-orange-600" />
                      {featuredPost.featuredDealIds.length} Verified Deals
                    </span>
                  </div>
                )}
              </div>

              {/* Meta */}
              <div className="flex items-center gap-2.5 text-[11px] text-stone-500 mb-1.5">
                <span>{featuredPost.publishedAt}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-stone-400" />
                  {featuredPost.readTime}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-base sm:text-xl font-black text-stone-900 leading-snug group-hover:text-orange-600 transition-colors line-clamp-2">
                {featuredPost.title}
              </h3>

              {/* Excerpt */}
              <p className="text-xs sm:text-sm text-stone-600 mt-2 line-clamp-2 leading-relaxed">
                {featuredPost.summary}
              </p>
            </div>

            {/* Author & CTA Footer */}
            <div className="mt-4 pt-3.5 border-t border-[#EAE6DF]/70 flex items-center justify-between">
              {featuredPost.author ? (
                <div className="flex items-center gap-2">
                  <img
                    src={featuredPost.author.avatar}
                    alt={featuredPost.author.name}
                    className="w-6 h-6 rounded-full object-cover border border-[#EAE6DF]"
                  />
                  <div>
                    <span className="text-xs font-bold text-stone-800">{featuredPost.author.name}</span>
                    <span className="text-[10px] text-stone-400 block -mt-0.5">{featuredPost.author.role}</span>
                  </div>
                </div>
              ) : (
                <span className="text-xs font-semibold text-stone-700">Mizodeals Editorial</span>
              )}

              <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 group-hover:text-orange-700 group-hover:translate-x-0.5 transition-transform">
                <span>Read Full Guide</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </Link>
        </div>

        {/* Right Column: 3 Stacked News Articles with Thumbnails */}
        <div className="md:col-span-5 lg:col-span-4 flex flex-col justify-between gap-3">
          {sidebarPosts.map((post) => (
            <Link
              key={post.id}
              to="/blog/$slug"
              params={{ slug: post.slug }}
              className="group bg-[#FAF9F5] hover:bg-white border border-[#EAE6DF] hover:border-orange-300 rounded-2xl p-3 sm:p-3.5 transition-all shadow-2xs hover:shadow-md flex items-center gap-3.5 cursor-pointer flex-1"
            >
              {/* Thumbnail */}
              <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden bg-stone-200 border border-[#EAE6DF]/80 shrink-0">
                <img
                  src={post.coverImage}
                  alt={post.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-600 uppercase tracking-wide mb-1">
                  <span>{post.category}</span>
                  <span className="text-stone-300 font-normal">•</span>
                  <span className="text-stone-400 font-medium normal-case">{post.readTime}</span>
                </div>

                <h4 className="text-xs sm:text-sm font-bold text-stone-900 group-hover:text-orange-600 transition-colors line-clamp-2 leading-snug">
                  {post.title}
                </h4>

                <div className="flex items-center justify-between text-[11px] text-stone-400 mt-1.5">
                  <span>{post.publishedAt}</span>
                  <ArrowRight className="w-3 h-3 text-stone-400 group-hover:text-orange-600 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 2. MOBILE VIEW: Portrait Ratio Swipeable Carousel */}
      <div className="block md:hidden">
        <div className="overflow-x-auto flex gap-3.5 pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 scrollbar-none snap-x snap-mandatory">
          {blogs.map((post, idx) => (
            <Link
              key={post.id}
              to="/blog/$slug"
              params={{ slug: post.slug }}
              className="w-[72vw] max-w-[280px] shrink-0 snap-start block group cursor-pointer"
            >
              <div className="relative rounded-2xl overflow-hidden border border-[#EAE6DF] shadow-xs group aspect-4/5 flex flex-col justify-between p-4 bg-stone-900">
                {/* Full Portrait Background Image */}
                <img
                  src={post.coverImage}
                  alt={post.title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Dark Gradient Overlay for Contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/95 via-stone-950/50 to-stone-950/20" />

                {/* Top Badges */}
                <div className="relative z-10 flex items-center justify-between gap-1">
                  <span className="inline-flex items-center bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/10">
                    {post.category}
                  </span>

                  {idx === 0 ? (
                    <span className="bg-orange-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow-2xs">
                      LATEST
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-stone-900/70 backdrop-blur-xs text-stone-300 text-[10px] font-medium px-2 py-0.5 rounded-md">
                      <Clock className="w-2.5 h-2.5" />
                      {post.readTime}
                    </span>
                  )}
                </div>

                {/* Bottom Text Content */}
                <div className="relative z-10">
                  <p className="text-[10px] font-medium text-stone-300 mb-1">
                    {post.publishedAt}
                  </p>

                  <h4 className="text-sm font-bold text-white leading-snug line-clamp-2 drop-shadow-xs group-hover:text-orange-300 transition-colors">
                    {post.title}
                  </h4>

                  <p className="text-[11px] text-stone-300 line-clamp-2 mt-1 leading-snug">
                    {post.summary}
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-white/15 flex items-center justify-between text-xs font-bold text-orange-400 group-hover:text-orange-300">
                    <span>Read Guide</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Mobile Swipe Helper Hint */}
        <div className="flex items-center justify-between mt-2.5 text-[11px] text-stone-500">
          <span className="flex items-center gap-1 font-medium">
            <span>Swipe for more guides 👉</span>
          </span>
          <Link to="/blog" className="font-bold text-orange-600 hover:text-orange-700">
            View All ({blogs.length}) →
          </Link>
        </div>
      </div>
    </div>
  );
};

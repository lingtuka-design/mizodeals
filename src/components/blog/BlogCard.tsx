import React from 'react';
import { Link } from '@tanstack/react-router';
import { Clock, ArrowRight, Tag } from 'lucide-react';
import type { BlogPost } from '../../types';

interface BlogCardProps {
  post: BlogPost;
}

export const BlogCard: React.FC<BlogCardProps> = ({ post }) => {
  return (
    <article className="group bg-white border border-[#EAE6DF] hover:border-stone-300 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      <div>
        {/* Cover Image */}
        <Link to="/blog/$slug" params={{ slug: post.slug }} className="block relative aspect-16/9 overflow-hidden bg-[#FAF9F5]">
          <img
            src={post.coverImage}
            alt={post.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute top-3 left-3">
            <span className="bg-stone-900/80 backdrop-blur-xs text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg">
              {post.category}
            </span>
          </div>
          {post.featuredDealIds.length > 0 && (
            <div className="absolute bottom-3 right-3">
              <span className="bg-amber-500/90 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                <Tag className="w-3 h-3" />
                {post.featuredDealIds.length} Verified Deals
              </span>
            </div>
          )}
        </Link>

        {/* Content Details */}
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-3 text-xs text-stone-500 mb-2">
            <span>{post.publishedAt}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-stone-400" />
              {post.readTime}
            </span>
          </div>

          <Link to="/blog/$slug" params={{ slug: post.slug }}>
            <h3 className="text-base sm:text-lg font-bold text-stone-900 leading-snug group-hover:text-orange-600 transition-colors line-clamp-2">
              {post.title}
            </h3>
          </Link>

          <p className="text-xs sm:text-sm text-stone-600 mt-2 line-clamp-2 leading-relaxed">
            {post.summary}
          </p>
        </div>
      </div>

      {/* Author and Read More */}
      <div className="p-4 sm:p-5 pt-0 border-t border-[#EAE6DF]/60 mt-2 flex items-center justify-between">
        {post.author ? (
          <div className="flex items-center gap-2">
            <img
              src={post.author.avatar}
              alt={post.author.name}
              className="w-6 h-6 rounded-full object-cover border border-stone-200"
            />
            <span className="text-xs font-semibold text-stone-700">{post.author.name}</span>
          </div>
        ) : (
          <span className="text-xs font-semibold text-stone-700">Mizodeals Editorial</span>
        )}

        <Link
          to="/blog/$slug"
          params={{ slug: post.slug }}
          className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 group-hover:text-orange-700 transition-colors"
        >
          <span>Read Guide</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </article>
  );
};

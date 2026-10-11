import React from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { useData } from '../context/DataContext';
import { EmbeddedDealCard } from '../components/blog/EmbeddedDealCard';
import { ArrowLeft, Clock, Share2, Sparkles, MessageCircle } from 'lucide-react';
import { useToast } from '../components/common/Toast';
import { copyTextToClipboard } from '../utils/formatters';

export const BlogDetailView: React.FC = () => {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const { blogs, deals } = useData();
  const { showToast } = useToast();

  const post = blogs.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-stone-900 mb-2">Buying Guide Not Found</h2>
        <p className="text-sm text-stone-500 mb-6">The guide you are looking for does not exist or has been moved.</p>
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-xl hover:bg-stone-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Guides</span>
        </Link>
      </div>
    );
  }

  // Find embedded deals
  const featuredDeals = deals.filter((d) => post.featuredDealIds.includes(d.id));

  const handleShareArticle = async () => {
    const text = `📖 *${post.title}*\n\nCheck out this tested buying guide for Mizoram on Mizodeals:\n${window.location.href}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async () => {
    const success = await copyTextToClipboard(window.location.href);
    if (success) showToast('Article link copied to clipboard!', 'success');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Buying Guides</span>
        </Link>
      </div>

      {/* Article Header */}
      <article className="bg-white border border-[#EAE6DF] rounded-3xl p-6 sm:p-10 shadow-xs space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-full">
              {post.category}
            </span>
            <span className="text-xs text-stone-400">•</span>
            <span className="text-xs text-stone-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-stone-400" />
              {post.readTime}
            </span>
            <span className="text-xs text-stone-400">•</span>
            <span className="text-xs text-stone-500">{post.publishedAt}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-stone-900 leading-tight tracking-tight">
            {post.title}
          </h1>

          <p className="text-sm sm:text-base text-stone-600 mt-4 leading-relaxed font-medium">
            {post.summary}
          </p>

          {/* Author profile and share action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 pt-6 border-t border-[#EAE6DF]">
            {post.author && (
              <div className="flex items-center gap-3">
                <img
                  src={post.author.avatar}
                  alt={post.author.name}
                  className="w-10 h-10 rounded-full object-cover border border-stone-200"
                />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-stone-900">{post.author.name}</h4>
                  <p className="text-[11px] text-stone-500">{post.author.role}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShareArticle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-semibold text-xs rounded-xl border border-[#25D366]/30 transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
                <span>Share Guide on WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs rounded-xl border border-[#EAE6DF] transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Copy Link</span>
              </button>
            </div>
          </div>
        </div>

        {/* Cover image */}
        <div className="relative aspect-16/9 rounded-2xl overflow-hidden bg-[#FAF9F5] border border-[#EAE6DF]">
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Article Body */}
        <div className="prose prose-stone max-w-none text-stone-700 text-sm sm:text-base leading-relaxed space-y-4">
          {post.content.split('\n\n').map((paragraph, index) => {
            const trimmed = paragraph.trim();
            if (!trimmed) return null;
            if (trimmed.startsWith('### ')) {
              return (
                <h3 key={index} className="text-lg sm:text-xl font-bold text-stone-900 mt-6 mb-2">
                  {trimmed.replace('### ', '')}
                </h3>
              );
            }
            if (trimmed.startsWith('#### ')) {
              return (
                <h4 key={index} className="text-base font-bold text-stone-900 mt-4 mb-2">
                  {trimmed.replace('#### ', '')}
                </h4>
              );
            }
            return (
              <p key={index} className="text-stone-700 leading-relaxed">
                {trimmed}
              </p>
            );
          })}
        </div>

        {/* Embedded Featured Deals Section */}
        {featuredDeals.length > 0 && (
          <div className="mt-8 pt-8 border-t border-[#EAE6DF]">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-orange-600" />
              <h3 className="text-base font-bold text-stone-900">
                Top Deals Recommended in this Guide
              </h3>
            </div>
            <div className="space-y-4">
              {featuredDeals.map((deal) => (
                <EmbeddedDealCard key={deal.id} deal={deal} />
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
};

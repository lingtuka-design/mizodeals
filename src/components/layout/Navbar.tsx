import React from 'react';
import { Link } from '@tanstack/react-router';
import { Flame, Heart, BookOpen, MessageCircle, Sparkles, MapPin } from 'lucide-react';
import { SITE_NAME, WHATSAPP_CHANNEL_URL } from '../../config/constants';

interface NavbarProps {
  savedCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ savedCount = 0 }) => {
  return (
    <header className="sticky top-0 z-40 bg-[#FAF9F5]/90 backdrop-blur-md border-b border-[#EAE6DF] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-stone-900 group-hover:bg-orange-600 transition-colors flex items-center justify-center text-white shadow-xs">
            <Flame className="w-5 h-5 fill-amber-400 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black tracking-tight text-stone-900 group-hover:text-orange-600 transition-colors">
                {SITE_NAME}
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-stone-200/80 text-stone-700">
                <MapPin className="w-2.5 h-2.5 text-stone-500" />
                MZ
              </span>
            </div>
            <span className="text-[10px] text-stone-500 font-medium block leading-none">
              Curated Amazon Deals
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-semibold text-stone-700">
          <Link
            to="/"
            className="px-3.5 py-2 rounded-xl hover:bg-stone-200/60 transition-colors flex items-center gap-1.5"
            activeProps={{ className: 'bg-stone-200/90 text-stone-900' }}
          >
            <Sparkles className="w-4 h-4 text-orange-600" />
            <span>Deals</span>
          </Link>

          <Link
            to="/blog"
            className="px-3.5 py-2 rounded-xl hover:bg-stone-200/60 transition-colors flex items-center gap-1.5"
            activeProps={{ className: 'bg-stone-200/90 text-stone-900' }}
          >
            <BookOpen className="w-4 h-4 text-stone-500" />
            <span>Buying Guides</span>
          </Link>

          <Link
            to="/saved"
            className="px-3.5 py-2 rounded-xl hover:bg-stone-200/60 transition-colors flex items-center gap-1.5 relative"
            activeProps={{ className: 'bg-stone-200/90 text-stone-900' }}
          >
            <Heart className="w-4 h-4 text-rose-500" />
            <span>Saved Deals</span>
            {savedCount > 0 && (
              <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500 text-white">
                {savedCount}
              </span>
            )}
          </Link>

          <Link
            to="/admin"
            className="px-3.5 py-2 rounded-xl hover:bg-stone-200/60 transition-colors flex items-center gap-1.5 text-stone-500 hover:text-stone-900"
            activeProps={{ className: 'bg-stone-200/90 text-stone-900' }}
          >
            <span>Admin</span>
          </Link>
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-2">
          {/* Saved shortcut on mobile */}
          <Link
            to="/saved"
            className="md:hidden p-2 rounded-xl bg-white border border-[#EAE6DF] text-stone-700 relative hover:bg-stone-50"
            aria-label="View Saved Deals"
          >
            <Heart className="w-4 h-4 text-rose-500" />
            {savedCount > 0 && (
              <span className="absolute -top-1 -right-1 text-[10px] font-bold w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center">
                {savedCount}
              </span>
            )}
          </Link>

          {/* WhatsApp Channel Direct CTA */}
          <a
            href={WHATSAPP_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-stone-950 font-bold text-xs rounded-xl shadow-2xs transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Join WhatsApp VIP</span>
            <span className="sm:hidden">WhatsApp</span>
          </a>
        </div>
      </div>
    </header>
  );
};

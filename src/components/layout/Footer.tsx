import React from 'react';
import { Link } from '@tanstack/react-router';
import { ShieldCheck, Heart, ExternalLink, MapPin } from 'lucide-react';
import { AFFILIATE_TAG, SITE_NAME, WHATSAPP_CHANNEL_URL, FACEBOOK_PAGE_URL } from '../../config/constants';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-16 bg-[#F2EFE9] border-t border-[#EAE6DF] pb-20 md:pb-12 pt-12 text-stone-600 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo-icon.png"
                alt="Mizodeals icon"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain shadow-2xs"
              />
              <img
                src="/logo.png"
                alt={SITE_NAME}
                className="h-7.5 sm:h-8.5 w-auto object-contain"
              />
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5" /> Mizoram Edition
              </span>
            </div>
            <p className="text-xs text-stone-600 max-w-md leading-relaxed">
              Amazon, Flipkart, Myntra, Nykaa &amp; Ajio deal ṭha ber ber, man tlahniam zawn hmuhna, leh Mizoram mipui tana online shopping kaihhruaina.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified Amazon Associates Tag: {AFFILIATE_TAG}
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-stone-900 mb-3 text-xs uppercase tracking-wider">
              Browse Deals
            </h4>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="hover:text-stone-900 transition-colors">
                  All Today's Deals
                </Link>
              </li>
              <li>
                <Link to="/blog" className="hover:text-stone-900 transition-colors">
                  Buying Guides & Reviews
                </Link>
              </li>
              <li>
                <Link to="/saved" className="hover:text-stone-900 transition-colors">
                  My Bookmarked Deals
                </Link>
              </li>
              <li>
                <a
                  href={WHATSAPP_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#128C7E] flex items-center gap-1"
                >
                  <span>VIP WhatsApp Alerts</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href={FACEBOOK_PAGE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#1877F2] flex items-center gap-1"
                >
                  <span>Facebook Page</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>

          {/* Northeast Shopping Tips */}
          <div>
            <h4 className="font-bold text-stone-900 mb-3 text-xs uppercase tracking-wider">
              Mizoram Shopper Tips
            </h4>
            <ul className="space-y-1.5 text-[11px] text-stone-500 leading-normal">
              <li>• Always verify Amazon Prime pin code availability for 3-5 day delivery to Mizoram.</li>
              <li>• Grab loot deals quickly; high discounts (&gt;50%) often expire within 4-12 hours.</li>
              <li>• Share directly to WhatsApp family & friends groups before stocks deplete.</li>
            </ul>
          </div>
        </div>

        {/* Affiliate Disclosure & Legal Notice */}
        <div className="pt-6 border-t border-[#EAE6DF] space-y-3">
          <div className="p-3 bg-white/70 rounded-xl border border-[#EAE6DF] text-[11px] text-stone-500 leading-relaxed">
            <strong className="text-stone-700">Affiliate Disclosure:</strong> {SITE_NAME} is an independent deal aggregator and a participant in the Amazon Associates Programme, an affiliate advertising program designed to provide a means for sites to earn advertising fees by advertising and linking to Amazon.in. When you purchase through our links, we may earn an affiliate commission at absolutely no additional cost to you. Product prices and availability are accurate as of the time indicated and are subject to change by merchants.
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-stone-400">
            <span>© {new Date().getFullYear()} {SITE_NAME}. Made with care for shoppers in Mizoram.</span>
            <div className="flex items-center gap-1">
              <span>Curated with</span>
              <Heart className="w-3 h-3 text-rose-500 fill-rose-500 inline" />
              <span>in Mizoram, India</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

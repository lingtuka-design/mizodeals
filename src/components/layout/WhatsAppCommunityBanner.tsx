import React, { useState } from 'react';
import { MessageCircle, ArrowRight, X, Users, Flame } from 'lucide-react';
import { WHATSAPP_CHANNEL_URL, WHATSAPP_COMMUNITY_MEMBERS } from '../../config/constants';

export const WhatsAppCommunityBanner: React.FC = () => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  return (
    <div className="bg-[#FAF9F5] border-b border-[#EAE6DF] px-4 py-2.5 sm:py-3">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 text-center sm:text-left">
          <div className="w-8 h-8 rounded-full bg-[#25D366]/15 flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4 text-[#128C7E]" />
          </div>
          <div>
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <span className="text-xs font-bold text-stone-900 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-600 fill-orange-500" />
                Mizodeals VIP WhatsApp Channel
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.2 rounded-full">
                <Users className="w-3 h-3" />
                {WHATSAPP_COMMUNITY_MEMBERS} Mizoram Shoppers
              </span>
            </div>
            <p className="text-[11px] text-stone-600 line-clamp-1">
              Get flash loot deals & price glitch alerts delivered straight to WhatsApp before stocks finish!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={WHATSAPP_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-stone-900 font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            <span>Join WhatsApp Channel</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="text-stone-400 hover:text-stone-600 p-1 rounded-lg transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

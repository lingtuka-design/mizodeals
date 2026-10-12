import React, { useState } from 'react';
import { MessageCircle, ArrowRight, X, Users, Flame } from 'lucide-react';
import { WHATSAPP_CHANNEL_URL, WHATSAPP_COMMUNITY_MEMBERS } from '../../config/constants';

export const WhatsAppCommunityBanner: React.FC = () => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  return (
    <div className="bg-[#FAF9F5] border-b border-[#EAE6DF] px-3 sm:px-4 py-1.5 sm:py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#25D366]/15 flex items-center justify-center shrink-0">
            <MessageCircle className="w-3.5 h-3.5 text-[#128C7E]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-stone-900 truncate flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-600 fill-orange-500 shrink-0" />
                <span>Mizodeals VIP WhatsApp</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.2 rounded-full">
                <Users className="w-3 h-3" />
                {WHATSAPP_COMMUNITY_MEMBERS} Shoppers
              </span>
            </div>
            <p className="hidden md:block text-[11px] text-stone-600 truncate">
              Get flash loot deals & price glitch alerts delivered straight to WhatsApp before stocks finish!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href={WHATSAPP_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-stone-900 font-bold text-[11px] sm:text-xs rounded-lg sm:rounded-xl shadow-xs transition-colors"
          >
            <span>Join</span>
            <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
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

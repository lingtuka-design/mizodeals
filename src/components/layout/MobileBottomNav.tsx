import React from 'react';
import { Link } from '@tanstack/react-router';
import { Sparkles, BookOpen, Heart, MessageCircle } from 'lucide-react';
import { WHATSAPP_CHANNEL_URL } from '../../config/constants';

interface MobileBottomNavProps {
  savedCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ savedCount = 0 }) => {
  // Automatically hide bottom navigation when virtual keyboard opens / user is typing in an input
  const [isInputFocused, setIsInputFocused] = React.useState(false);

  React.useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        setIsInputFocused(true);
      }
    };

    const handleFocusOut = () => {
      setIsInputFocused(false);
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);
    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  if (isInputFocused) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#EAE6DF] pb-safe pt-1 shadow-lg">
      <div className="grid grid-cols-4 items-center h-14">
        {/* Deals */}
        <Link
          to="/"
          className="flex flex-col items-center justify-center gap-0.5 text-stone-600 hover:text-stone-900 transition-colors py-1"
          activeProps={{ className: 'text-orange-600 font-bold' }}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] font-medium">Deals</span>
        </Link>

        {/* Guides */}
        <Link
          to="/blog"
          className="flex flex-col items-center justify-center gap-0.5 text-stone-600 hover:text-stone-900 transition-colors py-1"
          activeProps={{ className: 'text-orange-600 font-bold' }}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] font-medium">Guides</span>
        </Link>

        {/* Saved */}
        <Link
          to="/saved"
          className="flex flex-col items-center justify-center gap-0.5 text-stone-600 hover:text-stone-900 transition-colors py-1 relative"
          activeProps={{ className: 'text-orange-600 font-bold' }}
        >
          <div className="relative">
            <Heart className="w-5 h-5" />
            {savedCount > 0 && (
              <span className="absolute -top-1 -right-2 text-[9px] font-bold w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center">
                {savedCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">Saved</span>
        </Link>

        {/* WhatsApp Channel */}
        <a
          href={WHATSAPP_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center gap-0.5 text-[#128C7E] hover:text-[#075E54] transition-colors py-1"
        >
          <MessageCircle className="w-5 h-5 text-[#25D366]" />
          <span className="text-[10px] font-bold">Alerts</span>
        </a>
      </div>
    </div>
  );
};

import React from 'react';
import { Outlet, useLocation } from '@tanstack/react-router';
import { Navbar } from '../components/layout/Navbar';
import { MobileBottomNav } from '../components/layout/MobileBottomNav';
import { Footer } from '../components/layout/Footer';
import { WhatsAppCommunityBanner } from '../components/layout/WhatsAppCommunityBanner';
import { useBookmarks } from '../hooks/useBookmarks';

export const RootLayout: React.FC = () => {
  const { savedCount } = useBookmarks();
  const location = useLocation();

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hostname.endsWith('pages.dev')) {
        window.location.replace(`https://mizodeals.com${window.location.pathname}${window.location.search}`);
        return;
      }

      // Non-blocking privacy-friendly page view tracking
      try {
        const payload = JSON.stringify({
          path: location.pathname,
          referrer: document.referrer || 'Direct',
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
        } else {
          fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch (e) {}
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F5] text-stone-800 selection:bg-orange-100 selection:text-orange-900">
      <WhatsAppCommunityBanner />
      <Navbar savedCount={savedCount} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <MobileBottomNav savedCount={savedCount} />
    </div>
  );
};

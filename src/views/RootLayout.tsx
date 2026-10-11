import React from 'react';
import { Outlet } from '@tanstack/react-router';
import { Navbar } from '../components/layout/Navbar';
import { MobileBottomNav } from '../components/layout/MobileBottomNav';
import { Footer } from '../components/layout/Footer';
import { WhatsAppCommunityBanner } from '../components/layout/WhatsAppCommunityBanner';
import { useBookmarks } from '../hooks/useBookmarks';

export const RootLayout: React.FC = () => {
  const { savedCount } = useBookmarks();

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

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'mizodeals_saved_deals';

export function useBookmarks() {
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedIds));
    } catch (e) {
      console.error('Failed to save bookmarks to localStorage', e);
    }
  }, [savedIds]);

  const toggleBookmark = useCallback((id: string) => {
    setSavedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  const isBookmarked = useCallback(
    (id: string) => savedIds.includes(id),
    [savedIds]
  );

  return {
    savedIds,
    toggleBookmark,
    isBookmarked,
    savedCount: savedIds.length,
  };
}

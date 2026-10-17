import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { RootLayout } from './views/RootLayout';
import { HomeView } from './views/HomeView';
import { BlogListView } from './views/BlogListView';
import { BlogDetailView } from './views/BlogDetailView';
import { DealDetailView } from './views/DealDetailView';
import { SavedDealsView } from './views/SavedDealsView';
import { AdminView } from './views/AdminView';
import type { DealCategory, DealsFilterParams } from './types';

// Root Route
const rootRoute = createRootRoute({
  component: RootLayout,
});

// Home Route with search param validation
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): DealsFilterParams => {
    const result: DealsFilterParams = {};
    if (search.category && search.category !== 'all') {
      result.category = search.category as DealCategory;
    }
    if (typeof search.search === 'string' && search.search.trim()) {
      result.search = search.search.trim();
    }
    if (search.sort && search.sort !== 'newest') {
      result.sort = search.sort as DealsFilterParams['sort'];
    }
    if (search.lootOnly === true || search.lootOnly === 'true') {
      result.lootOnly = true;
    }
    if (search.tab && search.tab !== 'all') {
      result.tab = search.tab as DealsFilterParams['tab'];
    }
    if (search.priceRange && search.priceRange !== 'all') {
      result.priceRange = search.priceRange as DealsFilterParams['priceRange'];
    }
    return result;
  },
  component: HomeView,
});

// Blog List Route
const blogIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/blog',
  component: BlogListView,
});

// Blog Detail Route
const blogDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/blog/$slug',
  component: BlogDetailView,
});

// Standalone Deal Detail Route
const dealDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/deals/$id',
  component: DealDetailView,
});

// Saved Deals Route
const savedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/saved',
  component: SavedDealsView,
});

// Admin Route
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminView,
});

// Create Router Tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  blogIndexRoute,
  blogDetailRoute,
  dealDetailRoute,
  savedRoute,
  adminRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

// Register router instance for type-safety across the app
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

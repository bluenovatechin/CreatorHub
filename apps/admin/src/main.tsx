/**
 * ADMIN PANEL ENTRY POINT + ALL ADMIN PAGES (URL → page). Everything except /login needs a team login.
 * Menu items are hidden per team role in pages/Shell.tsx; the API enforces the same rules again.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { ApiError } from '@bluenova/ui';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/noto-sans-gujarati/400.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import './index.css';
import { AdminAuthProvider, RequireAdmin } from './lib';
import { AdminLayout } from './components/layout';
import { LoginPage } from './pages/auth';
import { DashboardPage } from './pages/dashboard';
import { CreatorsPage, CreatorDetailPage } from './pages/creators';
import { CampaignsPage, CampaignDetailPage } from './pages/campaigns';
import { UsersPage, UserDetailPage } from './pages/users';
import { PaymentsPage, SettingsPage } from './pages/finance';
import { AuditLogPage } from './pages/audit';
import { WorkReviewPage } from './pages/work';
import { InboxPage } from './pages/inbox';
import { TrustPage } from './pages/trust';
import { EmailLogPage } from './pages/emails';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      // Keep the panel up to date without pressing refresh: every open list/page reloads its data every 15 s
      // (only while the tab is visible) and as soon as you come back to the tab.
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAdmin><AdminLayout /></RequireAdmin>,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/creators', element: <CreatorsPage /> },
      { path: '/creators/:id', element: <CreatorDetailPage /> },
      { path: '/campaigns', element: <CampaignsPage /> },
      { path: '/campaigns/:id', element: <CampaignDetailPage /> },
      { path: '/deals', element: <WorkReviewPage /> },
      { path: '/inbox', element: <InboxPage /> },
      { path: '/trust', element: <TrustPage /> },
      { path: '/emails', element: <EmailLogPage /> },
      { path: '/users', element: <UsersPage /> },
      { path: '/users/:id', element: <UserDetailPage /> },
      { path: '/audit-logs', element: <AuditLogPage /> },
      { path: '/payments', element: <PaymentsPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '*', element: <p className="py-20 text-center">Page not found.</p> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <RouterProvider router={router} />
      </AdminAuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);

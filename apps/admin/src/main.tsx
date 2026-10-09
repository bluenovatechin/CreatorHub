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
import { AdminLayout, LoginPage } from './pages/Shell';
import { AuditLogPage, CampaignDetailPage, CampaignsPage, CreatorDetailPage, CreatorsPage, DashboardPage } from './pages/Pages';
import { PaymentsPage, SettingsPage } from './pages/Finance';
import { UserDetailPage, UsersPage } from './pages/Users';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
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

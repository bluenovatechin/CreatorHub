/**
 * ALL WEBSITE PAGES (URL → page component). Guards decide who may open a page:
 *   GuestOnly        logged-in people are sent to their area (e.g. /login while logged in → dashboard)
 *   RequireSignedIn  must be logged in (else → /login?next=...)
 *   RequireRole      must be a creator (or brand); others are sent to their own home
 * Page-by-page flow: docs/FLOWS.md.
 */
import type { ReactNode } from 'react';
import { Navigate, createBrowserRouter, useLocation } from 'react-router-dom';
import { Loading } from '@bluenova/ui';
import { GuestOnly, RequireRole, homePathFor, useAuth } from './lib/auth';
import { AppLayout, PublicLayout } from './components/layout';
import { HomePage } from './pages/home';
import { ForCreatorsPage } from './pages/for-creators';
import { ForBrandsPage } from './pages/for-brands';
import { NotFoundPage } from './pages/not-found';
import { PrivacyPage, TermsPage } from './pages/legal';
import { HowItWorksPage } from './pages/how-it-works';
import { PricingPage } from './pages/pricing';
import { FaqPage } from './pages/faq';
import { ContactPage } from './pages/contact';

import {
  LoginPage,
  SignupPage,
  GoogleCallbackPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  RoleSelectPage,
} from './pages/auth';

import {
  CreatorDashboard,
  CreatorOnboarding,
  CreatorStatusPage,
  IntroReelPage,
  OpportunitiesPage,
  OffersPage,
  OfferDetailPage,
  CreatorDealsPage,
  CreatorDealDetailPage,
  CreatorProfilePage,
} from './pages/creator';

import {
  BrandDashboard,
  BrandOnboardingPage,
  CampaignsPage,
  CampaignWizard,
  CampaignDetailPage,
  PaymentPage,
  BrandDealsPage,
  BrandDealDetailPage,
} from './pages/brand';

import { NotificationsPage } from './pages/notifications';
import { MessagesPage } from './pages/messages';
import { SettingsPage } from './pages/settings';

function RequireSignedIn({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return <>{children}</>;
}

/** /creator and /brand landing: send each user to the right step for their current status. */
function AreaHome({ area, children }: { area: 'creator' | 'brand'; children: ReactNode }) {
  const { me } = useAuth();
  if (!me) return null;
  const target = homePathFor(me);
  if (target !== `/${area}`) return <Navigate to={target} replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/for-creators', element: <ForCreatorsPage /> },
      { path: '/for-brands', element: <ForBrandsPage /> },
      { path: '/how-it-works', element: <HowItWorksPage /> },
      { path: '/pricing', element: <PricingPage /> },
      { path: '/faq', element: <FaqPage /> },
      { path: '/contact', element: <ContactPage /> },
      { path: '/privacy', element: <PrivacyPage /> },
      { path: '/terms', element: <TermsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  // Auth screens use their own split-screen layout.
  { path: '/login', element: <GuestOnly><LoginPage /></GuestOnly> },
  { path: '/signup', element: <GuestOnly><SignupPage /></GuestOnly> },
  // Email verification now uses a 6-digit code on the signup/login page; old links go to login.
  { path: '/check-email', element: <Navigate to="/login" replace /> },
  { path: '/verify-email', element: <Navigate to="/login" replace /> },
  // Google sends people back here after "Continue with Google" (must match Google Cloud → Authorized redirect URIs).
  { path: '/auth/google/callback', element: <GoogleCallbackPage /> },
  { path: '/forgot-password', element: <GuestOnly><ForgotPasswordPage /></GuestOnly> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/welcome/role', element: <RequireSignedIn><RoleSelectPage /></RequireSignedIn> },
  // Old shared links keep working. (The creator/brand choice now happens after login, on /welcome/role.)
  { path: '/join/creator', element: <Navigate to="/signup" replace /> },
  { path: '/join/brand', element: <Navigate to="/signup" replace /> },
  {
    path: '/creator',
    element: <RequireRole role="creator"><AppLayout area="creator" /></RequireRole>,
    children: [
      { index: true, element: <AreaHome area="creator"><CreatorDashboard /></AreaHome> },
      { path: 'onboarding/:step', element: <CreatorOnboarding /> },
      { path: 'status', element: <CreatorStatusPage /> },
      { path: 'intro-reel', element: <IntroReelPage /> },
      { path: 'opportunities', element: <OpportunitiesPage /> },
      { path: 'offers', element: <OffersPage /> },
      { path: 'offers/:id', element: <OfferDetailPage /> },
      { path: 'deals', element: <CreatorDealsPage /> },
      { path: 'deals/:id', element: <CreatorDealDetailPage /> },
      { path: 'profile', element: <CreatorProfilePage /> },
      { path: 'messages', element: <MessagesPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/brand',
    element: <RequireRole role="brand"><AppLayout area="brand" /></RequireRole>,
    children: [
      { index: true, element: <AreaHome area="brand"><BrandDashboard /></AreaHome> },
      { path: 'onboarding', element: <BrandOnboardingPage /> },
      { path: 'campaigns', element: <CampaignsPage /> },
      { path: 'campaigns/new', element: <CampaignWizard /> },
      { path: 'campaigns/:id', element: <CampaignDetailPage /> },
      { path: 'campaigns/:id/payment', element: <PaymentPage /> },
      { path: 'campaigns/:id/edit/:step', element: <CampaignWizard /> },
      { path: 'deals', element: <BrandDealsPage /> },
      { path: 'deals/:id', element: <BrandDealDetailPage /> },
      { path: 'messages', element: <MessagesPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);


/**
 * SEO BASICS for a single-page app: each page sets its own <title>, meta description, Open Graph tags (link
 * previews on WhatsApp/Facebook), canonical URL and the page language. Private areas (creator/brand dashboards,
 * login screens) are marked "noindex" so search engines never list them.
 * Used by every public page (usePageMeta) and by AppLayout (noindex). Static files: public/robots.txt, sitemap.xml.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const SITE = 'Bluenova Creator Hub';

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Sets the page's title/description (already translated) and whether search engines may list it. */
export function usePageMeta({ title, description, index = true }: { title?: string; description?: string; index?: boolean }) {
  const { i18n } = useTranslation();
  useEffect(() => {
    const full = title ? `${title} · ${SITE}` : SITE;
    document.title = full;
    document.documentElement.lang = i18n.language === 'en' ? 'en' : 'gu';
    setMeta('name', 'robots', index ? 'index, follow' : 'noindex, nofollow');
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
    }
    setMeta('property', 'og:title', full);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:site_name', SITE);
    const url = `${window.location.origin}${window.location.pathname}`;
    setMeta('property', 'og:url', url);
    setCanonical(url);
  }, [title, description, index, i18n.language]);
}

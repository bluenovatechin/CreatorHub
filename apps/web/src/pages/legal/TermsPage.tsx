/**
 * TERMS OF USE (/terms)
 */
import { TERMS } from './legalData';
import { LegalPageView } from './LegalPageView';
import './TermsPage.css';

export function TermsPage() {
  return (
    <div className="terms-page">
      <LegalPageView
        titleEn="Terms of Use"
        titleGu="ઉપયોગની શરતો (Terms of Use)"
        kind="terms"
        sections={TERMS}
      />
    </div>
  );
}

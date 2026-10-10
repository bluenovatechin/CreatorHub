/**
 * PRIVACY POLICY (/privacy)
 */
import { PRIVACY } from './legalData';
import { LegalPageView } from './LegalPageView';
import './PrivacyPage.css';

export function PrivacyPage() {
  return (
    <div className="privacy-page">
      <LegalPageView
        titleEn="Privacy Policy"
        titleGu="પ્રાઇવસી પોલિસી (Privacy Policy)"
        kind="privacy"
        sections={PRIVACY}
      />
    </div>
  );
}

import Link from 'next/link';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { siteConfig } from '@/data/site';
import { getStrings } from '@/lib/i18n';
import styles from './ContactInfo.module.css';

const { contact, contactPage } = siteConfig;

const socialLinks = [
  contact.instagram && { label: 'Instagram', href: contact.instagram },
  contact.tiktok    && { label: 'TikTok',    href: contact.tiktok    },
  contact.linkedin  && { label: 'LinkedIn',  href: contact.linkedin  },
].filter(Boolean);

export default function ContactInfo({ locale = 'he' }) {
  const t = getStrings(locale).contact.info;
  const isEnglish = locale === 'en';
  const directTitle = isEnglish ? contactPage.directTitleEn : contactPage.directTitle;
  const address = isEnglish ? (contact.addressEn || contact.address) : contact.address;

  return (
    <div className={styles.wrapper}>
      <ScrollReveal>
        <p className={styles.sectionLabel}>{directTitle}</p>
      </ScrollReveal>

      {/* Email */}
      <ScrollReveal delay={0.1}>
        <div className={styles.contactRow}>
          <p className={styles.contactRowLabel}>{t.emailLabel}</p>
          <Link
            href={`mailto:${contact.email}`}
            className={styles.contactRowValue}
            aria-label={`${t.emailAriaPrefix}${contact.email}`}
          >
            {contact.email}
          </Link>
        </div>
      </ScrollReveal>

      {/* Phone if provided */}
      {contact.phone && (
        <ScrollReveal delay={0.13}>
          <div className={styles.contactRow}>
            <p className={styles.contactRowLabel}>{t.phoneLabel}</p>
            <Link
              href={`tel:${contact.phone}`}
              className={styles.contactRowValue}
              dir="ltr"
              aria-label={`${t.phoneAriaPrefix}${contact.phone}`}
            >
              {contact.phone}
            </Link>
          </div>
        </ScrollReveal>
      )}

      {/* Location */}
      {contact.address && (
        <ScrollReveal delay={0.16}>
          <div className={styles.contactRow}>
            <p className={styles.contactRowLabel}>{t.locationLabel}</p>
            <p className={styles.contactRowValue}>{address}</p>
          </div>
        </ScrollReveal>
      )}

      {/* Social links */}
      {socialLinks.length > 0 && (
        <ScrollReveal delay={0.2}>
          <div className={styles.socialsGroup}>
            <p className={styles.contactRowLabel}>{t.followLabel}</p>
            <div className={styles.socialLinks}>
              {socialLinks.map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label={`${s.label} ${t.socialAriaSuffix}`}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
        </ScrollReveal>
      )}
    </div>
  );
}

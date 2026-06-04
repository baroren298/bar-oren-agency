import Link from 'next/link';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { siteConfig } from '@/data/site';
import styles from './ContactInfo.module.css';

const { contact, contactPage } = siteConfig;

const socialLinks = [
  contact.instagram && { label: 'Instagram', href: contact.instagram },
  contact.tiktok    && { label: 'TikTok',    href: contact.tiktok    },
  contact.linkedin  && { label: 'LinkedIn',  href: contact.linkedin  },
].filter(Boolean);

export default function ContactInfo() {
  return (
    <div className={styles.wrapper}>
      <ScrollReveal>
        <p className={styles.sectionLabel}>{contactPage.directTitle}</p>
      </ScrollReveal>

      {/* WhatsApp — primary action */}
      <ScrollReveal delay={0.06}>
        <Link
          href={contact.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.whatsappBtn}
          aria-label="פתח שיחת WhatsApp עם בר אורן"
        >
          WhatsApp
          <span className={styles.btnArrow} aria-hidden="true">←</span>
        </Link>
      </ScrollReveal>

      {/* Email */}
      <ScrollReveal delay={0.1}>
        <div className={styles.contactRow}>
          <p className={styles.contactRowLabel}>אימייל</p>
          <Link
            href={`mailto:${contact.email}`}
            className={styles.contactRowValue}
            aria-label={`שלח אימייל ל-${contact.email}`}
          >
            {contact.email}
          </Link>
        </div>
      </ScrollReveal>

      {/* Phone if provided */}
      {contact.phone && (
        <ScrollReveal delay={0.13}>
          <div className={styles.contactRow}>
            <p className={styles.contactRowLabel}>טלפון</p>
            <Link
              href={`tel:${contact.phone}`}
              className={styles.contactRowValue}
              dir="ltr"
              aria-label={`התקשר ל-${contact.phone}`}
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
            <p className={styles.contactRowLabel}>מיקום</p>
            <p className={styles.contactRowValue}>{contact.address}</p>
          </div>
        </ScrollReveal>
      )}

      {/* Social links */}
      {socialLinks.length > 0 && (
        <ScrollReveal delay={0.2}>
          <div className={styles.socialsGroup}>
            <p className={styles.contactRowLabel}>עקבו אחרינו</p>
            <div className={styles.socialLinks}>
              {socialLinks.map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label={`${s.label} — בר אורן`}
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

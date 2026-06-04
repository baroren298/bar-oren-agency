import ScrollReveal from '@/components/ui/ScrollReveal';
import { siteConfig } from '@/data/site';
import styles from './AgencyVoice.module.css';

export default function AgencyVoice() {
  const { voiceHeadline, voiceBody } = siteConfig.homepage;

  return (
    <section id="agency-voice" className={`${styles.section} section`} aria-label="אודות הסוכנות">
      <div className={`${styles.inner} container`}>
        <ScrollReveal>
          <p className={styles.headline}>{voiceHeadline}</p>
        </ScrollReveal>
        <ScrollReveal delay={0.12}>
          <p className={styles.body}>{voiceBody}</p>
        </ScrollReveal>
      </div>
    </section>
  );
}

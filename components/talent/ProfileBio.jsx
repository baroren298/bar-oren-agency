import ScrollReveal from '@/components/ui/ScrollReveal';
import styles from './ProfileBio.module.css';

export default function ProfileBio({ talent }) {
  if (!talent.bioHe) return null;

  return (
    <section className={`${styles.section} section`} aria-label="אודות">
      <div className={`${styles.inner} container`}>
        <ScrollReveal>
          <p className={styles.bio}>{talent.bioHe}</p>
        </ScrollReveal>
      </div>
    </section>
  );
}

import styles from "./loading.module.css";

const SKELETON_CARD_COUNT = 8;

export default function Loading() {
  return (
    <div className={styles.wrapper}>
      {/* Animated logo placeholder */}
      <div className={styles.logoPulse} />

      {/* Skeleton cards grid */}
      <div className={styles.grid}>
        {Array.from({ length: SKELETON_CARD_COUNT }).map((_, i) => (
          <div key={i} className={styles.card}>
            {/* Image skeleton */}
            <div
              className={`${styles.shimmer} ${styles.imageBlock}`}
              style={{ animationDelay: `${i * 0.1}s` }}
            />
            {/* Title skeleton */}
            <div
              className={`${styles.shimmer} ${styles.titleBlock}`}
              style={{ animationDelay: `${i * 0.1 + 0.1}s` }}
            />
            {/* Price skeleton */}
            <div
              className={`${styles.shimmer} ${styles.priceBlock}`}
              style={{ animationDelay: `${i * 0.1 + 0.2}s` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

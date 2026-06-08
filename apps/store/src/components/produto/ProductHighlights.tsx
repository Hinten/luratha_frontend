import styles from "./ProductHighlights.module.css";

interface ProductHighlightsProps {
  highlights: string[];
}

export default function ProductHighlights({ highlights }: ProductHighlightsProps) {
  if (highlights.length === 0) return null;

  return (
    <ul className={styles.list} aria-label="Destaques do produto">
      {highlights.map((item, i) => (
        <li key={i} className={styles.item}>
          <span className={styles.bullet} aria-hidden="true">
            ✦
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

import styles from "./ProductDescription.module.css";

interface ProductDescriptionProps {
  description: string;
}

export default function ProductDescription({ description }: ProductDescriptionProps) {
  return (
    <section aria-label="Descrição do produto" className={styles.section}>
      <h2 className={styles.title}>Descrição</h2>
      <p className={styles.text}>{description}</p>
    </section>
  );
}

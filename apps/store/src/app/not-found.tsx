import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={styles.wrapper}>
      {/* Decorative accent */}
      <div className={styles.accent} />

      <p className={styles.eyebrow}>Página não encontrada</p>

      <h1 className={styles.heading}>404</h1>

      <p className={styles.description}>
        A página que você procura não foi encontrada. Explore nossas peças e
        descubra algo especial.
      </p>

      <Link href="/" className={styles.btnPrimary}>
        Voltar para o início
      </Link>

      {/* Decorative accent bottom */}
      <div className={styles.accentSecondary} />
    </div>
  );
}


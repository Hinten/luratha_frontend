import Link from "next/link";
import type { Category } from "@/src/schemas/storefront";
import styles from "./CategoryBlock.module.css";

interface CategoryBlockProps {
  category: Category;
}

export default function CategoryBlock({ category }: CategoryBlockProps) {
  const { label, href, imageUrl } = category;

  return (
    <Link href={href} aria-label={label} className={styles.link}>
      <img
        src={imageUrl}
        alt=""
        role="presentation"
        loading="lazy"
        className={styles.image}
      />
      <div className={styles.overlay} />
      <span className={styles.label}>{label}</span>
    </Link>
  );
}

import Link from "next/link";
import type { Category } from "@/src/schemas/firestore/category";
import styles from "./CategoryBlock.module.css";

interface CategoryBlockProps {
  category: Category;
}

export default function CategoryBlock({ category }: CategoryBlockProps) {
  const label = category.name;
  const imageUrl = `https://placehold.co/600x700/EDE4D9/3A2F2A?text=${encodeURIComponent(category.name)}`;

  return (
    <Link href={`/categoria/${category.slug}`} aria-label={label} className={styles.link}>
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

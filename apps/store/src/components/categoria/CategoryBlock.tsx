import Link from "next/link";
import ImageWithFallback from "@/src/components/ImageWithFallback";
import type { Category } from "@luratha/schemas/category";
import styles from "./CategoryBlock.module.css";

interface CategoryBlockProps {
  category: Category;
}

export default function CategoryBlock({ category }: CategoryBlockProps) {
  const label = category.name;

  return (
    <Link href={`/categoria/${category.slug}`} aria-label={label} className={styles.link}>
      <ImageWithFallback
        src={null}
        alt=""
        role="presentation"
        fill
        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
        loading="lazy"
        className={styles.image}
      />
      <div className={styles.overlay} />
      <span className={styles.label}>{label}</span>
    </Link>
  );
}

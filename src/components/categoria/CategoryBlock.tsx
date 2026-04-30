import Image from "next/image";
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
      <Image
        src={imageUrl}
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

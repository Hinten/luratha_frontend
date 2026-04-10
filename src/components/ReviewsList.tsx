import type { Review } from "@/src/lib/types";
import styles from "./ReviewsList.module.css";

function StarRating({ rating }: { rating: number }) {
  return (
    <span className={styles.stars} aria-label={`${rating} de 5 estrelas`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={i < rating ? styles.starFilled : styles.starEmpty}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </span>
  );
}

interface ReviewsListProps {
  reviews: Review[];
}

export default function ReviewsList({ reviews }: ReviewsListProps) {
  if (reviews.length === 0) {
    return (
      <p className={styles.empty}>Esta peça ainda não possui avaliações.</p>
    );
  }

  const averageRating =
    reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <section aria-label="Avaliações do produto" className={styles.section}>
      <div className={styles.summary}>
        <span className={styles.averageScore}>{averageRating.toFixed(1)}</span>
        <StarRating rating={Math.round(averageRating)} />
        <span className={styles.reviewCount}>
          {reviews.length} {reviews.length === 1 ? "avaliação" : "avaliações"}
        </span>
      </div>

      <ul className={styles.list}>
        {reviews.map((review) => (
          <li key={review.id} className={styles.item}>
            <div className={styles.itemHeader}>
              <span className={styles.author}>{review.author}</span>
              <StarRating rating={review.rating} />
              <time
                dateTime={review.date}
                className={styles.date}
              >
                {new Date(review.date).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </time>
            </div>
            <p className={styles.comment}>{review.comment}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

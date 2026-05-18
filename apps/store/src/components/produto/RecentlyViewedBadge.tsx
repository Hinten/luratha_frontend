"use client";
import { useSyncExternalStore } from "react";
import { wasProductViewedRecently } from "@/src/hooks/useRecentlyViewed";
import styles from "./RecentlyViewedBadge.module.css";

// localStorage has no push notifications — the store never changes externally after mount
const noopSubscribe = () => () => {};

export default function RecentlyViewedBadge({ slug }: { slug: string }) {
  const viewed = useSyncExternalStore(
    noopSubscribe,
    () => wasProductViewedRecently(slug),
    () => false,
  );

  if (!viewed) return null;
  return <span className={styles.badge}>Visualizado</span>;
}

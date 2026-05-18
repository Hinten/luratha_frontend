"use client";
import { useEffect } from "react";
import { markProductViewed } from "@/src/hooks/useRecentlyViewed";

export default function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    markProductViewed(slug);
  }, [slug]);
  return null;
}

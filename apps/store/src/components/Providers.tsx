"use client";

import type { ReactNode } from "react";
import { CartProvider } from "@/src/contexts/CartContext";
import { AuthProvider } from "@/src/contexts/AuthContext";

/**
 * Client-side provider wrapper.
 * Import this in the Server Component layout so both CartProvider and
 * AuthProvider surround the entire component tree.
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/contexts/AuthContext";

/**
 * Logout page — calls logout() then immediately redirects to the homepage.
 * Navigate to /logout from any "Sair" link to trigger a clean sign-out.
 */
export default function LogoutPage() {
  const { logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await logout();
      } finally {
        if (!cancelled) router.push("/");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logout, router]);

  return (
    <main
      style={{
        minHeight: "40vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-body)",
        color: "var(--color-neutral-dark)",
      }}
    >
      <p>Saindo…</p>
    </main>
  );
}

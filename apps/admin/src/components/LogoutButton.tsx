"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getClientAuth } from "@luratha/firestore/firebaseClient";
import styles from "./LogoutButton.module.css";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await signOut(getClientAuth());
      await fetch("/api/auth/session", { method: "DELETE" });
    } finally {
      setLoading(false);
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleLogout} disabled={loading} className={styles.button}>
      {loading ? "Saindo…" : "Sair"}
    </button>
  );
}

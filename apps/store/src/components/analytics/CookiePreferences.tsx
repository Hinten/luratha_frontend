"use client";

import { useEffect, useState } from "react";
import {
  readConsentChoice,
  setConsentChoice,
  type ConsentChoice,
} from "@/src/lib/analytics/consent";
import styles from "./CookiePreferences.module.css";

/**
 * Controle de opt-out do Consent Mode v2 (modelo opt-out).
 *
 * A medição está ativa por padrão; aqui o visitante pode **recusar** análise e
 * anúncios (grava `denied` + dispara `consent update`) e **reverter** a
 * qualquer momento. A escolha persiste no `localStorage` e é reaplicada antes
 * das tags nas próximas visitas (script inline em `Analytics.tsx`).
 *
 * O estado só é lido após o mount para evitar divergência de hidratação (o
 * servidor não tem acesso ao `localStorage`).
 */
export default function CookiePreferences() {
  // "loading" = ainda não montou; só após o mount lemos o localStorage.
  const [choice, setChoice] = useState<ConsentChoice | "loading">("loading");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratação: o estado real (localStorage) só existe no cliente.
    setChoice(readConsentChoice());
  }, []);

  function handleChoice(next: "granted" | "denied") {
    setConsentChoice(next);
    setChoice(next);
  }

  const mounted = choice !== "loading";
  const optedOut = choice === "denied";

  return (
    <div className={styles.panel}>
      <p className={styles.status} role="status">
        {!mounted
          ? "Verificando sua preferência…"
          : optedOut
            ? "Você recusou os cookies de análise e anúncios. Nenhum dado de medição está sendo coletado."
            : "A medição de análise e anúncios está ativa. Você pode recusar a qualquer momento."}
      </p>

      <div className={styles.actions}>
        {optedOut ? (
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => handleChoice("granted")}
            disabled={!mounted}
          >
            Permitir análise e anúncios
          </button>
        ) : (
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => handleChoice("denied")}
            disabled={!mounted}
          >
            Recusar análise e anúncios
          </button>
        )}
      </div>
    </div>
  );
}

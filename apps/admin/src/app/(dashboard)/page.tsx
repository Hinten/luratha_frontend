import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Início",
};

export default function DashboardPage() {
  return (
    <div>
      <h1 className={styles.title}>Painel administrativo</h1>
      <p className={styles.lead}>
        Bem-vindo(a) ao Luratha Admin. As ferramentas operacionais aparecem aqui conforme são
        liberadas.
      </p>

      <ul className={styles.cards}>
        <li className={styles.card}>
          <h2 className={styles.cardTitle}>Configurações do site</h2>
          <p className={styles.cardText}>
            Edição de frete, frete grátis e tabela de tarifas — em breve.
          </p>
        </li>
        <li className={styles.card}>
          <h2 className={styles.cardTitle}>Catálogo</h2>
          <p className={styles.cardText}>
            Produtos, categorias, estoque e cupons — fase posterior.
          </p>
        </li>
        <li className={styles.card}>
          <h2 className={styles.cardTitle}>Pedidos</h2>
          <p className={styles.cardText}>
            Acompanhamento e rastreamento de pedidos — fase posterior.
          </p>
        </li>
      </ul>
    </div>
  );
}

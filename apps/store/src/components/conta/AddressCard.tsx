"use client";

import type { Address } from "@/src/schemas/firestore";
import styles from "./AddressCard.module.css";

interface Props {
  address: Address;
  onEdit: (a: Address) => void;
  onDelete: (a: Address) => void;
  onSetDefault: (a: Address) => void;
}

export default function AddressCard({ address, onEdit, onDelete, onSetDefault }: Props) {
  return (
    <article className={styles.card}>
      <header className={styles.head}>
        <h3 className={styles.title}>
          {address.label ?? address.recipientName}
          {address.isDefault && <span className={styles.badge}>Padrão</span>}
        </h3>
      </header>
      <p className={styles.line}>{address.recipientName}</p>
      <p className={styles.line}>
        {address.line1}, {address.number}
        {address.complement ? ` — ${address.complement}` : ""}
      </p>
      <p className={styles.line}>
        {address.neighborhood} · {address.city}/{address.state} · CEP {address.postalCode}
      </p>
      {address.reference && (
        <p className={styles.muted}>Ref: {address.reference}</p>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.actionBtn} onClick={() => onEdit(address)}>
          Editar
        </button>
        {!address.isDefault && (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => onSetDefault(address)}
          >
            Tornar padrão
          </button>
        )}
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.danger}`}
          onClick={() => onDelete(address)}
        >
          Excluir
        </button>
      </div>
    </article>
  );
}

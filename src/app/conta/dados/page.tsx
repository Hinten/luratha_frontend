"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import type { TaxIdentity, UserProfile } from "@/src/schemas/firestore";
import styles from "./page.module.css";

type TaxType = TaxIdentity["type"] | "NONE";

export default function ContaDadosPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Campos básicos
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Tax identity
  const [taxType, setTaxType] = useState<TaxType>("NONE");
  // PF
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [birthDate, setBirthDate] = useState("");
  // PJ
  const [cnpj, setCnpj] = useState("");
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [stateRegistration, setStateRegistration] = useState("");
  const [municipalRegistration, setMunicipalRegistration] = useState("");
  // Estrangeiro
  const [documentId, setDocumentId] = useState("");
  const [documentCountry, setDocumentCountry] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      const uid = user!.uid;
      const res = await fetch(`/api/users/${uid}`);
      if (cancelled) return;

      if (res.ok) {
        const profile = (await res.json()) as UserProfile;
        setFirstName(profile.firstName);
        setLastName(profile.lastName);
        setEmail(profile.email);
        setPhone(profile.phone ?? "");
        if (profile.taxIdentity) {
          setTaxType(profile.taxIdentity.type);
          if (profile.taxIdentity.type === "PF") {
            setCpf(profile.taxIdentity.cpf);
            setRg(profile.taxIdentity.rg ?? "");
            setBirthDate(profile.taxIdentity.birthDate ?? "");
          } else if (profile.taxIdentity.type === "PJ") {
            setCnpj(profile.taxIdentity.cnpj);
            setLegalName(profile.taxIdentity.legalName);
            setTradeName(profile.taxIdentity.tradeName ?? "");
            setStateRegistration(profile.taxIdentity.stateRegistration);
            setMunicipalRegistration(profile.taxIdentity.municipalRegistration ?? "");
          } else {
            setDocumentId(profile.taxIdentity.documentId);
            setDocumentCountry(profile.taxIdentity.documentCountry);
          }
        }
      } else if (res.status === 404) {
        // Sem profile ainda — usa nome do mock auth como ponto de partida
        const [first, ...rest] = user!.name.split(" ");
        setFirstName(first ?? "");
        setLastName(rest.join(" "));
        setEmail(user!.email);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function buildTaxIdentity(): TaxIdentity | undefined {
    if (taxType === "NONE") return undefined;
    if (taxType === "PF") {
      return {
        type: "PF",
        cpf,
        ...(rg ? { rg } : {}),
        ...(birthDate ? { birthDate } : {}),
      };
    }
    if (taxType === "PJ") {
      return {
        type: "PJ",
        cnpj,
        legalName,
        ...(tradeName ? { tradeName } : {}),
        stateRegistration: stateRegistration as "ISENTO" | "NAO_CONTRIBUINTE" | string,
        ...(municipalRegistration ? { municipalRegistration } : {}),
      };
    }
    return {
      type: "ESTRANGEIRO",
      documentId,
      documentCountry,
    };
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      const uid = user.uid;
      const taxIdentity = buildTaxIdentity();
      const body: Record<string, unknown> = {
        email,
        firstName,
        lastName,
        role: "customer",
        ...(phone ? { phone } : {}),
        ...(taxIdentity ? { taxIdentity } : {}),
      };

      const res = await fetch(`/api/users/${uid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = (await res.json()) as { message?: string };
        throw new Error(payload.message ?? "Falha ao salvar.");
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;
  if (loading) return <p className={styles.muted}>Carregando…</p>;

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Meus dados</h2>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {success && <p role="status" className={styles.successBox}>Dados salvos.</p>}

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Contato</legend>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="firstName" className={styles.label}>Nome</label>
              <input id="firstName" className={styles.input} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className={styles.field}>
              <label htmlFor="lastName" className={styles.label}>Sobrenome</label>
              <input id="lastName" className={styles.input} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>E-mail</label>
            <input id="email" type="email" className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className={styles.field}>
            <label htmlFor="phone" className={styles.label}>Telefone (com DDD)</label>
            <input id="phone" className={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+5511987654321" />
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Dados fiscais (necessários para NF-e)</legend>

          <div className={styles.field}>
            <label htmlFor="taxType" className={styles.label}>Tipo</label>
            <select
              id="taxType"
              className={styles.input}
              value={taxType}
              onChange={(e) => setTaxType(e.target.value as TaxType)}
            >
              <option value="NONE">Preencher depois</option>
              <option value="PF">Pessoa Física</option>
              <option value="PJ">Pessoa Jurídica</option>
              <option value="ESTRANGEIRO">Estrangeiro</option>
            </select>
          </div>

          {taxType === "PF" && (
            <>
              <div className={styles.field}>
                <label htmlFor="cpf" className={styles.label}>CPF</label>
                <input id="cpf" className={styles.input} value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" required />
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label htmlFor="rg" className={styles.label}>RG (opcional)</label>
                  <input id="rg" className={styles.input} value={rg} onChange={(e) => setRg(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="birthDate" className={styles.label}>Data de nascimento</label>
                  <input id="birthDate" type="date" className={styles.input} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {taxType === "PJ" && (
            <>
              <div className={styles.field}>
                <label htmlFor="cnpj" className={styles.label}>CNPJ</label>
                <input id="cnpj" className={styles.input} value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" required />
              </div>
              <div className={styles.field}>
                <label htmlFor="legalName" className={styles.label}>Razão social</label>
                <input id="legalName" className={styles.input} value={legalName} onChange={(e) => setLegalName(e.target.value)} required />
              </div>
              <div className={styles.field}>
                <label htmlFor="tradeName" className={styles.label}>Nome fantasia (opcional)</label>
                <input id="tradeName" className={styles.input} value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label htmlFor="ie" className={styles.label}>Inscrição Estadual</label>
                  <input id="ie" className={styles.input} value={stateRegistration} onChange={(e) => setStateRegistration(e.target.value)} placeholder="número, ISENTO ou NAO_CONTRIBUINTE" required />
                </div>
                <div className={styles.field}>
                  <label htmlFor="im" className={styles.label}>Inscrição Municipal (opcional)</label>
                  <input id="im" className={styles.input} value={municipalRegistration} onChange={(e) => setMunicipalRegistration(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {taxType === "ESTRANGEIRO" && (
            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="documentId" className={styles.label}>Número do documento</label>
                <input id="documentId" className={styles.input} value={documentId} onChange={(e) => setDocumentId(e.target.value)} required />
              </div>
              <div className={styles.field}>
                <label htmlFor="documentCountry" className={styles.label}>País emissor (código ISO)</label>
                <input id="documentCountry" className={styles.input} value={documentCountry} onChange={(e) => setDocumentCountry(e.target.value.toUpperCase())} maxLength={2} placeholder="US" required />
              </div>
            </div>
          )}
        </fieldset>

        <button type="submit" className={styles.submitBtn} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </form>
    </div>
  );
}

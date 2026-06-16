// Server Component — no "use client" needed

export type JsonLdData = {
  "@context": "https://schema.org";
  "@type": string;
  [key: string]: unknown;
};

interface JsonLdProps {
  data: JsonLdData | JsonLdData[];
}

export default function JsonLd({ data }: JsonLdProps) {
  // Escapa cada `<` para sua forma unicode em JSON antes de injetar no script.
  // Sem isso, um valor configurável (ex.: company.legalName vindo do admin) que
  // contenha a sequência de fechamento de script poderia encerrar a tag e
  // injetar markup (XSS). O parser de JSON-LD reverte o escape, então os dados
  // estruturados permanecem idênticos.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

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
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

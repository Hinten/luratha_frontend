---
name: luratha-seo
description: Activate this skill whenever the user asks to implement SEO, AEO (Answer Engine Optimization), GEO (Generative Engine Optimization), metadata, Open Graph, schema.org structured data, JSON-LD, sitemap, robots.txt, llms.txt, or any search/AI discoverability feature for the Luratha e-commerce. This skill covers all three disciplines in one place because they share technical implementations.
compatibility: Next.js 16+ App Router (Metadata API, generateMetadata, generateStaticParams), schema.org JSON-LD via next/script, llmstxt.org spec.
---

# SEO · AEO · GEO — Luratha Frontend

## Overview

Three complementary disciplines govern Luratha's discoverability:

| Discipline | Full Name | Goal | Primary Channel |
|---|---|---|---|
| **SEO** | Search Engine Optimization | Rank in traditional search (Google, Bing) | Crawlers, indexers |
| **AEO** | Answer Engine Optimization | Appear in featured snippets, AI Overviews, voice assistants | Semantic extractors |
| **GEO** | Generative Engine Optimization | Be cited by LLMs (ChatGPT, Gemini, Copilot, Perplexity) | Language models |

All three share the same technical foundation: **semantic HTML, structured data (schema.org), clear metadata, and machine-readable content**. Do all three together — never in isolation.

---

## 1. Metadata (SEO + AEO)

### Root layout (`src/app/layout.tsx`)

The root `metadata` export defines global defaults. Every page should override what it needs.

```ts
export const metadata: Metadata = {
  metadataBase: new URL("https://www.luratha.com.br"),
  title: {
    default: "Luratha – Moda Artesanal Feminina",
    template: "%s | Luratha",
  },
  description:
    "Peças feitas com amor para durar. Slow fashion brasileiro com foco em artesanato, versatilidade e sustentabilidade.",
  keywords: ["slow fashion", "moda artesanal", "roupas femininas", "moda brasileira", "luratha"],
  authors: [{ name: "Luratha" }],
  creator: "Luratha",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://www.luratha.com.br",
    siteName: "Luratha",
    title: "Luratha – Moda Artesanal Feminina",
    description:
      "Peças feitas com amor para durar. Slow fashion brasileiro com foco em artesanato, versatilidade e sustentabilidade.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Luratha – Moda Artesanal Feminina",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Luratha – Moda Artesanal Feminina",
    description:
      "Peças feitas com amor para durar. Slow fashion brasileiro com foco em artesanato, versatilidade e sustentabilidade.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://www.luratha.com.br",
  },
};
```

### Page-level metadata — Server Components

Every page (Server Component) should export its own `metadata` or `generateMetadata`:

```ts
// Static page
export const metadata: Metadata = {
  title: "Vestidos Artesanais",
  description: "Vestidos femininos artesanais feitos com amor. Encontre o vestido perfeito na Luratha.",
  alternates: { canonical: "https://www.luratha.com.br/colecao/vestidos" },
  openGraph: {
    title: "Vestidos Artesanais | Luratha",
    description: "Vestidos femininos artesanais feitos com amor.",
    url: "https://www.luratha.com.br/colecao/vestidos",
    type: "website",
  },
};

// Dynamic page (e.g., product detail)
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const product = await getProduct(params.slug);
  return {
    title: product.name,
    description: product.description,
    alternates: { canonical: `https://www.luratha.com.br/${product.slug}` },
    openGraph: {
      title: `${product.name} | Luratha`,
      description: product.description,
      url: `https://www.luratha.com.br/${product.slug}`,
      type: "website",
      images: [{ url: product.imageUrl, width: 1200, height: 630, alt: product.name }],
    },
  };
}
```

### Metadata rules

- `title`: descriptive, <= 60 characters. Use `template: "%s | Luratha"` in root.
- `description`: compelling, 120–160 characters.
- `canonical`: always set `alternates.canonical` to prevent duplicate content.
- `openGraph.images`: always include a representative image (`width: 1200, height: 630`).
- Never duplicate the same title/description across pages.

---

## 2. Schema.org Structured Data (SEO + AEO + GEO)

Use **JSON-LD** injected via `<script type="application/ld+json">` in a Server Component. In Next.js App Router, place inside the page's `<head>` using the `metadata` API or render a `<script>` tag in the page body.

### Pattern — JSON-LD component

Create `src/components/JsonLd.tsx`:

```tsx
// src/components/JsonLd.tsx
// Server Component — no "use client" needed
import type { Thing, WithContext } from "schema-dts";

interface JsonLdProps {
  data: WithContext<Thing>;
}

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

> **Note:** The `schema-dts` npm package provides TypeScript types for schema.org. Add it as a new dependency with `npm install schema-dts`, then commit the updated `package.json` and `package-lock.json`.

### Schema types by page

| Page | Primary Schema Type | Why |
|---|---|---|
| Root layout | `Organization` + `WebSite` | Brand identity + sitelinks search |
| Home page | `WebPage` + `ItemList` (featured products) | Content + product discovery |
| Category page | `CollectionPage` + `ItemList` | Product listing |
| Product page | `Product` + `BreadcrumbList` | Product rich results |
| About page | `AboutPage` + `Organization` | Brand info in AI answers |
| Contact page | `ContactPage` + `LocalBusiness` | Contact info extraction |
| Returns policy | `FAQPage` | Featured snippets for common questions |
| Size guide | `Table` + `FAQPage` | Size answer extraction |
| Blog/editorial | `Article` | Content indexing |

### Organization schema (root layout or page)

```ts
const organizationSchema: WithContext<Organization> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Luratha",
  url: "https://www.luratha.com.br",
  logo: "https://www.luratha.com.br/luratha.svg",
  sameAs: [
    "https://instagram.com/_luratha",
    "https://facebook.com/Lurathaa",
    "https://youtube.com/channel/UC2RLNR2ZAzUxB97XYNFUnBg",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+55-12-98278-9225",
    contactType: "customer service",
    availableLanguage: "Portuguese",
    areaServed: "BR",
  },
  address: {
    "@type": "PostalAddress",
    addressCountry: "BR",
  },
};
```

### WebSite schema with SearchAction

```ts
const websiteSchema: WithContext<WebSite> = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Luratha",
  url: "https://www.luratha.com.br",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://www.luratha.com.br/busca?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};
```

### Product schema

```ts
const productSchema: WithContext<Product> = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: product.name,
  description: product.description,
  image: product.images,
  brand: {
    "@type": "Brand",
    name: "Luratha",
  },
  offers: {
    "@type": "Offer",
    priceCurrency: "BRL",
    price: product.price,
    availability: product.inStock
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
    url: `https://www.luratha.com.br/${product.slug}`,
    seller: {
      "@type": "Organization",
      name: "Luratha",
    },
  },
  aggregateRating: product.rating
    ? {
        "@type": "AggregateRating",
        ratingValue: product.rating.value,
        reviewCount: product.rating.count,
      }
    : undefined,
};
```

### BreadcrumbList schema

```ts
const breadcrumbSchema: WithContext<BreadcrumbList> = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Início",
      item: "https://www.luratha.com.br",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Vestidos",
      item: "https://www.luratha.com.br/colecao/vestidos",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: product.name,
      item: `https://www.luratha.com.br/${product.slug}`,
    },
  ],
};
```

### FAQPage schema (AEO — answer engines)

Use on returns policy, size guide, and any page with Q&A content:

```ts
const faqSchema: WithContext<FAQPage> = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Qual o prazo para troca ou devolução?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Você tem até 7 dias corridos após o recebimento para solicitar troca ou devolução.",
      },
    },
    {
      "@type": "Question",
      name: "Como faço para trocar um produto Luratha?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Entre em contato pelo WhatsApp (12) 98278-9225 ou pela página de contato informando o pedido e o motivo da troca.",
      },
    },
  ],
};
```

---

## 3. Sitemap & Robots (SEO)

### `src/app/sitemap.ts` — dynamic sitemap

```ts
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.luratha.com.br";
  const staticRoutes = [
    "/",
    "/sobre",
    "/contato",
    "/politica-de-trocas",
    "/referencia-de-medidas",
    "/colecao/vestidos",
    "/colecao/blusas",
    "/colecao/calcas",
    "/colecao/saias",
    "/colecao/shorts",
    "/colecao/conjuntos",
    "/colecao/moletons",
    "/colecao/acessorios",
    "/todas-as-pecas",
    "/sale",
  ];
  return staticRoutes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1.0 : 0.8,
  }));
}
```

### `src/app/robots.ts` — robots.txt

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/conta/", "/carrinho/", "/api/"],
    },
    sitemap: "https://www.luratha.com.br/sitemap.xml",
  };
}
```

---

## 4. llms.txt (GEO — Generative Engine Optimization)

`public/llms.txt` follows the [llmstxt.org](https://llmstxt.org/) specification. It is served at `https://www.luratha.com.br/llms.txt` and helps LLMs (ChatGPT, Gemini, Copilot, Perplexity, etc.) understand the site's content and structure.

**Location:** `public/llms.txt` (Next.js serves `public/` at root)

**Format:** Markdown with YAML-like header

```markdown
# Luratha

> Luratha é uma marca brasileira de moda feminina artesanal...

[short description of the brand]

## Sections
- [Page Name](/route): short description
```

**Rules:**
- Keep it factual and concise — LLMs use it to build context
- List all important pages with their descriptions
- Include contact information, values, and key differentiators
- The file already exists at `public/llms.txt` — update it when new routes are added

---

## 5. GEO Content Strategy

GEO optimizes for being **cited and referenced** by generative AI tools. Unlike SEO (crawlers) and AEO (extractors), GEO targets LLM training data and real-time retrieval.

### Principles

1. **Authority signals:** Use schema.org `Organization` with `sameAs` social links to establish brand identity
2. **Clear brand voice:** Content must be consistent, factual, and use the brand name "Luratha" explicitly
3. **Structured answers:** Use heading hierarchy (H1 → H2 → H3) with direct answers near headings
4. **Named entities:** Mention product types, materials, and values explicitly (e.g., "vestidos artesanais", "slow fashion brasileiro", "feito à mão")
5. **Freshness:** Regular content updates signal relevance to retrieval-augmented models
6. **llms.txt:** Always keep `public/llms.txt` current when adding new routes or sections

### Content patterns for GEO

```tsx
// ✅ Good — clear, factual, entity-rich
<h1>Vestidos Artesanais Femininos</h1>
<p>
  Na Luratha, nossos vestidos são feitos à mão com materiais sustentáveis
  por artesãs brasileiras. Cada peça é única e produzida em pequenas coleções.
</p>

// ❌ Bad — vague, no brand context
<h1>Coleção</h1>
<p>Confira nossas peças exclusivas.</p>
```

---

## 6. Semantic HTML (SEO + AEO + GEO)

Semantic HTML helps all three: search crawlers parse structure, answer engines extract answers, LLMs understand content hierarchy.

### Rules

- Use `<article>`, `<section>`, `<nav>`, `<aside>`, `<header>`, `<footer>`, `<main>` appropriately
- Every page must have exactly **one `<h1>`** — the main topic
- Heading hierarchy must be logical: h1 → h2 → h3 (no skipping)
- Product images: always `alt="[product name] – Luratha"` (descriptive + brand)
- Links: descriptive text (not "clique aqui" — use "Ver vestidos artesanais")
- `<time datetime="ISO-8601">` for dates
- `<address>` for contact information

### Image alt text patterns

```tsx
// Product images
<img alt="Vestido floral artesanal em linho – Luratha" />

// Brand logo
<img alt="Luratha" />  // already correct in Header.tsx

// Category banners
<img alt="Coleção de blusas artesanais femininas – Luratha" />
```

---

## 7. Checklist — Before Finishing Any SEO-Related Task

- [ ] Page has unique `metadata` export (title, description, canonical)
- [ ] Open Graph tags defined (`openGraph.title`, `openGraph.description`, `openGraph.images`)
- [ ] Twitter Card defined
- [ ] Relevant schema.org JSON-LD injected (at minimum `BreadcrumbList` on inner pages)
- [ ] Images have descriptive `alt` text with brand context
- [ ] Heading hierarchy is logical (single H1, correct H2/H3)
- [ ] `public/llms.txt` updated if new routes were added
- [ ] `src/app/sitemap.ts` updated if new static routes were added
- [ ] Semantic HTML elements used correctly
- [ ] No `display: none` on content that should be indexed

---

> **Agent instruction:** Every time you create a new page or modify existing content, apply all relevant items from this skill. SEO, AEO, and GEO are not optional — they are part of the definition of "done" for any Luratha page.

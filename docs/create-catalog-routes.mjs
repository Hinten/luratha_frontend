#!/usr/bin/env node
/**
 * Setup script: creates the Next.js App Router route directories and page files
 * for the Luratha catalog feature.
 *
 * Run once with:  npm run setup:routes
 */

import { mkdirSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const appDir = join(root, "src", "app");

// ─── helpers ──────────────────────────────────────────────────────────────────

function ensure(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log("  created  " + dir.replace(root, ""));
  }
}

function write(filePath, content) {
  if (existsSync(filePath)) {
    console.log("  exists   " + filePath.replace(root, "") + " (skipped)");
    return;
  }
  writeFileSync(filePath, content, "utf8");
  console.log("  wrote    " + filePath.replace(root, ""));
}

// ─── shared sort function (inlined into each page) ────────────────────────────

const SORT_FN = [
  "function sortProducts(products: Product[], sort?: string): Product[] {",
  "  const sorted = [...products];",
  "  switch (sort) {",
  '    case "menor-preco":',
  "      return sorted.sort((a, b) => a.price - b.price);",
  '    case "maior-preco":',
  "      return sorted.sort((a, b) => b.price - a.price);",
  '    case "maior-desconto":',
  "      return sorted.sort((a, b) => {",
  "        const discountA = a.originalPrice",
  "          ? (a.originalPrice - a.price) / a.originalPrice",
  "          : 0;",
  "        const discountB = b.originalPrice",
  "          ? (b.originalPrice - b.price) / b.originalPrice",
  "          : 0;",
  "        return discountB - discountA;",
  "      });",
  "    default:",
  "      return sorted;",
  "  }",
  "}",
].join("\n");

// ─── page file content ────────────────────────────────────────────────────────

const categoriaPage = [
  'import { notFound } from "next/navigation";',
  'import { Suspense } from "react";',
  'import type { Metadata } from "next";',
  'import { CATEGORIES } from "@/src/lib/constants";',
  'import { buildMockProducts } from "@/src/lib/repositories/productsMockData";',
  'import { Product } from "@/src/schemas/firestore/products";',
  'import Breadcrumb from "@/src/components/Breadcrumb";',
  'import ProductGrid from "@/src/components/ProductGrid";',
  'import SortDropdown from "@/src/components/SortDropdown";',
  "",
  "interface PageProps {",
  "  params: Promise<{ slug: string }>;",
  "  searchParams: Promise<{ sort?: string }>;",
  "}",
  "",
  "export function generateStaticParams() {",
  "  return CATEGORIES.map(({ slug }) => ({ slug }));",
  "}",
  "",
  "export async function generateMetadata({ params }: PageProps): Promise<Metadata> {",
  "  const { slug } = await params;",
  "  const category = CATEGORIES.find((c) => c.slug === slug);",
  "  if (!category) return {};",
  "  return {",
  '    title: category.label + " \u2014 Luratha",',
  '    description: "Explore nossa cole\u00e7\u00e3o de " + category.label.toLowerCase() + " slow fashion.",',
  "  };",
  "}",
  "",
  SORT_FN,
  "",
  "export default async function CategoryPage({ params, searchParams }: PageProps) {",
  "  const { slug } = await params;",
  "  const { sort } = await searchParams;",
  "",
  "  const category = CATEGORIES.find((c) => c.slug === slug);",
  "  if (!category) return notFound();",
  "",
  "  const filtered = buildMockProducts().filter((p) => p.categorySlug === slug);",
  "  const products = sortProducts(filtered, sort);",
  "",
  "  return (",
  '    <div className="container-luratha section-padding">',
  "      <Breadcrumb",
  "        items={[",
  '          { label: "Home", href: "/" },',
  "          { label: category.label },",
  "        ]}",
  "      />",
  '      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">',
  "        <div>",
  '          <h1 className="font-[family-name:var(--font-heading)]">',
  "            {category.label}",
  "          </h1>",
  '          <p className="font-[family-name:var(--font-body)] text-sm text-[var(--color-neutral-dark)]/60 mt-1">',
  '            {products.length}{" "}',
  '            {products.length === 1 ? "produto encontrado" : "produtos encontrados"}',
  "          </p>",
  "        </div>",
  "        <Suspense fallback={null}>",
  '          <SortDropdown currentSort={sort ?? "recentes"} />',
  "        </Suspense>",
  "      </div>",
  "      <ProductGrid products={products} />",
  "    </div>",
  "  );",
  "}",
  "",
].join("\n");

const todasAsPecasPage = [
  'import { Suspense } from "react";',
  'import type { Metadata } from "next";',
  'import { buildMockProducts } from "@/src/lib/repositories/productsMockData";',
  'import { Product } from "@/src/schemas/firestore/products";',
  'import Breadcrumb from "@/src/components/Breadcrumb";',
  'import ProductGrid from "@/src/components/ProductGrid";',
  'import SortDropdown from "@/src/components/SortDropdown";',
  "",
  "export const metadata = {",
  '  title: "Todas as Pe\u00e7as \u2014 Luratha",',
  '  description: "Explore nossa cole\u00e7\u00e3o completa de slow fashion artesanal.",',
  "};",
  "",
  "interface PageProps {",
  "  searchParams: Promise<{ sort?: string }>;",
  "}",
  "",
  SORT_FN,
  "",
  "export default async function TodasAsPecasPage({ searchParams }: PageProps) {",
  "  const { sort } = await searchParams;",
  "  const products = sortProducts(buildMockProducts(), sort);",
  "",
  "  return (",
  '    <div className="container-luratha section-padding">',
  "      <Breadcrumb",
  "        items={[",
  '          { label: "Home", href: "/" },',
  '          { label: "Todas as Pe\u00e7as" },',
  "        ]}",
  "      />",
  '      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">',
  "        <div>",
  '          <h1 className="font-[family-name:var(--font-heading)]">',
  "            Todas as Pe\u00e7as",
  "          </h1>",
  '          <p className="font-[family-name:var(--font-body)] text-sm text-[var(--color-neutral-dark)]/60 mt-1">',
  '            {products.length}{" "}',
  "            {products.length === 1",
  '              ? "produto encontrado"',
  '              : "produtos encontrados"}',
  "          </p>",
  "        </div>",
  "        <Suspense fallback={null}>",
  '          <SortDropdown currentSort={sort ?? "recentes"} />',
  "        </Suspense>",
  "      </div>",
  "      <ProductGrid products={products} />",
  "    </div>",
  "  );",
  "}",
  "",
].join("\n");

const salePage = [
  'import { Suspense } from "react";',
  'import type { Metadata } from "next";',
  'import { buildMockProducts } from "@/src/lib/repositories/productsMockData";',
  'import { Product } from "@/src/schemas/firestore/products";',
  'import Breadcrumb from "@/src/components/Breadcrumb";',
  'import ProductGrid from "@/src/components/ProductGrid";',
  'import SortDropdown from "@/src/components/SortDropdown";',
  "",
  "export const metadata = {",
  '  title: "Promo\u00e7\u00f5es \u2014 Luratha",',
  '  description: "Pe\u00e7as slow fashion com desconto especial. Aproveite!",',
  "};",
  "",
  "interface PageProps {",
  "  searchParams: Promise<{ sort?: string }>;",
  "}",
  "",
  SORT_FN,
  "",
  "export default async function SalePage({ searchParams }: PageProps) {",
  "  const { sort } = await searchParams;",
  "  const saleProducts = buildMockProducts().filter((p) => p.originalPrice !== undefined);",
  "  const products = sortProducts(saleProducts, sort);",
  "",
  "  return (",
  '    <div className="container-luratha section-padding">',
  "      <Breadcrumb",
  "        items={[",
  '          { label: "Home", href: "/" },',
  '          { label: "Promo\u00e7\u00f5es" },',
  "        ]}",
  "      />",
  '      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">',
  "        <div>",
  '          <h1 className="font-[family-name:var(--font-heading)]">Promo\u00e7\u00f5es</h1>',
  '          <p className="font-[family-name:var(--font-body)] text-sm text-[var(--color-neutral-dark)]/60 mt-1">',
  '            {products.length}{" "}',
  '            {products.length === 1 ? "produto encontrado" : "produtos encontrados"}',
  "          </p>",
  "        </div>",
  "        <Suspense fallback={null}>",
  '          <SortDropdown currentSort={sort ?? "recentes"} />',
  "        </Suspense>",
  "      </div>",
  "      <ProductGrid products={products} />",
  "    </div>",
  "  );",
  "}",
  "",
].join("\n");

// ─── run ──────────────────────────────────────────────────────────────────────

console.log("\nLuratha \u2014 setting up catalog route files\n");

ensure(join(appDir, "categoria", "[slug]"));
ensure(join(appDir, "todas-as-pecas"));
ensure(join(appDir, "sale"));

write(join(appDir, "categoria", "[slug]", "page.tsx"), categoriaPage);
write(join(appDir, "todas-as-pecas", "page.tsx"), todasAsPecasPage);
write(join(appDir, "sale", "page.tsx"), salePage);

console.log("\nDone! Routes ready:\n");
console.log("   /categoria/[slug]  ->  src/app/categoria/[slug]/page.tsx");
console.log("   /todas-as-pecas    ->  src/app/todas-as-pecas/page.tsx");
console.log("   /sale              ->  src/app/sale/page.tsx\n");

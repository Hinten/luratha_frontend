---
name: visual-identity
description: Activate this skill whenever the user asks to create, review, or generate any interface, component, wireframe, HTML/Tailwind/React code, or design for the Luratha e-commerce. This skill contains the complete visual identity of Luratha — a Brazilian slow-fashion brand focused on artisanal, versatile, and sustainable women's clothing. Use it to ensure total consistency in colors, typography, spacing, components, and user experience.
compatibility: Next.js 16+ with Tailwind CSS v4 and next/font/google. Google Fonts (Playfair Display, Inter) must be reachable at build time.
---

# Visual Identity – Luratha

## Overview

Luratha is a contemporary Brazilian slow-fashion brand that celebrates artisanal craftsmanship, timeless versatility, and emotional connection. The visual identity is **romantic-modern feminine**: soft, tranquil, and elevated with natural elegance. It blends the clean minimal grids of LAS Clothing, the confident color accents of Bahz Shop, and the luxurious photographic storytelling of Laco de Luxo.

The overall feeling is **premium yet approachable** — never flashy, always intentional. Photography features real women in natural light, outdoor settings (picnics, fields, soft interiors), and close-up details of fabrics and handcrafted elements. The tone communicates exclusivity, sustainability, and belonging.

> **Key inspiration:** Laco de Luxo was selected for its luxurious, story-driven aesthetic, adapted with LAS's clean product focus and Bahz's subtle color pops to suit Luratha's slow-fashion ethos.

---

## Color Palette

All colors are soft, natural, and feminine. The primary palette draws from nature (sage, blush, warm neutrals).

| Color Name             | HEX       | RGB                | HSL                | Usage                                        |
|------------------------|-----------|--------------------|--------------------|----------------------------------------------|
| Primary (Blush Rose)   | `#E8B9C9` | rgb(232, 185, 201) | hsl(340, 55%, 85%) | CTAs, accents, links, hero highlights        |
| Secondary (Sage Green) | `#A8B8A2` | rgb(168, 184, 162) | hsl(100, 20%, 70%) | Secondary buttons, icons, subtle borders     |
| Accent (Warm Sand)     | `#EDE4D9` | rgb(237, 228, 217) | hsl(30, 25%, 92%)  | Backgrounds, cards, subtle highlights        |
| Neutral Dark           | `#3A2F2A` | rgb(58, 47, 42)    | hsl(20, 15%, 20%)  | Headings, body text, navigation              |
| Neutral Light          | `#F8F5F0` | rgb(248, 245, 240) | hsl(30, 20%, 97%)  | Page backgrounds                             |
| Neutral Mid            | `#D9D2C7` | rgb(217, 210, 199) | hsl(30, 15%, 80%)  | Dividers, subtle shadows                     |
| Success                | `#A8B8A2` | rgb(168, 184, 162) | hsl(100, 20%, 70%) | Stock indicators, confirmations              |
| Error                  | `#C9A8A8` | rgb(201, 168, 168) | hsl(0, 25%, 75%)   | Alerts                                       |
| Hover                  | `#D9A8B9` | rgb(217, 168, 185) | hsl(340, 40%, 78%) | Interactive states (lighter/darker variants) |

**States:**
- **Hover:** 8% darker or lighter depending on base
- **Active/Focus:** Primary + subtle shadow
- **Disabled:** Neutral Mid at 40% opacity

---

## Typography

Elegant serif for headlines + clean sans for body. Hierarchy is airy and readable.

### Fonts (Google Fonts via `next/font/google`)

Load both fonts in `src/app/layout.tsx`:

```ts
import { Playfair_Display, Inter } from "next/font/google";

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Apply both CSS variables to <body>:
// className={`${playfairDisplay.variable} ${inter.variable}`}
```

Expose the variables in Tailwind CSS v4 (`globals.css`):

```css
@theme {
  --font-heading: var(--font-playfair), Georgia, serif;
  --font-body: var(--font-inter), system-ui, sans-serif;
}
```

### Scale

| Role              | Font             | Size        | Line-height | Weight | Notes                          |
|-------------------|------------------|-------------|-------------|--------|--------------------------------|
| H1                | Playfair Display | 48–64px     | 1.1         | 700    | Letter-spacing: -0.02em        |
| H2                | Playfair Display | 32–40px     | 1.2         | 600    |                                |
| H3                | Playfair Display | 24–28px     | 1.3         | 500    |                                |
| Body              | Inter            | 16–18px     | 1.6–1.7     | 400    |                                |
| Small / Caption   | Inter            | 14px        | 1.5         | 400    |                                |
| Buttons / Nav     | Inter            | 15–16px     | —           | 500    | Nav: uppercase, +0.5px tracking|

**Hierarchy rules:**
- Hero headlines always use Playfair Display.
- Product titles: Inter Medium.
- All text is left-aligned on mobile for better readability.

---

## Spacing & Grid

- **Base unit:** 8px (all spacing must be multiples of 8)
- **Container max-width:** 1280px on desktop, 100% on mobile
- **Section padding:** 80px top/bottom (desktop) → 48px (mobile)
- **Gutter:** 24px desktop, 16px mobile

**Breakpoints** (Tailwind CSS v4 defaults):

| Token | Width  |
|-------|--------|
| `sm`  | 640px  |
| `md`  | 768px  |
| `lg`  | 1024px |
| `xl`  | 1280px |

**Product grid:** 2 columns (mobile) → 3 (`md`) → 4 (`lg`) → 5 (`xl`)

> Every component must be fully responsive. Mobile-first approach. Navigation becomes a bottom sheet or hamburger menu with smooth animation.

---

## Core Components

### Buttons

```html
<!-- Primary -->
<button class="bg-[#E8B9C9] hover:bg-[#D9A8B9] text-[#3A2F2A] font-medium px-8 py-4 rounded-3xl transition-all duration-300 shadow-sm hover:shadow-md flex items-center gap-2">
  Adicionar ao carrinho
</button>

<!-- Secondary -->
<button class="border border-[#A8B8A2] hover:bg-[#A8B8A2]/10 text-[#3A2F2A] font-medium px-8 py-4 rounded-3xl transition-all">
  Ver detalhes
</button>
```

### Product Card (PLP/PDP)

- Soft rounded corners (24px)
- Subtle inner shadow on hover
- Image: 1:1 ratio, `object-cover`, lazy loaded
- Title: Inter Medium 16px
- Price: Inter Bold 18px
- Color swatches: small circles with soft border
- "Artesanal" badge in sage green when applicable

### Navigation

- Top bar: clean, logo centered (Playfair Display), links in Inter Medium
- Mobile: hamburger → full-screen overlay with soft fade
- Always sticky, with mini-cart icon (blush accent)

### Hero

- Full-width lifestyle photography (natural light, soft focus)
- Large serif headline + subtle secondary text
- Primary CTA button centered or bottom-aligned on mobile

### Footer

- Minimal, centered logo + links in two columns on desktop
- Instagram link prominent (social proof)
- Soft beige (`#EDE4D9`) background

---

## Design System Rules

- **Hero sections:** Always full-bleed lifestyle image with overlay text in white or dark neutral. Minimum `80vh` height on desktop.
- **Product cards:** Never overcrowded. Max 3 lines of text. Always show artisanal badge when relevant.
- **Visual hierarchy:** Large typography for emotional impact; generous white space (minimum 40px between elements).
- **Component states:**
  - Hover: gentle lift (`-translate-y-0.5`) + color shift
  - Focus: soft ring in sage green
  - Loading: skeleton in Neutral Mid with shimmer animation
- **Photography:** Natural daylight, soft shadows, real models in movement, close-ups of stitching/texture.
- **Icons:** Simple line icons (stroke 1.5px), in sage or blush.
- **Micro-interactions:** Smooth 300ms transitions, subtle scale on tap, heart icon fill animation on wishlist.
- **Dark mode:** Not supported.

---

## Application Examples

| Screen            | Description                                                                                              |
|-------------------|----------------------------------------------------------------------------------------------------------|
| Homepage Hero     | Picnic lifestyle photo → "Peças feitas com amor para durar" in large Playfair Display + blush CTA button |
| PLP               | 4-column grid on desktop, filter sidebar with sage accents, hover lift + quick-add button per card       |
| PDP               | Large image gallery on left, details on right, size selector (rounded pills), handmade storytelling      |
| Mini-cart         | Slide-in from right, blush header, product thumbnails with remove icon                                   |
| Checkout          | One-column on mobile, sage progress stepper, trust badges (artesanal, sustentável)                      |

---

## Consistency Checklist

- [ ] All colors pulled only from the palette above
- [ ] Typography hierarchy strictly followed
- [ ] Spacing in 8px multiples
- [ ] Every screen fully responsive (mobile-first)
- [ ] Lifestyle photography only (no generic stock shots)
- [ ] Generous white space and soft shadows
- [ ] Buttons always `rounded-3xl`
- [ ] Brand voice: warm, intentional, empowering
- [ ] No dark mode elements

---

> **Agent instruction:** Always follow this visual identity strictly when creating or reviewing any interface. Never invent colors, fonts, or styles outside what is documented here. Prioritize emotional connection, artisanal authenticity, and an effortless shopping experience.

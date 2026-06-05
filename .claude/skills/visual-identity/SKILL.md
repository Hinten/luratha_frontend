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
| ---------------------- | --------- | ------------------ | ------------------ | -------------------------------------------- |
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

| Role            | Font             | Size    | Line-height | Weight | Notes                           |
| --------------- | ---------------- | ------- | ----------- | ------ | ------------------------------- |
| H1              | Playfair Display | 48–64px | 1.1         | 700    | Letter-spacing: -0.02em         |
| H2              | Playfair Display | 32–40px | 1.2         | 600    |                                 |
| H3              | Playfair Display | 24–28px | 1.3         | 500    |                                 |
| Body            | Inter            | 16–18px | 1.6–1.7     | 400    |                                 |
| Small / Caption | Inter            | 14px    | 1.5         | 400    |                                 |
| Buttons / Nav   | Inter            | 15–16px | —           | 500    | Nav: uppercase, +0.5px tracking |

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
| ----- | ------ |
| `sm`  | 640px  |
| `md`  | 768px  |
| `lg`  | 1024px |
| `xl`  | 1280px |

**Product grid:** 2 columns (mobile) → 3 (`md`) → 4 (`lg`) → 5 (`xl`)

> Every component must be fully responsive. Mobile-first approach. Navigation becomes a bottom sheet or hamburger menu with smooth animation.

---

## Styling Approach: CSS Modules

Components in Luratha **must use CSS Modules** (`.module.css` files in the same directory) for their styles. Inline Tailwind utility classes are only acceptable for very small, one-off utilities (e.g., a single responsive visibility toggle or a layout helper already defined in `globals.css`).

### Rules

| Scenario                                                                                 | Approach                                                                                                        |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Component has 3 or more CSS declarations                                                 | Create a `.module.css` file next to the component                                                               |
| Hover/focus/active pseudo-states                                                         | Always in the CSS module (never inline `hover:` Tailwind)                                                       |
| Responsive breakpoint logic                                                              | In the CSS module with `@media` queries                                                                         |
| Simple responsive visibility (e.g., `md:hidden`)                                         | Acceptable as a Tailwind class inline                                                                           |
| Layout helpers already in `globals.css` (e.g., `container-luratha`, `section-padding`)   | Apply via `className` string — do not re-declare in the module                                                  |
| Dynamic values that cannot be known at build time (e.g., a JavaScript-computed gradient) | The single `style={}` prop for that specific dynamic value is acceptable; all other styles belong in the module |

### File naming convention

```
src/components/MyWidget.tsx          ← component
src/components/MyWidget.module.css   ← styles
```

Import and use:

```ts
import styles from "./MyWidget.module.css";

// In JSX:
<div className={styles.wrapper}>...</div>

// Combining module class + layout helper:
<div className={`container-luratha ${styles.inner}`}>...</div>
```

---

## Core Components

### Buttons

Use CSS variable tokens — **never hard-code hex values** in component code or documentation examples.

```css
/* In Component.module.css */
.btnPrimary {
  background-color: var(--color-primary);
  color: var(--color-neutral-dark);
  font-family: var(--font-body);
  font-weight: 500;
  padding: 1rem 2rem;
  border-radius: 9999px;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 5%);
  transition:
    background-color 300ms ease,
    box-shadow 300ms ease,
    transform 300ms ease;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btnPrimary:hover {
  background-color: var(--color-primary-hover);
  color: var(--color-neutral-dark); /* explicitly kept — text must stay readable */
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 10%);
  transform: translateY(-2px);
}

.btnSecondary {
  border: 1px solid var(--color-secondary);
  color: var(--color-neutral-dark);
  font-family: var(--font-body);
  font-weight: 500;
  padding: 1rem 2rem;
  border-radius: 9999px;
  transition: background-color 300ms ease;
  background: none;
}

.btnSecondary:hover {
  background-color: color-mix(in srgb, var(--color-secondary) 10%, transparent);
  color: var(--color-neutral-dark); /* explicitly kept — text must stay readable */
}
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
  - Hover: gentle lift (`translateY(-2px)`) + color shift
  - Focus: soft ring in sage green
  - Loading: skeleton in Neutral Mid with shimmer animation
- **Photography:** Natural daylight, soft shadows, real models in movement, close-ups of stitching/texture.
- **Icons:** Simple line icons (stroke 1.5px), in sage or blush.
- **Micro-interactions:** Smooth 300ms transitions, subtle scale on tap, heart icon fill animation on wishlist.
- **Dark mode:** Not supported.

---

## Color Transition & Hover Legibility

Every CSS transition that changes color — background, text, border, fill, or stroke — **must be reviewed for legibility and aesthetic quality in BOTH the resting state AND the transitioned state**. Never assume the hover state is legible just because the resting state is.

### Mandatory legibility checks

Before committing any hover/focus/active color change, verify:

1. **Contrast ratio** — The foreground color (text, icon) against the new background color after transition must meet a minimum contrast ratio of **3:1** (WCAG AA for UI components and large text). Use computed luminance or a contrast-checker tool.
2. **Visual clarity of icons** — SVG icons that change color must remain clearly recognizable after the transition. A blush icon (`#E8B9C9`) on a light blush or warm-sand background becomes nearly invisible — this is a bug.
3. **Background color is known** — Always consider the _actual_ background the element sits on (the parent or ancestor background), not just the element's own background. Nav links on the `#F8F5F0` header need sufficient contrast. Footer links on the `#EDE4D9` footer background need sufficient contrast.
4. **Both fill and stroke** — For SVG icons, check that neither `fill` nor `stroke` transitions to a near-invisible color.
5. **Aesthetic quality** — The post-transition state must look intentional, not broken. Prefer underline + color over color-only changes when the contrast ratio would otherwise be too low.

### Safe hover patterns for the Luratha palette

| Element                       | Background                   | Resting color                | Safe hover pattern                                                                                                            |
| ----------------------------- | ---------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Nav / footer links (light bg) | `#F8F5F0` or `#EDE4D9`       | `var(--color-neutral-dark)`  | Keep dark text + add `text-decoration: underline` with `text-decoration-color: var(--color-primary)`                          |
| Icon buttons on light bg      | `#F8F5F0`                    | dark icon                    | Keep icon dark; add soft blush background disc: `background-color: color-mix(in srgb, var(--color-primary) 20%, transparent)` |
| Primary button text           | `#E8B9C9` → `#D9A8B9`        | `var(--color-neutral-dark)`  | Text color **must not change** on hover; only background shifts                                                               |
| Secondary button text         | transparent → `#A8B8A2/10`   | `var(--color-neutral-dark)`  | Text color **must not change** on hover; only background shifts                                                               |
| Dark-background CTA           | `#3A2F2A` → slightly lighter | `var(--color-neutral-light)` | Text color **must not change** on hover; only background shifts                                                               |

### Anti-patterns — never do these

```css
/* ❌ Blush text on warm-sand background — contrast ratio ≈ 1.3:1 */
.link:hover {
  color: var(--color-primary);
} /* when background is var(--color-accent) */

/* ❌ Blush icon on neutral-light background — contrast ratio ≈ 1.5:1 */
.iconBtn:hover {
  color: var(--color-primary);
} /* when background is var(--color-neutral-light) */

/* ❌ Hardcoded hex values — use CSS variables instead */
.btn {
  background-color: #e8b9c9;
}

/* ✅ Correct: keep text dark, indicate hover with underline in brand color */
.link:hover {
  color: var(--color-neutral-dark);
  text-decoration: underline;
  text-decoration-color: var(--color-primary);
}

/* ✅ Correct: keep icon dark, add soft blush background disc */
.iconBtn:hover {
  background-color: color-mix(in srgb, var(--color-primary) 20%, transparent);
}
```

---

## Application Examples

| Screen        | Description                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| Homepage Hero | Picnic lifestyle photo → "Peças feitas com amor para durar" in large Playfair Display + blush CTA button |
| PLP           | 4-column grid on desktop, filter sidebar with sage accents, hover lift + quick-add button per card       |
| PDP           | Large image gallery on left, details on right, size selector (rounded pills), handmade storytelling      |
| Mini-cart     | Slide-in from right, blush header, product thumbnails with remove icon                                   |
| Checkout      | One-column on mobile, sage progress stepper, trust badges (artesanal, sustentável)                       |

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
- [ ] Styles in `.module.css` files (not inline), except simple layout helpers from `globals.css`
- [ ] Every hover/focus color transition verified for legibility (min 3:1 contrast ratio in both states)

---

> **Agent instruction:** Always follow this visual identity strictly when creating or reviewing any interface. Never invent colors, fonts, or styles outside what is documented here. Prioritize emotional connection, artisanal authenticity, and an effortless shopping experience.

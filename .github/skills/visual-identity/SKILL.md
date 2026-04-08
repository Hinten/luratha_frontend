name: ecommerce-visual-identity-luratha
description: Activate this skill whenever the user asks to create, review, or generate any interface, component, wireframe, HTML/Tailwind/React code, or design for this e-commerce. This skill contains the complete visual identity of Luratha — a Brazilian slow-fashion brand focused on artisanal, versatile, and sustainable women’s clothing. Use it to ensure total consistency in colors, typography, spacing, components, and user experience.
Visual Identity – Luratha
Overview
Luratha is a contemporary Brazilian slow-fashion brand that celebrates artisanal craftsmanship, timeless versatility, and emotional connection. The visual identity is romantic-modern feminine: soft, tranquil, and elevated with natural elegance. It blends the clean minimal grids of LAS Clothing, the confident color accents of Bahz Shop, and the luxurious photographic storytelling of Laco de Luxo, while staying true to Luratha’s new rebranding direction (soft nature-inspired lifestyle, serif elegance, and pastel-neutrals).
The overall feeling is premium yet approachable — never flashy, always intentional. Photography features real women in natural light, outdoor settings (picnics, fields, soft interiors), and close-up details of fabrics and handcrafted elements. The tone communicates exclusivity, sustainability, and belonging.
Key inspiration choice: Laco de Luxo was selected as the strongest reference for its luxurious, story-driven aesthetic, adapted with LAS’s clean product focus and Bahz’s subtle color pops to perfectly suit Luratha’s slow-fashion ethos.
Color Palette
All colors are soft, natural, and feminine. Primary palette draws from nature (sage, blush, warm neutrals).











































































Color NameHEXRGBHSLUsagePrimary (Blush Rose)#E8B9C9rgb(232, 185, 201)hsl(340, 55%, 85%)CTAs, accents, links, hero highlightsSecondary (Sage Green)#A8B8A2rgb(168, 184, 162)hsl(100, 20%, 70%)Secondary buttons, icons, subtle bordersAccent (Warm Sand)#EDE4D9rgb(237, 228, 217)hsl(30, 25%, 92%)Backgrounds, cards, subtle highlightsNeutral Dark#3A2F2Argb(58, 47, 42)hsl(20, 15%, 20%)Headings, body text, navigationNeutral Light#F8F5F0rgb(248, 245, 240)hsl(30, 20%, 97%)Page backgroundsNeutral Mid#D9D2C7rgb(217, 210, 199)hsl(30, 15%, 80%)Dividers, subtle shadowsSuccess#A8B8A2rgb(168, 184, 162)hsl(100, 20%, 70%)Stock, confirmationError#C9A8A8rgb(201, 168, 168)hsl(0, 25%, 75%)AlertsHover#D9A8B9rgb(217, 168, 185)hsl(340, 40%, 78%)Interactive states (lighter/darker variants)
States:

Hover: 8% darker or lighter depending on base
Active/Focus: Primary + subtle shadow
Disabled: Neutral Mid at 40% opacity

Typography
Elegant serif for headlines + clean sans for body. Hierarchy is airy and readable.

Display / Headings: “Playfair Display” (or system fallback: Georgia, serif)
H1: 48–64px, 1.1 line-height, -0.02em letter-spacing, font-weight 700
H2: 32–40px, 1.2 line-height, font-weight 600
H3: 24–28px, font-weight 500

Body / UI Text: “Inter” (or system fallback: -apple-system, BlinkMacSystemFont, sans-serif)
Body: 16–18px, 1.6–1.7 line-height, font-weight 400
Small text / captions: 14px, 1.5 line-height
Buttons / navigation: 15–16px, font-weight 500, uppercase tracking +0.5px on nav


Hierarchy rules:

Hero headlines always use Playfair Display.
Product titles: Inter Medium.
All text is left-aligned on mobile for better readability.

Spacing & Grid

Base unit: 8px (multiples of 8 for everything)
Container max-width: 1280px (desktop), 100% on mobile
Section padding: 80px top/bottom (desktop) → 48px (mobile)
Gutter: 24px desktop, 16px mobile
Breakpoints (Tailwind standard + custom):
sm: 640px
md: 768px
lg: 1024px
xl: 1280px

Product grid: 2 columns (mobile) → 3 (md) → 4 (lg) → 5 (xl)

Responsive rule: Every component must be fully responsive. Mobile-first approach. Navigation becomes bottom sheet or hamburger with smooth animation.
Core Components
Buttons
<!-- Primary -->
<button class="bg-[#E8B9C9] hover:bg-[#D9A8B9] text-[#3A2F2A] font-medium px-8 py-4 rounded-3xl transition-all duration-300 shadow-sm hover:shadow-md flex items-center gap-2">
  Adicionar ao carrinho
</button>

<!-- Secondary -->
<button class="border border-[#A8B8A2] hover:bg-[#A8B8A2]/10 text-[#3A2F2A] font-medium px-8 py-4 rounded-3xl transition-all">
  Ver detalhes
</button>
Product Card (PLP/PDP)

Soft rounded corners (24px)
Subtle inner shadow on hover
Image: 1:1 ratio, object-cover, lazy load
Title: Inter Medium 16px
Price: Inter 18px bold
Color swatches: small circles with soft border
“Artesanal” badge in sage green when applicable

Navigation

Top bar: clean, logo centered (Playfair Display), links in Inter Medium
Mobile: hamburger → full-screen overlay with soft fade
Always sticky, with mini-cart icon (blush accent)

Hero

Full-width lifestyle photography (natural light, soft focus)
Large serif headline + subtle secondary text
Primary CTA button centered or bottom-aligned on mobile

Footer

Minimal, centered logo + links in two columns on desktop
Instagram link prominent (social proof)
Soft beige background

Design System Rules

Hero sections: Always full-bleed lifestyle image with overlay text in white or dark neutral. Minimum 80vh height on desktop.
Product cards: Never overcrowded. Max 3 lines of text. Always show fabric/ artisanal badge when relevant.
Visual hierarchy: Large typography for emotional impact; generous white space (minimum 40px between elements).
Component states:
Hover: gentle lift (translate-y -2px) + color shift
Focus: soft ring in sage green
Loading: skeleton in neutral mid with shimmer

Photography style: Natural daylight, soft shadows, real models in movement, close-ups of stitching/texture.
Icons: Simple line icons (stroke 1.5px), in sage or blush.
Micro-interactions: Smooth 300ms transitions, subtle scale on tap, heart icon fill animation on wishlist.
Dark mode: Not supported at this time (as requested).

Application Examples

Homepage Hero
Soft picnic-in-field lifestyle photo → “Peças feitas com amor para durar” in large Playfair Display + “Descubra a nova coleção” CTA in blush button.
PLP (Product Listing)
4-column grid on desktop, filter sidebar with soft sage accents, each card with hover lift and quick-add button.
PDP (Product Detail)
Large image gallery on left, details on right with size selector (soft rounded pills), “Feito à mão no Brasil” storytelling section.
Mini-cart
Slide-in from right, blush header, product thumbnails with remove icon.
Checkout flow
Clean, one-column on mobile, progress stepper in sage, trust badges (artesanal, sustentável).

Consistency Checklist

 All colors pulled only from the palette above
 Typography hierarchy strictly followed
 Spacing in 8px multiples
 Every screen fully responsive (mobile-first)
 Lifestyle photography only (no stock product shots)
 Generous white space and soft shadows
 Buttons always rounded-3xl
 Brand voice: warm, intentional, empowering
 No dark mode elements

Instructions for any agent using this skill:
Always follow this visual identity strictly when creating or reviewing any interface. Never invent colors, fonts, or styles outside what is documented here. Prioritize emotional connection, artisanal authenticity, and effortless shopping experience.
This Skill.md is ready for immediate use by designers, developers, or AI agents.
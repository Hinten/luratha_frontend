# Google Product/Variants Quick Reference

Use this file when implementing Product schemas from Firebase data.

## Primary docs to consult

- Merchant listing (Product + Offer):  
  https://developers.google.com/search/docs/appearance/structured-data/merchant-listing?hl=pt-br
- Product variants (ProductGroup):  
  https://developers.google.com/search/docs/appearance/structured-data/product-variants?hl=pt-br

## Additional docs (when needed)

- Product overview (merchant listing vs snippet):  
  https://developers.google.com/search/docs/appearance/structured-data/product?hl=pt-br
- Product snippet details:  
  https://developers.google.com/search/docs/appearance/structured-data/product-snippet?hl=pt-br
- Structured data policies:  
  https://developers.google.com/search/docs/appearance/structured-data/sd-policies?hl=pt-br
- JS-generated structured data constraints:  
  https://developers.google.com/search/docs/appearance/structured-data/generate-structured-data-with-javascript?hl=pt-br

## Critical constraints to re-check on every implementation

1. Product page is a detail page (not category/list page).
2. Merchant listing uses `Offer` (not `AggregateOffer`) for purchasable PDP.
3. Variant pages/groups have stable IDs and crawlable variant URLs.
4. Price/availability in schema matches visible content.
5. Markup appears in initial HTML whenever possible.

export const runtime = "nodejs";

export { GET } from "./get";
export { PATCH } from "./patch";
// POST /api/orders/:id/reorder vive em ./reorder/route.ts — o handler é
// re-exportado de lá, não daqui (re-exportar não cria a sub-rota /reorder).

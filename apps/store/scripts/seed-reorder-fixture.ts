/**
 * Semeia fixtures para testar manualmente o fluxo "Pedir novamente"
 * (`ReorderButton` em /conta/pedidos/[id]) com itens que não estão mais
 * disponíveis no catálogo.
 *
 *   pnpm --filter @luratha/store seed-reorder-fixture <email>
 *   pnpm --filter @luratha/store seed-reorder-fixture <email> --cleanup
 *
 * Cria produtos fixture cobrindo cada razão de skip do `buildReorderItem`
 * (`src/lib/reorder.ts`) e dois pedidos do usuário em estado "PIX expirado"
 * (pending_payment sem `paymentPix`), onde o botão aparece:
 *
 *   - order_reorder_fix_mixed: 5 itens indisponíveis + 1 disponível → estado
 *     "partial" (aviso com a lista + botão "Ir para o checkout").
 *   - order_reorder_fix_empty: só itens indisponíveis → estado "empty".
 *
 * Escreve no projeto Firebase do `.env` da raiz — o mesmo que o `pnpm dev`
 * usa. Requer credenciais Admin (FIREBASE_SERVICE_ACCOUNT_BASE64 / _PATH /
 * GOOGLE_APPLICATION_CREDENTIALS). Re-execução é idempotente (IDs fixos).
 */
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { FirebaseAuthError } from "firebase-admin/auth";
import sharp from "sharp";
import { loadRootEnv } from "@luratha/devtools/loadRootEnv";
import {
  firestoreCollections,
  validateAddress,
  validateOrder,
  validateProduct,
  validateStock,
  type Order,
  type OrderItem,
  type Product,
  type Stock,
} from "@luratha/schemas";

const PRODUCT_IDS = {
  /** Nunca é criado — o item do pedido aponta pra um doc inexistente. */
  removido: "prod_reorder_fix_removido",
  arquivado: "prod_reorder_fix_arquivado",
  variante: "prod_reorder_fix_variante",
  semEstoque: "prod_reorder_fix_sem_estoque",
  semImagem: "prod_reorder_fix_sem_imagem",
  disponivel: "prod_reorder_fix_disponivel",
} as const;

const INACTIVE_VARIANT_ID = "var_reorder_fix_inativa";
const AVAILABLE_PHOTO_ID = "img_reorder_fix_disponivel";
const ORDER_IDS = ["order_reorder_fix_mixed", "order_reorder_fix_empty"] as const;
const FIXTURE_ADDRESS_ID = "addr_reorder_fix";

/** Mesma pasta/extensões do seed de mock (`api/dev/seed-mock-data`). */
const SEED_IMAGES_DIRECTORY = path.join(process.cwd(), "test-images");
const SUPPORTED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function buildFixtureProducts(): Product[] {
  const now = new Date().toISOString();
  const base = {
    brandName: "Luratha",
    categoryId: "cat_vestidos",
    tags: ["reorder-fixture"],
    materialTags: [],
    seasonalTags: [],
    createdAt: now,
    updatedAt: now,
  };
  const price = { price: 100, priceMin: 100, priceMax: 100, currency: "BRL" as const };

  return [
    validateProduct({
      ...base,
      id: PRODUCT_IDS.arquivado,
      title: "Fixture Reorder — Arquivado",
      description: "Produto arquivado para testar a razão 'indisponível' do reorder.",
      sku: "REORDER_FIX_ARQUIVADO",
      status: "archived",
      isPurchasable: false,
      price,
      totalStock: 5,
    }),
    validateProduct({
      ...base,
      id: PRODUCT_IDS.variante,
      title: "Fixture Reorder — Variante Inativa",
      description: "Produto ativo cuja variante comprada foi desativada ('indisponível').",
      sku: "REORDER_FIX_VARIANTE",
      status: "active",
      isPurchasable: true,
      price,
      totalStock: 5,
      variants: [
        {
          id: INACTIVE_VARIANT_ID,
          sku: "REORDER_FIX_VARIANTE_M",
          size: ["M"],
          color: ["Terracota"],
          photoIds: [],
          active: false,
        },
      ],
    }),
    validateProduct({
      ...base,
      id: PRODUCT_IDS.semEstoque,
      title: "Fixture Reorder — Sem Estoque",
      description: "Produto ativo com estoque zerado para testar 'sem estoque'.",
      sku: "REORDER_FIX_SEM_ESTOQUE",
      status: "active",
      isPurchasable: true,
      price,
      totalStock: 0,
    }),
    validateProduct({
      ...base,
      id: PRODUCT_IDS.semImagem,
      title: "Fixture Reorder — Sem Imagem",
      description: "Produto ativo com estoque mas sem nenhuma foto ('sem imagem').",
      sku: "REORDER_FIX_SEM_IMAGEM",
      status: "active",
      isPurchasable: true,
      price,
      totalStock: 5,
      photoAssets: [],
    }),
    validateProduct({
      ...base,
      id: PRODUCT_IDS.disponivel,
      title: "Fixture Reorder — Disponível",
      description: "Produto ativo, com estoque e imagem — volta pro carrinho no reorder.",
      sku: "REORDER_FIX_DISPONIVEL",
      status: "active",
      isPurchasable: true,
      price,
      totalStock: 5,
      // A foto é subida pro bucket depois, via `uploadProductImage` — um
      // `downloadUrl` inventado quebraria o next/image (host não permitido).
      photoAssets: [],
    }),
  ];
}

function buildFixtureStocks(): Stock[] {
  const now = new Date().toISOString();
  return [
    validateStock({
      productId: PRODUCT_IDS.semEstoque,
      sku: "REORDER_FIX_SEM_ESTOQUE",
      quantity: 0,
      hasVariants: false,
      variants: null,
      updatedAt: now,
    }),
    validateStock({
      productId: PRODUCT_IDS.semImagem,
      sku: "REORDER_FIX_SEM_IMAGEM",
      quantity: 5,
      hasVariants: false,
      variants: null,
      updatedAt: now,
    }),
    validateStock({
      productId: PRODUCT_IDS.disponivel,
      sku: "REORDER_FIX_DISPONIVEL",
      quantity: 5,
      hasVariants: false,
      variants: null,
      updatedAt: now,
    }),
  ];
}

/**
 * Imagem para o produto disponível: a primeira de `test-images/` (mesma fonte
 * do seed de mock); sem ela, um webp sólido na paleta da marca via sharp.
 */
async function loadFixtureImage(): Promise<{ fileBuffer: Buffer; fileName: string }> {
  if (existsSync(SEED_IMAGES_DIRECTORY)) {
    const entries = await readdir(SEED_IMAGES_DIRECTORY);
    const fileName = entries.find((entry) =>
      SUPPORTED_IMAGE_EXTENSIONS.has(path.extname(entry).toLowerCase()),
    );
    if (fileName) {
      return {
        fileBuffer: await readFile(path.join(SEED_IMAGES_DIRECTORY, fileName)),
        fileName,
      };
    }
  }

  const fileBuffer = await sharp({
    create: { width: 600, height: 800, channels: 3, background: { r: 200, g: 182, b: 166 } },
  })
    .webp()
    .toBuffer();
  return { fileBuffer, fileName: "reorder-fixture.webp" };
}

/** Snapshot de compra de cada produto fixture, como `OrderItem`. */
function buildUnavailableItems(): OrderItem[] {
  const item = (
    id: string,
    productId: string,
    itemSku: string,
    name: string,
    extra: Partial<OrderItem> = {},
  ): OrderItem => ({
    id,
    productId,
    itemSku,
    name,
    photoId: "img_reorder_fix_snapshot",
    quantity: 1,
    unitPrice: 100,
    lineTotal: 100,
    currency: "BRL",
    ...extra,
  });

  return [
    item(
      "item-removido",
      PRODUCT_IDS.removido,
      "REORDER_FIX_REMOVIDO",
      "Fixture Reorder — Removido",
    ),
    item(
      "item-arquivado",
      PRODUCT_IDS.arquivado,
      "REORDER_FIX_ARQUIVADO",
      "Fixture Reorder — Arquivado",
    ),
    item(
      "item-variante",
      PRODUCT_IDS.variante,
      "REORDER_FIX_VARIANTE_M",
      "Fixture Reorder — Variante Inativa",
      {
        variantId: INACTIVE_VARIANT_ID,
      },
    ),
    item(
      "item-sem-estoque",
      PRODUCT_IDS.semEstoque,
      "REORDER_FIX_SEM_ESTOQUE",
      "Fixture Reorder — Sem Estoque",
    ),
    item(
      "item-sem-imagem",
      PRODUCT_IDS.semImagem,
      "REORDER_FIX_SEM_IMAGEM",
      "Fixture Reorder — Sem Imagem",
    ),
  ];
}

function buildAvailableItem(): OrderItem {
  return {
    id: "item-disponivel",
    productId: PRODUCT_IDS.disponivel,
    itemSku: "REORDER_FIX_DISPONIVEL",
    name: "Fixture Reorder — Disponível",
    photoId: AVAILABLE_PHOTO_ID,
    quantity: 1,
    unitPrice: 100,
    lineTotal: 100,
    currency: "BRL",
  };
}

function buildOrder(
  id: (typeof ORDER_IDS)[number],
  orderNumber: string,
  userId: string,
  shippingAddressPath: string,
  items: OrderItem[],
): Order {
  const now = new Date().toISOString();
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return validateOrder({
    id,
    userId,
    orderNumber,
    // pending_payment + pix sem `paymentPix` → a página mostra o estado
    // "PIX expirado", que é onde o ReorderButton aparece.
    status: "pending_payment",
    paymentMethod: "pix",
    paymentStatus: "awaiting_pix",
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    discountTotal: 0,
    shippingTotal: 20,
    grandTotal: subtotal + 20,
    currency: "BRL",
    shippingAddressPath,
    createdAt: now,
    updatedAt: now,
  });
}

async function main(): Promise<void> {
  const email = process.argv[2];
  const cleanup = process.argv.includes("--cleanup");

  if (!email || email.startsWith("--")) {
    console.error("Uso: pnpm --filter @luratha/store seed-reorder-fixture <email> [--cleanup]");
    process.exit(1);
  }

  // Carrega o .env da raiz ANTES de importar firebaseAdmin, que inicializa o
  // Admin SDK lendo as credenciais do ambiente no momento do import.
  loadRootEnv();
  const { adminAuth, adminBucket, adminDb } = await import("@luratha/firestore/firebaseAdmin");
  const { adminProductConverter } = await import("@luratha/firestore/adminProductConverter");
  const { adminStockConverter } = await import("@luratha/firestore/adminStockConverter");
  const { adminOrderConverter } = await import("@luratha/firestore/adminOrderConverter");
  const { adminAddressConverter } = await import("@luratha/firestore/adminAddressConverter");

  let user;
  try {
    user = await adminAuth.getUserByEmail(email);
  } catch (err) {
    if (err instanceof FirebaseAuthError && err.code === "auth/user-not-found") {
      console.error(`Nenhum usuário encontrado com o e-mail ${email}.`);
      process.exit(1);
    }
    throw err;
  }
  const uid = user.uid;

  const addressesRef = adminDb
    .collection(firestoreCollections.userProfiles)
    .doc(uid)
    .collection(firestoreCollections.addresses);

  if (cleanup) {
    await Promise.all([
      ...ORDER_IDS.map((id) => adminDb.collection(firestoreCollections.orders).doc(id).delete()),
      ...Object.values(PRODUCT_IDS).map((id) =>
        adminDb.collection(firestoreCollections.products).doc(id).delete(),
      ),
      ...Object.values(PRODUCT_IDS).map((id) =>
        adminDb.collection(firestoreCollections.stock).doc(id).delete(),
      ),
      // Só remove o endereço fixture — endereços reais do usuário ficam intactos.
      addressesRef.doc(FIXTURE_ADDRESS_ID).delete(),
      // Imagens subidas pro bucket pelo seed.
      adminBucket.deleteFiles({ prefix: `products/${PRODUCT_IDS.disponivel}/` }),
    ]);
    console.log(
      "Fixtures do reorder removidas (pedidos, produtos, estoque, imagens e endereço fixture).",
    );
    return;
  }

  // Endereço: reaproveita o primeiro existente; senão cria um fixture.
  const existingAddresses = await addressesRef.limit(1).get();
  let addressId: string;
  if (!existingAddresses.empty) {
    addressId = existingAddresses.docs[0].id;
    console.log(`Usando endereço existente do usuário: ${addressId}`);
  } else {
    const now = new Date().toISOString();
    const address = validateAddress({
      id: FIXTURE_ADDRESS_ID,
      label: "Fixture Reorder",
      recipientName: user.displayName ?? "Cliente Luratha",
      postalCode: "01310-100",
      line1: "Avenida Paulista",
      number: "1000",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "SP",
      country: "BR",
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    });
    await addressesRef.doc(address.id).withConverter(adminAddressConverter).set(address);
    addressId = address.id;
    console.log(`Endereço fixture criado: ${addressId}`);
  }
  const shippingAddressPath = `${firestoreCollections.userProfiles}/${uid}/${firestoreCollections.addresses}/${addressId}`;

  const products = buildFixtureProducts();
  await Promise.all(
    products.map((product) =>
      adminDb
        .collection(firestoreCollections.products)
        .doc(product.id)
        .withConverter(adminProductConverter)
        .set(product),
    ),
  );
  console.log(`Produtos fixture criados: ${products.map((p) => p.id).join(", ")}`);
  console.log(`(${PRODUCT_IDS.removido} fica de fora de propósito — simula produto deletado.)`);

  const stocks = buildFixtureStocks();
  await Promise.all(
    stocks.map((stock) =>
      adminDb
        .collection(firestoreCollections.stock)
        .doc(stock.productId)
        .withConverter(adminStockConverter)
        .set(stock),
    ),
  );
  console.log(`Docs de estoque criados: ${stocks.map((s) => s.productId).join(", ")}`);

  // Sobe uma imagem real pro bucket e grava o photoAsset no produto disponível
  // — o downloadUrl resultante é de firebasestorage.googleapis.com, host
  // permitido no next/image (placeholder de terceiro quebra a renderização).
  const { uploadProductImage } = await import("@luratha/repositories/productImageUpload");
  const image = await loadFixtureImage();
  const { imageAsset } = await uploadProductImage({
    productId: PRODUCT_IDS.disponivel,
    imageId: AVAILABLE_PHOTO_ID,
    alt: "Fixture do reorder — produto disponível",
    fileBuffer: image.fileBuffer,
    fileName: image.fileName,
  });
  console.log(`Imagem do produto disponível subida: ${imageAsset.resolutions.mobile.downloadUrl}`);

  const unavailable = buildUnavailableItems();
  const orders = [
    buildOrder("order_reorder_fix_mixed", "REORDER-FIX-MIXED", uid, shippingAddressPath, [
      ...unavailable,
      buildAvailableItem(),
    ]),
    buildOrder(
      "order_reorder_fix_empty",
      "REORDER-FIX-EMPTY",
      uid,
      shippingAddressPath,
      unavailable,
    ),
  ];
  await Promise.all(
    orders.map((order) =>
      adminDb
        .collection(firestoreCollections.orders)
        .doc(order.id)
        .withConverter(adminOrderConverter)
        .set(order),
    ),
  );

  console.log("");
  console.log(`Pedidos fixture criados para ${email} (uid ${uid}):`);
  console.log("  http://localhost:3000/conta/pedidos/order_reorder_fix_mixed");
  console.log("    → 5 itens indisponíveis + 1 disponível (estado parcial + ir pro checkout)");
  console.log("  http://localhost:3000/conta/pedidos/order_reorder_fix_empty");
  console.log("    → só itens indisponíveis (nenhum item volta pro carrinho)");
  console.log("");
  console.log(`Logue com ${email}, abra as URLs acima e clique em "Pedir novamente".`);
  console.log("Para remover tudo depois:");
  console.log(`  pnpm --filter @luratha/store seed-reorder-fixture ${email} --cleanup`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});

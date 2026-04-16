import { NextResponse } from "next/server";
import {
  ProductImageUploadError,
  uploadProductImage,
} from "@/src/lib/repositories/productImageUpload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const productId = formData.get("productId");
    const imageId = formData.get("imageId");
    const alt = formData.get("alt");
    const imageCandidates = formData.getAll("images");
    const fallbackSingleImage = formData.get("image");

    if (typeof productId !== "string" || !productId.trim()) {
      return NextResponse.json({ message: "productId é obrigatório." }, { status: 400 });
    }

    const files = imageCandidates.filter(isFileLike);
    if (files.length === 0 && isFileLike(fallbackSingleImage)) {
      files.push(fallbackSingleImage);
    }

    if (files.length === 0) {
      return NextResponse.json({ message: "Arquivo de imagem inválido." }, { status: 400 });
    }

    if (!files.every((image) => image.type.startsWith("image/"))) {
      return NextResponse.json({ message: "Tipo de arquivo não suportado." }, { status: 400 });
    }

    const results = await Promise.all(
      files.map(async (image, index) => {
        const fileBuffer = Buffer.from(await image.arrayBuffer());
        return uploadProductImage({
          productId,
          imageId: typeof imageId === "string" && files.length === 1 ? imageId : undefined,
          alt: typeof alt === "string" ? alt : undefined,
          fileBuffer,
          fileName: image.name || `image-${index + 1}`,
        });
      }),
    );
    const latestResult = results[results.length - 1];

    return NextResponse.json(
      {
        message: "Imagem processada e salva com sucesso.",
        productId: latestResult.productId,
        imageAsset: latestResult.imageAsset,
        imageAssets: results.map((result) => result.imageAsset),
        photoIds: latestResult.photoIds,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ProductImageUploadError) {
      const status = error.code === "not_found" ? 404 : 400;
      return NextResponse.json({ message: error.message, code: error.code }, { status });
    }

    console.error("[POST /api/images/upload] unexpected error", error);
    return NextResponse.json(
      { message: "Falha ao processar upload da imagem.", code: "unknown" },
      { status: 500 },
    );
  }
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
    typeof value === "object" &&
    "arrayBuffer" in value &&
    "type" in value &&
    "name" in value,
  );
}

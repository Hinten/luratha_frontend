"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

const FALLBACK_IMAGE_URL = "/image_404.png";

type ImageWithFallbackProps = Omit<ImageProps, "src"> & {
  src?: string | null;
};

export default function ImageWithFallback({ src, alt, ...rest }: ImageWithFallbackProps) {
  const [errored, setErrored] = useState(false);
  const finalSrc = !src || errored ? FALLBACK_IMAGE_URL : src;

  return <Image {...rest} src={finalSrc} alt={alt} onError={() => setErrored(true)} />;
}

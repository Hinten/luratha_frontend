"use client";
import Image from "next/image";
import Link from "next/link";
import { appData } from "@/src/lib/constants";

export default function Logo() {
  return (
    <Link href="/">
      <Image
        src={appData.logo}
        alt={appData.name}
        width={240}
        height={100}
        priority
        className="h-16 w-auto md:h-20"
      />
    </Link>
  );
}

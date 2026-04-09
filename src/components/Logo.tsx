"use client";
import Link from "next/link";
import { appData } from "@/src/lib/constants";

export default function Logo() {
  return (
    <Link href="/">
      <img src={appData.logo} alt={appData.name} className="h-16 md:h-20 w-auto" />
    </Link>
  );
}
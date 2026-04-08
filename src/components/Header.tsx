"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import { appData } from "@/src/lib/constants";




export default function Header() {

  return (
    <header>
      <Link href="/" className="logo">
        <img src={appData.logo} alt={appData.name} />
      </Link>
    </header>
  );
}

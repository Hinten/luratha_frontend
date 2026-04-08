"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import { appData } from "@/src/lib/constants";




export default function Footer() {

  return (
    <footer>
      <p>&copy; {new Date().getFullYear()} {appData.name}. All rights reserved.</p>
    </footer>
  );
}

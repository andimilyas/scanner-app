"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/app/context/AppContext";
import {
  buildScannerUrl,
  defaultScanInput,
  LAST_MODE_KEY,
  LAST_INPUT_KEY,
  parseScanInput,
  type ScanMode,
  type ScanInput,
} from "@/app/lib/scanner-nav";

export default function HomePage() {
  const { isHydrated, isLoggedIn } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!isHydrated) return;
    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }
    const savedMode = sessionStorage.getItem(LAST_MODE_KEY);
    const mode: ScanMode = savedMode === "dispensing" ? "dispensing" : "validation";
    const savedInput = sessionStorage.getItem(LAST_INPUT_KEY);
    const input: ScanInput =
      parseScanInput(savedInput) ?? defaultScanInput();
    router.replace(buildScannerUrl(mode, input));
  }, [isHydrated, isLoggedIn, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );
}

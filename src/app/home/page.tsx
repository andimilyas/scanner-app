"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/app/context/AppContext";

const LAST_MODE_KEY = "scanner_last_mode";

export default function HomePage() {
  const { isHydrated, isLoggedIn } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!isHydrated) return;
    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }
    const saved = sessionStorage.getItem(LAST_MODE_KEY);
    const mode = saved === "dispensing" ? "dispensing" : "validation";
    router.replace(`/scanner?mode=${mode}`);
  }, [isHydrated, isLoggedIn, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );
}

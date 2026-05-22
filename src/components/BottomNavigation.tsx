"use client";

import React, { Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { History, ClipboardCheck, Scan } from "lucide-react";
import { useApp } from "@/app/context/AppContext";

const LAST_MODE_KEY = "scanner_last_mode";
type ScanMode = "validation" | "dispensing";

function BottomNavigationInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setScanMode } = useApp();

  const isScanner = pathname.startsWith("/scanner");
  const activeMode: ScanMode =
    searchParams.get("mode") === "dispensing" ? "dispensing" : "validation";

  const goToMode = (next: ScanMode) => {
    setScanMode(next);
    sessionStorage.setItem(LAST_MODE_KEY, next);
    router.push(`/scanner?mode=${next}`);
  };

  const navBtn = (active: boolean, activeClass: string) =>
    `flex flex-col items-center justify-center flex-1 py-2 transition min-w-0 ${
      active ? activeClass : "text-gray-500 hover:text-gray-700"
    }`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="flex items-stretch max-w-lg mx-auto">
        <button
          type="button"
          onClick={() => router.push("/history")}
          className={navBtn(
            pathname.startsWith("/history"),
            "text-indigo-600"
          )}
        >
          <History className="h-6 w-6 mb-0.5 shrink-0" />
          <span className="text-[10px] font-medium leading-tight">Riwayat</span>
        </button>

        <button
          type="button"
          onClick={() => goToMode("validation")}
          className={navBtn(
            isScanner && activeMode === "validation",
            "text-indigo-600"
          )}
        >
          <span
            className={`flex items-center justify-center w-9 h-9 rounded-full mb-0.5 shrink-0 ${
              isScanner && activeMode === "validation"
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-indigo-50 text-indigo-600"
            }`}
          >
            <ClipboardCheck className="w-5 h-5" />
          </span>
          <span className="text-[10px] font-semibold leading-tight">Validasi</span>
        </button>

        <button
          type="button"
          onClick={() => goToMode("dispensing")}
          className={navBtn(
            isScanner && activeMode === "dispensing",
            "text-green-600"
          )}
        >
          <span
            className={`flex items-center justify-center w-9 h-9 rounded-full mb-0.5 shrink-0 ${
              isScanner && activeMode === "dispensing"
                ? "bg-green-600 text-white shadow-md"
                : "bg-green-50 text-green-600"
            }`}
          >
            <Scan className="w-5 h-5" />
          </span>
          <span className="text-[10px] font-semibold leading-tight">Pemberian</span>
        </button>

        <button
          type="button"
          onClick={() => router.push("/profile")}
          className={navBtn(
            pathname.startsWith("/profile"),
            "text-indigo-600"
          )}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 mb-0.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <circle cx="12" cy="9" r="3" strokeWidth={2} />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 19c0-2.5 2.5-4 6-4s6 1.5 6 4"
            />
          </svg>
          <span className="text-[10px] font-medium leading-tight">Akun</span>
        </button>
      </div>
    </nav>
  );
}

const BottomNavigation: React.FC = () => (
  <Suspense fallback={null}>
    <BottomNavigationInner />
  </Suspense>
);

export default BottomNavigation;

"use client";

import React, { Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { History, ClipboardCheck, Scan, LogOut } from "lucide-react";
import { useApp } from "@/app/context/AppContext";
import {
  LAST_MODE_KEY,
  LAST_INPUT_KEY,
  buildScannerUrl,
  parseScanInput,
  type ScanMode,
  type ScanInput,
} from "@/app/lib/scanner-nav";

type NavAccent = "indigo" | "green" | "red";

interface NavItemProps {
  active: boolean;
  label: string;
  accent: NavAccent;
  onClick: () => void;
  icon: React.ReactNode;
}

function NavItem({ active, label, accent, onClick, icon }: NavItemProps) {
  const activeCircle =
    accent === "green"
      ? "bg-green-600 text-white shadow-md"
      : accent === "red"
        ? "bg-red-600 text-white shadow-md"
        : "bg-indigo-600 text-white shadow-md";
  const inactiveCircle =
    accent === "green"
      ? "bg-green-50 text-green-600"
      : accent === "red"
        ? "bg-red-50 text-red-600"
        : "bg-indigo-50 text-indigo-600";
  const activeLabel =
    accent === "green"
      ? "text-green-600"
      : accent === "red"
        ? "text-red-600"
        : "text-indigo-600";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center flex-1 py-2 transition min-w-0 ${
        active ? activeLabel : "text-gray-500 hover:text-gray-700"
      }`}
    >
      <span
        className={`flex items-center justify-center w-9 h-9 rounded-full mb-0.5 shrink-0 ${
          active ? activeCircle : inactiveCircle
        }`}
      >
        {icon}
      </span>
      <span
        className={`text-[10px] leading-tight ${
          active ? "font-semibold" : "font-medium"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

function BottomNavigationInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setScanMode, logout } = useApp();

  const isScanner = pathname.startsWith("/scanner");
  const activeMode: ScanMode =
    searchParams.get("mode") === "dispensing" ? "dispensing" : "validation";
  const activeInput: ScanInput =
    parseScanInput(searchParams.get("input")) ?? "hardware";

  const goToMode = (next: ScanMode) => {
    setScanMode(next);
    sessionStorage.setItem(LAST_MODE_KEY, next);
    router.replace(buildScannerUrl(next, activeInput));
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // tetap logout lokal meski API gagal
    }
    logout();
    router.push("/login");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="flex items-stretch max-w-lg mx-auto">
        <NavItem
          active={pathname.startsWith("/history")}
          label="Riwayat"
          accent="indigo"
          onClick={() => router.push("/history")}
          icon={<History className="w-5 h-5" />}
        />

        <NavItem
          active={isScanner && activeMode === "validation"}
          label="Validasi"
          accent="indigo"
          onClick={() => goToMode("validation")}
          icon={<ClipboardCheck className="w-5 h-5" />}
        />

        <NavItem
          active={isScanner && activeMode === "dispensing"}
          label="Pemberian"
          accent="green"
          onClick={() => goToMode("dispensing")}
          icon={<Scan className="w-5 h-5" />}
        />

        <NavItem
          active={false}
          label="Keluar"
          accent="red"
          onClick={() => void handleLogout()}
          icon={<LogOut className="w-5 h-5" />}
        />
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

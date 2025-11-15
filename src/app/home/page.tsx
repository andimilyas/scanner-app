"use client";
import React, { useState, useEffect } from "react";
import { ClipboardCheck, Scan } from "lucide-react";
import { useApp } from "@/app/context/AppContext";
import { useRouter } from "next/navigation";
import BottomNavigation from "@/components/BottomNavigation";

export default function HomePage() {
  const { scanResult, isLoggedIn, isHydrated, user, isLoading } = useApp();
  const router = useRouter();
  const [, setScanError] = useState<string | null>(null);

  // Listen for scan error in sessionStorage (set by scanner page)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const error = sessionStorage.getItem("scan_error");
      if (error) {
        setScanError(error);
        sessionStorage.removeItem("scan_error");
      }
    }
  }, [scanResult]);

  // Redirect to login if not authenticated (only after hydration)
  useEffect(() => {
    if (isHydrated && !isLoggedIn && !isLoading) {
      router.push("/login");
    }
  }, [isLoggedIn, isHydrated, router, isLoading]);

  // Show loading while hydrating
  if (!isHydrated || isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  if (isHydrated && !isLoggedIn) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="flex-grow p-4 flex flex-col items-center max-w-lg mx-auto w-full space-y-6">
      <div
          className="w-full mb-6 rounded-xl bg-indigo-600 overflow-hidden relative flex flex-col items-center justify-center"
          style={{
            minHeight: "140px",
            boxShadow: "0 4px 24px 0 rgba(99,102,241,0.08)",
          }}
        >
          <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-0">
            {(() => {
              const now = new Date();
              const hour = now.getHours();
              let greeting = "Selamat Pagi";
              if (hour >= 4 && hour < 11) {
                greeting = "Selamat Pagi";
              } else if (hour >= 11 && hour < 15) {
                greeting = "Selamat Siang";
              } else if (hour >= 15 && hour < 18) {
                greeting = "Selamat Sore";
              } else {
                greeting = "Selamat Malam";
              }
              return (
                <h2 className="text-lg sm:text-2xl font-bold text-white mt-2 mb-1 drop-shadow text-center">
                  Halo, {greeting}!
                </h2>
              );
            })()}
            {user?.name && (
              <div className="text-white text-base font-medium text-center">
                {user.name}
              </div>
            )}
          </div>
        </div>
        <div className="w-full flex flex-col gap-4">
          <div
            className="flex flex-col items-start gap-2 w-full px-4 py-4 bg-white border border-indigo-200 rounded-xl shadow hover:shadow-md transition"
          >
            <span className="flex items-center justify-center rounded-full bg-indigo-100/70 mb-2" style={{ width: 56, height: 56 }}>
              <ClipboardCheck className="w-8 h-8 text-indigo-600" />
            </span>
            <div className="flex flex-col items-start">
              <span className="font-semibold text-indigo-700">Validasi Kemasan Resep</span>
              <span className="text-xs text-gray-400 mt-1">
              Fitur ini digunakan untuk memastikan kemasan obat sesuai dengan resep yang diberikan kepada pasien.
              </span>
            </div>
          </div>
          <div
            className="flex flex-col items-start gap-2 w-full px-4 py-4 bg-white border border-green-200 rounded-xl shadow hover:shadow-md transition"
          >
            <span className="flex items-center justify-center rounded-full bg-green-100/70 mb-2" style={{ width: 56, height: 56 }}>
              <Scan className="w-8 h-8 text-green-600" />
            </span>
            <div className="flex flex-col items-start">
              <span className="font-semibold text-green-700">Pemberian Obat ke Pasien</span>
              <span className="text-xs text-gray-400 mt-1">
                Fitur ini membantu memastikan bahwa obat diberikan kepada pasien yang tepat sesuai dengan data resep yang telah diverifikasi.
              </span>
            </div>
          </div>
        </div>
      </div>
    <BottomNavigation />
    </div>
  );
}

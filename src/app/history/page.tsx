"use client";
import React, { useEffect } from "react";
import Header from "@/components/header";
import BottomNavigation from "@/components/BottomNavigation";
import { useApp } from "@/app/context/AppContext";
import { useRouter } from "next/navigation";

interface HistoryItem {
  id?: string;
  code: string;
  mode: "validation" | "dispensing";
  timestamp: string | number;
  user?: string;
}

function HistoryPage() {
  const { isLoggedIn, isHydrated, scanResult, user, scanMode } = useApp();
  const router = useRouter();

  // Redirect to login if not authenticated (only after hydration)
  useEffect(() => {
    if (isHydrated && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoggedIn, isHydrated, router]);

  // Show loading while hydrating
  if (!isHydrated) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  // Simulated history: show latest scan if present, else show empty
  const history: HistoryItem[] = scanResult
    ? [{
        code: scanResult,
        mode: (scanMode === "validation" || scanMode === "dispensing") ? scanMode : "validation",
        timestamp: Date.now(),
        user: user?.no_absen || "1234",
        id: `${Date.now()}`
      }]
    : [];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header
        showBack={true}
        title="Riwayat Scan"
        isLoggedIn={isLoggedIn}
        currentPage="history"
      />
      <main className="flex-1 flex flex-col items-center px-4 py-6 max-w-md mx-auto w-full">
        <h2 className="text-lg font-bold text-gray-800 mb-4 w-full text-left">Riwayat Scan</h2>
        {history.length === 0 ? (
          <div className="w-full text-center text-gray-400 py-12">
            Belum ada riwayat scan.
          </div>
        ) : (
          <div className="w-full flex flex-col gap-4">
            {/* Card untuk Validasi */}
            <div className="bg-white border border-indigo-200 rounded-xl shadow px-4 py-3 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-indigo-600">
                  Validasi Kemasan Resep
                </span>
                <span className="text-xs text-gray-400">
                  {history.length > 0 && history[0].mode === "validation"
                    ? new Date(Number(history[0].timestamp)).toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "-"}
                </span>
              </div>
              {history.length > 0 && history[0].mode === "validation" ? (
                <>
                  <div className="text-sm text-gray-800 font-mono break-all">
                    {history[0].code}
                  </div>
                  {history[0].user && (
                    <div className="text-xs text-gray-500 mt-1">
                      Oleh: <span className="font-semibold">{history[0].user}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-gray-400 py-3 text-center">Belum ada scan validasi.</div>
              )}
            </div>

            {/* Card untuk Pemberian */}
            <div className="bg-white border border-green-200 rounded-xl shadow px-4 py-3 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-green-600">
                  Pemberian Obat
                </span>
                <span className="text-xs text-gray-400">
                  {history.length > 0 && history[0].mode === "dispensing"
                    ? new Date(Number(history[0].timestamp)).toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "-"}
                </span>
              </div>
              {history.length > 0 && history[0].mode === "dispensing" ? (
                <>
                  <div className="text-sm text-gray-800 font-mono break-all">
                    {history[0].code}
                  </div>
                  {history[0].user && (
                    <div className="text-xs text-gray-500 mt-1">
                      Oleh: <span className="font-semibold">{history[0].user}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-gray-400 py-3 text-center">Belum ada scan pemberian.</div>
              )}
            </div>
          </div>
        )}
      </main>
      <BottomNavigation />
    </div>
  );
}

export default HistoryPage;

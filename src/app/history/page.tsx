"use client";
import React, { useEffect, useState } from "react";
import Header from "@/components/header";
import BottomNavigation from "@/components/BottomNavigation";
import { useApp } from "@/app/context/AppContext";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Scan, RefreshCw } from "lucide-react";

interface HistoryItem {
  id: string;
  code: string;
  mode: "validation" | "dispensing";
  timestamp: string;
  user: string;
  no_rawat?: string;
  no_resep?: string;
}

function HistoryPage() {
  const { isLoggedIn, isHydrated, user } = useApp();
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch history from API
  const fetchHistory = async () => {
    if (!user?.no_absen) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/history?user=${user.no_absen}&limit=50`);
      const result = await response.json();

      if (result.success) {
        setHistory(result.data || []);
      } else {
        setError(result.error || "Gagal memuat riwayat.");
      }
    } catch (err) {
      console.error("Fetch history error:", err);
      setError("Terjadi kesalahan koneksi.");
    } finally {
      setIsLoading(false);
    }
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (isHydrated && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoggedIn, isHydrated, router]);

  // Fetch history on mount
  useEffect(() => {
    if (isHydrated && isLoggedIn && user?.no_absen) {
      fetchHistory();
    }
  }, [isHydrated, isLoggedIn, user?.no_absen]);

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

  // Group history by date
  const groupedHistory = history.reduce((acc, item) => {
    const date = new Date(item.timestamp).toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(item);
    return acc;
  }, {} as Record<string, HistoryItem[]>);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header
        showBack={true}
        title="Riwayat Scan"
        isLoggedIn={isLoggedIn}
        currentPage="history"
      />
      
      <main className="flex-1 flex flex-col px-4 py-6 max-w-2xl mx-auto w-full pb-24">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Riwayat Scan</h2>
            <p className="text-sm text-gray-500 mt-1">
              {history.length} aktivitas tercatat
            </p>
          </div>
          <button
            onClick={fetchHistory}
            disabled={isLoading}
            className="p-2 rounded-full bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-indigo-600 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Loading State */}
        {isLoading && history.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-gray-500">Memuat riwayat...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={fetchHistory}
              className="mt-2 text-red-600 text-sm font-medium hover:underline"
            >
              Coba lagi
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && history.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-10 h-10 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Belum Ada Riwayat
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              Mulai scan barcode untuk melihat riwayat aktivitas
            </p>
            <button
              onClick={() => router.push("/scanner?mode=validation")}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Mulai Scan
            </button>
          </div>
        )}

        {/* History List */}
        {!isLoading && !error && history.length > 0 && (
          <div className="space-y-6">
            {Object.entries(groupedHistory).map(([date, items]) => (
              <div key={date}>
                <h3 className="text-sm font-semibold text-gray-600 mb-3 sticky top-0 bg-gray-50 py-2 z-10">
                  {date}
                </h3>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`bg-white border rounded-xl shadow-sm p-4 transition-all hover:shadow-md ${
                        item.mode === "validation"
                          ? "border-indigo-200"
                          : "border-green-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            item.mode === "validation"
                              ? "bg-indigo-100"
                              : "bg-green-100"
                          }`}
                        >
                          {item.mode === "validation" ? (
                            <ClipboardCheck
                              className={`w-5 h-5 ${
                                item.mode === "validation"
                                  ? "text-indigo-600"
                                  : "text-green-600"
                              }`}
                            />
                          ) : (
                            <Scan
                              className={`w-5 h-5 ${
                                item.mode === "dispensing"
                                  ? "text-indigo-600"
                                  : "text-green-600"
                              }`}
                            />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-sm font-semibold ${
                                item.mode === "validation"
                                  ? "text-indigo-600"
                                  : "text-green-600"
                              }`}
                            >
                              {item.mode === "validation"
                                ? "Validasi Kemasan"
                                : "Pemberian Obat"}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(item.timestamp).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>

                          {/* Barcode */}
                          <div className="mb-2">
                            <p className="text-xs text-gray-500 mb-1">Kode Barcode:</p>
                            <p className="text-sm font-mono text-gray-800 bg-gray-50 px-2 py-1 rounded break-all">
                              {item.code}
                            </p>
                          </div>

                          {/* Additional Info */}
                          <div className="flex flex-wrap gap-2 text-xs">
                            {item.no_resep && (
                              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                Resep: {item.no_resep}
                              </span>
                            )}
                            {item.no_rawat && (
                              <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded">
                                Rawat: {item.no_rawat}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}

export default HistoryPage;
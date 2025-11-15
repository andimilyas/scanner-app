"use client";
import React, { useEffect, useState, useCallback } from "react";
import Header from "@/components/header";
import BottomNavigation from "@/components/BottomNavigation";
import { useApp } from "@/app/context/AppContext";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Scan, RefreshCw, Filter } from "lucide-react";

interface HistoryItem {
  id: string;
  code: string;
  mode: "validation" | "dispensing";
  timestamp: number;
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
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [tempDate, setTempDate] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<HistoryItem["mode"] | null>(null);
  const [tempMode, setTempMode] = useState<HistoryItem["mode"] | null>(null);

  // Fetch history from API (with useCallback to avoid react-hooks/exhaustive-deps warning)
  const fetchHistory = useCallback(async () => {
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
  }, [user?.no_absen]);

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
  }, [isHydrated, isLoggedIn, user?.no_absen, fetchHistory]);

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

  // Helpers
  const toDateString = (ts: number) => {
    const d = new Date(ts);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Apply date filter
  const filteredHistory = selectedDate
    ? history.filter((item) => toDateString(item.timestamp) === selectedDate)
    : history;

  const modeFilteredHistory = selectedMode
    ? filteredHistory.filter((item) => item.mode === selectedMode)
    : filteredHistory;

  // Group filtered history by date
  const groupedHistory = modeFilteredHistory.reduce((acc, item) => {
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
              {modeFilteredHistory.length} aktivitas tercatat
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setTempDate(selectedDate);
                setTempMode(selectedMode);
                setIsFilterOpen(true);
              }}
              className="p-2 rounded-full bg-indigo-50 hover:bg-indigo-100 transition-colors"
              aria-label="Filter tanggal"
            >
              <Filter className="w-5 h-5 text-indigo-600" />
            </button>
            <button
              onClick={fetchHistory}
              disabled={isLoading}
              className="p-2 rounded-full bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-indigo-600 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
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

        {/* Empty State - No overall history */}
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

        {/* Empty State - No results for selected date */}
        {!isLoading && !error && history.length > 0 && (selectedDate || selectedMode) && modeFilteredHistory.length === 0 && (
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
              Tidak ada riwayat untuk filter ini
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              Silakan ubah tanggal atau mode, atau reset filter
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedDate("")}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Reset Filter
              </button>
              <button
                onClick={fetchHistory}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Refresh Data
              </button>
            </div>
          </div>
        )}

        {/* History List */}
        {!isLoading && !error && modeFilteredHistory.length > 0 && (
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

      {/* Filter Modal */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsFilterOpen(false)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-4">Filter Riwayat Scan</h3>
            <div className="space-y-3">
              <label className="block text-sm text-gray-600">Pilih tanggal</label>
              <input
                type="date"
                value={tempDate}
                onChange={(e) => setTempDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              />
              <div className="mt-4">
                <label className="block text-sm text-gray-600 mb-2">Pilih mode</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTempMode("validation")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm border transition ${
                      tempMode === "validation" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 justify-center">
                      <ClipboardCheck className="w-4 h-4" /> Validasi
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempMode("dispensing")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm border transition ${
                      tempMode === "dispensing" ? "bg-green-600 text-white border-green-600" : "bg-white text-green-600 border-green-200 hover:bg-green-50"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 justify-center">
                      <Scan className="w-4 h-4" /> Pemberian
                    </span>
                  </button>
                </div>
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => setTempMode(null)}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Hapus pilihan mode
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-10">
              <button
                onClick={() => {
                  setSelectedDate("");
                  setTempDate("");
                  setSelectedMode(null);
                  setTempMode(null);
                  setIsFilterOpen(false);
                }}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
              >
                Reset Filter
              </button>
              <button
                onClick={() => {
                  setSelectedDate(tempDate);
                  setSelectedMode(tempMode);
                  setIsFilterOpen(false);
                }}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNavigation />
    </div>
  );
}

export default HistoryPage;
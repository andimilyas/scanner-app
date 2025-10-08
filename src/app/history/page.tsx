"use client";
import React, { useEffect, useState } from "react";
import Header from "@/components/header";
import BottomNavigation from "@/components/BottomNavigation";
import { useApp } from "@/app/context/AppContext";
import { useRouter } from "next/navigation";

function HistoryPage() {
  const { isLoggedIn, isHydrated } = useApp();
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Redirect to login if not authenticated (only after hydration)
  useEffect(() => {
    if (isHydrated && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoggedIn, isHydrated, router]);

  // Fetch scan history from API
  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/history");
        const data = await res.json();
        if (data.success && Array.isArray(data.history)) {
          setHistory(data.history);
        } else {
          setHistory([]);
        }
      } catch (err) {
        setHistory([]);
      }
      setLoading(false);
    };
    if (isHydrated && isLoggedIn) {
      fetchHistory();
    }
  }, [isHydrated, isLoggedIn]);

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

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header
        showBack={true}
        title="Riwayat Scan"
        isLoggedIn={isLoggedIn}
        currentPage="history"
      />
      <main className="flex-1 flex flex-col items-center px-4 py-6 max-w-md mx-auto w-full">
        <h2 className="text-lg font-bold text-gray-800 mb-4 w-full text-left">Riwayat Pemindaian</h2>
        {loading ? (
          <div className="flex items-center justify-center w-full py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="w-full text-center text-gray-400 py-12">
            Belum ada riwayat scan.
          </div>
        ) : (
          <ul className="w-full flex flex-col gap-3">
            {history.map((item, idx) => (
              <li
                key={item.id || idx}
                className="bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 flex flex-col"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold ${item.mode === "validation" ? "text-indigo-600" : "text-green-600"}`}>
                    {item.mode === "validation" ? "Validasi Resep" : "Pemberian Obat"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {item.timestamp
                      ? new Date(item.timestamp).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "-"}
                  </span>
                </div>
                <div className="text-sm text-gray-800 font-mono break-all">
                  {item.code}
                </div>
                {item.user && (
                  <div className="text-xs text-gray-500 mt-1">
                    Oleh: <span className="font-semibold">{item.user}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
      <BottomNavigation />
    </div>
  );
}

export default HistoryPage;

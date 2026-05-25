"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useApp } from "@/app/context/AppContext";
import React, { useCallback, useEffect, useRef, useState, Suspense } from "react";
import BottomNavigation from "@/components/BottomNavigation";
import Header from "@/components/header";
import {
  ClipboardCheck,
  Scan,
  RefreshCw,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  Camera,
  ScanBarcode,
} from "lucide-react";
import Link from "next/link";
import CameraBarcodeScanner from "@/components/CameraBarcodeScanner";
import { isTouchPrimaryDevice, isEditableInputTarget } from "@/app/lib/device";
import {
  LAST_MODE_KEY,
  LAST_INPUT_KEY,
  buildScannerUrl,
  defaultScanInput,
  parseScanInput,
  type ScanMode,
  type ScanInput,
} from "@/app/lib/scanner-nav";

const SCANNER_KEY_GAP_MS = 100;

interface ApiHistoryItem {
  id: string;
  code: string;
  mode: ScanMode;
  timestamp: number;
  user: string;
}

interface LiveEntry {
  id: string;
  code: string;
  mode: ScanMode;
  timestamp: number;
  status: "success" | "error" | "processing";
  message?: string;
}

function getTodayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateString(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateLabel(dateStr: string): string {
  if (dateStr === getTodayDateString()) return "Hari ini";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ScannerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      }
    >
      <WorkstationContent />
    </Suspense>
  );
}

const WorkstationContent: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paramMode = searchParams.get("mode");
  const paramInput = searchParams.get("input");
  const mode: ScanMode = paramMode === "dispensing" ? "dispensing" : "validation";
  const scanInput: ScanInput = parseScanInput(paramInput) ?? defaultScanInput();
  const isHardwareInput = scanInput === "hardware";
  const isCameraInput = scanInput === "camera";
  const { setScanResult, setScanMode, user, isLoggedIn, isHydrated } = useApp();
  const [apiHistory, setApiHistory] = useState<ApiHistoryItem[]>([]);
  const [liveEntries, setLiveEntries] = useState<LiveEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterDate, setFilterDate] = useState<string>(getTodayDateString());
  const [isTodayFilter, setIsTodayFilter] = useState(true);
  const [listScope, setListScope] = useState<"all" | "current_mode">("all");
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
    code?: string;
  } | null>(null);

  const hardwareInputRef = useRef<HTMLInputElement>(null);
  const lastScannedRef = useRef<string>("");
  const processingRef = useRef<boolean>(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerBufferRef = useRef("");
  const lastScannerKeyRef = useRef(0);
  /** Default true: jangan autofocus sampai tahu perangkat (cegah keyboard di HP). */
  const [isTouchDevice, setIsTouchDevice] = useState(true);

  const showToast = useCallback(
    (t: { type: "success" | "error"; message: string; code?: string }) => {
      setToast(t);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 3500);
    },
    []
  );

  useEffect(() => {
    setIsTouchDevice(isTouchPrimaryDevice());
  }, []);

  const focusHardwareInput = useCallback(() => {
    if (isTouchDevice) return;
    requestAnimationFrame(() => hardwareInputRef.current?.focus({ preventScroll: true }));
  }, [isTouchDevice]);

  const setScanInput = useCallback(
    (input: ScanInput) => {
      sessionStorage.setItem(LAST_INPUT_KEY, input);
      router.replace(buildScannerUrl(mode, input), { scroll: false });
    },
    [mode, router]
  );

  // Redirect if query params missing
  useEffect(() => {
    const modeOk = paramMode === "validation" || paramMode === "dispensing";
    const inputOk = parseScanInput(paramInput) !== null;
    if (!modeOk || !inputOk) {
      const savedMode = sessionStorage.getItem(LAST_MODE_KEY);
      const savedInput = sessionStorage.getItem(LAST_INPUT_KEY);
      const initialMode: ScanMode =
        savedMode === "dispensing" ? "dispensing" : "validation";
      const initialInput: ScanInput =
        parseScanInput(savedInput) ?? defaultScanInput();
      router.replace(buildScannerUrl(initialMode, initialInput), { scroll: false });
      return;
    }
    setScanMode(mode);
    sessionStorage.setItem(LAST_MODE_KEY, mode);
    sessionStorage.setItem(LAST_INPUT_KEY, scanInput);
  }, [paramMode, paramInput, mode, scanInput, setScanMode, router]);

  useEffect(() => {
    if (isHydrated && !isLoggedIn) router.push("/login");
  }, [isLoggedIn, isHydrated, router]);

  const fetchHistory = useCallback(async () => {
    if (!user?.no_absen) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/history?user=${user.no_absen}&limit=50`);
      const result = await res.json();
      if (result.success) {
        setApiHistory(result.data || []);
      }
    } catch (e) {
      console.error("Fetch history error:", e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user?.no_absen]);

  useEffect(() => {
    if (isHydrated && isLoggedIn && user?.no_absen) fetchHistory();
  }, [isHydrated, isLoggedIn, user?.no_absen, fetchHistory]);

  useEffect(() => {
    if (isHydrated && isLoggedIn && isHardwareInput && !isTouchDevice) {
      focusHardwareInput();
    }
  }, [
    isHydrated,
    isLoggedIn,
    mode,
    isProcessing,
    isTouchDevice,
    isHardwareInput,
    focusHardwareInput,
  ]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const processScan = useCallback(
    async (data: string) => {
      if (processingRef.current || isProcessing) return;
      if (data === lastScannedRef.current) return;

      lastScannedRef.current = data;
      processingRef.current = true;
      setIsProcessing(true);

      const processingId = `proc-${Date.now()}`;
      setLiveEntries((prev) => [
        {
          id: processingId,
          code: data,
          mode,
          timestamp: Date.now(),
          status: "processing",
        },
        ...prev,
      ]);

      try {
        setScanResult(data);
        setScanMode(mode);

        const response = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: data,
            mode,
            user: user?.no_absen || "",
          }),
        });

        const result = await response.json();

        setLiveEntries((prev) => prev.filter((e) => e.id !== processingId));

        if (!result.success) {
          let errorMsg = "Terjadi kesalahan saat memproses scan.";
          if (typeof result.error === "string") {
            errorMsg = result.error.includes(
              "String or binary data would be truncated"
            )
              ? "Kode terlalu panjang atau format tidak sesuai."
              : result.error;
          }

          setLiveEntries((prev) => [
            {
              id: `err-${Date.now()}`,
              code: data,
              mode,
              timestamp: Date.now(),
              status: "error",
              message: errorMsg,
            },
            ...prev,
          ]);
          showToast({ type: "error", message: errorMsg, code: data });
          lastScannedRef.current = "";
          return;
        }

        showToast({
          type: "success",
          message:
            mode === "validation"
              ? "Validasi berhasil"
              : "Pemberian obat tercatat",
          code: data,
        });
        await fetchHistory();
      } catch {
        setLiveEntries((prev) => prev.filter((e) => e.id !== processingId));
        setLiveEntries((prev) => [
          {
            id: `err-${Date.now()}`,
            code: data,
            mode,
            timestamp: Date.now(),
            status: "error",
            message: "Terjadi kesalahan koneksi.",
          },
          ...prev,
        ]);
        showToast({
          type: "error",
          message: "Terjadi kesalahan koneksi.",
          code: data,
        });
        lastScannedRef.current = "";
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
        if (isHardwareInput) focusHardwareInput();
      }
    },
    [
      mode,
      user,
      setScanMode,
      setScanResult,
      isProcessing,
      showToast,
      fetchHistory,
      focusHardwareInput,
      isHardwareInput,
    ]
  );

  const handleHardwareKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (processingRef.current) return;
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = e.currentTarget.value.trim();
    e.currentTarget.value = "";
    if (code.length > 0) void processScan(code);
  };

  // HP/tablet + alat scanner: tangkap BT tanpa fokus input (tidak memunculkan keyboard)
  useEffect(() => {
    if (!isHardwareInput || !isTouchDevice || !isHydrated || !isLoggedIn) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableInputTarget(e.target)) return;
      if (processingRef.current) return;

      const now = Date.now();
      if (e.key === "Enter") {
        const code = scannerBufferRef.current.trim();
        scannerBufferRef.current = "";
        if (code.length > 0) {
          e.preventDefault();
          void processScan(code);
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (now - lastScannerKeyRef.current > SCANNER_KEY_GAP_MS) {
          scannerBufferRef.current = "";
        }
        lastScannerKeyRef.current = now;
        scannerBufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isHardwareInput, isTouchDevice, isHydrated, isLoggedIn, processScan]);

  const apiForDate = apiHistory.filter(
    (item) => toDateString(item.timestamp) === filterDate
  );

  const liveForDate = liveEntries.filter(
    (item) => toDateString(item.timestamp) === filterDate
  );

  const apiIds = new Set(apiForDate.map((i) => i.id));

  const mergedRows: LiveEntry[] = [
    ...liveForDate.filter((l) => l.status !== "success" || !apiIds.has(l.id)),
    ...apiForDate.map((item) => ({
      id: item.id,
      code: item.code,
      mode: item.mode,
      timestamp: item.timestamp,
      status: "success" as const,
    })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  const displayRows =
    listScope === "current_mode"
      ? mergedRows.filter((r) => r.mode === mode)
      : mergedRows;J-01-2605-0000377   
      J-01-2605-0000377   
      

  const successCount = displayRows.filter((r) => r.status === "success").length;

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-24">
      <Header title="Apotek RSUD Pasar Rebo" />

      {isHardwareInput && (
        <input
          ref={hardwareInputRef}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="none"
          readOnly={isTouchDevice}
          tabIndex={-1}
          data-scanner-input="true"
          aria-hidden={isTouchDevice}
          aria-label="Input scanner barcode"
          className="sr-only fixed top-0 left-0 w-px h-px opacity-0 pointer-events-none"
          onKeyDown={handleHardwareKeyDown}
          onBlur={() => {
            if (!processingRef.current && !isTouchDevice) focusHardwareInput();
          }}
        />
      )}

      {/* Mode info card + status */}
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-3">
          <div
            className={`rounded-xl border shadow-sm overflow-hidden ${
              mode === "validation"
                ? "bg-white border-indigo-200"
                : "bg-white border-green-200"
            }`}
          >
            <div
              className={`px-4 py-3 flex items-center gap-3 ${
                mode === "validation" ? "bg-indigo-50" : "bg-green-50"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  mode === "validation"
                    ? "bg-indigo-600 text-white"
                    : "bg-green-600 text-white"
                }`}
              >
                {mode === "validation" ? (
                  <ClipboardCheck className="w-5 h-5" />
                ) : (
                  <Scan className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <h2
                  className={`text-sm font-bold ${
                    mode === "validation" ? "text-indigo-700" : "text-green-700"
                  }`}
                >
                  {mode === "validation" ? "Validasi Kemasan" : "Pemberian Obat"}
                </h2>
                <p className="text-xs text-gray-600 mt-0.5 leading-snug">
                  {isCameraInput
                    ? mode === "validation"
                      ? "Gunakan kamera HP untuk scan kemasan"
                      : "Gunakan kamera HP untuk scan pemberian obat"
                    : mode === "validation"
                      ? "Gunakan alat scanner untuk validasi kemasan"
                      : "Gunakan alat scanner untuk pencatatan pemberian"}
                </p>
              </div>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between gap-2 text-sm border-t border-gray-100 bg-white">
              <span className="flex items-center gap-1.5 text-gray-600">
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    {isCameraInput ? "Siap scan (kamera)" : "Siap scan (alat)"}
                  </>
                )}
              </span>
              <span className="text-gray-500 text-xs">
                {successCount} berhasil
                {listScope === "current_mode"
                  ? ` · ${mode === "validation" ? "validasi" : "pemberian"}`
                  : ""}
              </span>
            </div>
          </div>

          {/* Cara scan */}
          <div className="mt-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setScanInput("camera")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-lg transition ${
                  isCameraInput
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-indigo-300"
                }`}
              >
                <Camera className="w-4 h-4 shrink-0" />
                Kamera HP
              </button>
              <button
                type="button"
                onClick={() => setScanInput("hardware")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-lg transition ${
                  isHardwareInput
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-indigo-300"
                }`}
              >
                <ScanBarcode className="w-4 h-4 shrink-0" />
                Alat Scanner
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 left-4 right-4 z-50 max-w-2xl mx-auto px-4 py-3 rounded-xl shadow-lg border flex items-start gap-3 ${
            toast.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
          role="status"
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">{toast.message}</p>
            {toast.code && (
              <p className="font-mono text-xs mt-0.5 truncate">{toast.code}</p>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-4 flex flex-col min-h-0">
        {isCameraInput && (
          <div className="mb-4">
            <CameraBarcodeScanner
              active={isCameraInput && isHydrated && isLoggedIn}
              onScan={(code) => void processScan(code)}
              disabled={isProcessing}
              accent={mode === "validation" ? "indigo" : "green"}
            />
          </div>
        )}

        {/* Date & list filters */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => {
              setIsTodayFilter(true);
              setFilterDate(getTodayDateString());
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              isTodayFilter
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
            }`}
          >
            Hari ini
          </button>
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-white border-gray-200 cursor-pointer hover:border-indigo-300">
            <Calendar className="w-3.5 h-3.5 text-gray-500" />
            <input
              type="date"
              value={isTodayFilter ? "" : filterDate}
              max={getTodayDateString()}
              onChange={(e) => {
                if (e.target.value) {
                  setFilterDate(e.target.value);
                  setIsTodayFilter(e.target.value === getTodayDateString());
                }
              }}
              className="bg-transparent border-0 p-0 text-xs w-[7.5rem] cursor-pointer"
            />
          </label>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() =>
              setListScope((s) => (s === "all" ? "current_mode" : "all"))
            }
            className="px-3 py-1.5 rounded-full text-xs font-medium border bg-white border-gray-200 text-gray-600 hover:border-indigo-300"
          >
            {listScope === "all" ? "Semua mode" : "Mode ini saja"}
          </button>
          <button
            type="button"
            onClick={() => fetchHistory()}
            disabled={isLoadingHistory}
            className="p-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
            aria-label="Refresh riwayat"
          >
            <RefreshCw
              className={`w-4 h-4 text-indigo-600 ${isLoadingHistory ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">
            {formatDateLabel(filterDate)}
          </h2>
          <Link
            href="/history"
            className="text-xs text-indigo-600 hover:underline font-medium"
          >
            Riwayat lengkap
          </Link>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-2 pb-4 min-h-[200px]">
          {isLoadingHistory && displayRows.length === 0 && (
            <div className="flex flex-col items-center py-12 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3" />
              <p className="text-sm">Memuat riwayat...</p>
            </div>
          )}

          {!isLoadingHistory && displayRows.length === 0 && (
            <div className="text-center py-12 px-4 bg-white rounded-xl border border-dashed border-gray-200">
              <Scan className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium text-sm">
                Belum ada scan pada tanggal ini
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {isCameraInput
                  ? "Scan dengan kamera — hasil muncul di sini"
                  : "Scan dengan alat scanner — hasil muncul di sini"}
              </p>
            </div>
          )}

          {displayRows.map((row) => (
            <div
              key={row.id}
              className={`bg-white rounded-xl border p-3 shadow-sm ${
                row.status === "error"
                  ? "border-red-200 bg-red-50/50"
                  : row.status === "processing"
                    ? "border-indigo-200"
                    : row.mode === "validation"
                      ? "border-indigo-100"
                      : "border-green-100"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    row.status === "error"
                      ? "bg-red-100"
                      : row.status === "processing"
                        ? "bg-indigo-100"
                        : row.mode === "validation"
                          ? "bg-indigo-100"
                          : "bg-green-100"
                  }`}
                >
                  {row.status === "processing" ? (
                    <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                  ) : row.status === "error" ? (
                    <XCircle className="w-4 h-4 text-red-600" />
                  ) : row.mode === "validation" ? (
                    <ClipboardCheck className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Scan className="w-4 h-4 text-green-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span
                      className={`text-xs font-semibold ${
                        row.mode === "validation"
                          ? "text-indigo-600"
                          : "text-green-600"
                      }`}
                    >
                      {row.mode === "validation"
                        ? "Validasi Kemasan"
                        : "Pemberian Obat"}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatTime(row.timestamp)}
                    </span>
                  </div>
                  <p className="font-mono text-sm text-gray-800 break-all">
                    {row.code}
                  </p>
                  {row.status === "error" && row.message && (
                    <p className="text-xs text-red-600 mt-1">{row.message}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
};

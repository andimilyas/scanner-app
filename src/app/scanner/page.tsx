"use client";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "@/components/header";
import { useApp } from "@/app/context/AppContext";
import { BrowserMultiFormatReader } from "@zxing/browser";
import React, { useCallback, useEffect, useRef, useState, Suspense } from "react";
import BottomNavigation from "@/components/BottomNavigation";

export default function ScannerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
    </div>}>
      <ScannerContent />
    </Suspense>
  );
}

const ScannerContent: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = searchParams.get("mode");
  const { scanResult, scanMode, setScanResult, setScanMode, user, isLoggedIn, isHydrated } = useApp();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanSuccess, setScanSuccess] = useState<boolean>(false);
  const [lastScanData, setLastScanData] = useState<{ result: string, mode: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Loading state

  // Reset states when mode changes
  useEffect(() => {
    setScanError(null);
    setScanSuccess(false);
    setLastScanData(null);
    setIsProcessing(false);
  }, [mode]);

  // Redirect to login if not authenticated (only after hydration)
  useEffect(() => {
    if (isHydrated && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoggedIn, isHydrated, router]);

  // Listen for scan error in sessionStorage (for navigation from other pages)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const error = sessionStorage.getItem("scan_error");
      if (error) {
        setScanError(error);
        sessionStorage.removeItem("scan_error");
      }
    }
  }, []);

  // Update handleScan to display error messages immediately
  const handleScan = useCallback(async (data: string) => {
    setIsLoading(true); // Activate loading state

    setScanResult(data);
    setScanMode(mode as "validation" | "dispensing" | null);

    const payload = {
      code: data,
      mode,
      user: user?.no_absen || "1234", // Use logged in user or fallback
    };

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!result.success) {
        let errorMsg = "Terjadi kesalahan saat memproses scan.";

        if (typeof result.error === "string") {
          if (result.error.includes("String or binary data would be truncated")) {
            errorMsg =
              "Kode yang dipindai terlalu panjang atau tidak sesuai format. Silakan periksa barcode dan coba lagi.";
          } else {
            errorMsg = result.error;
          }
        }

        setScanError(errorMsg); // Display error immediately
        return; // Stop further processing
      }

      setScanSuccess(true);
      setLastScanData({ result: data, mode: mode as string });
    } catch (err) {
      console.error("Failed to send scan data:", err);
      setScanError("Terjadi kesalahan pada server. Silakan coba lagi.");
    } finally {
      setIsLoading(false); // Deactivate loading state
    }
  }, [mode, user, setScanMode, setScanResult]);

  const handleRetryScan = () => {
    setScanError(null);
    setScanSuccess(false);
    setLastScanData(null);
    setIsProcessing(false);
    // Restart camera jika diperlukan
    if (videoRef.current && !videoRef.current.srcObject) {
      startCamera();
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera error:", err);

      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setScanError("Akses kamera ditolak. Pastikan izin kamera diberikan di browser.");
        } else if (err.name === "NotFoundError") {
          setScanError("Kamera tidak ditemukan. Pastikan perangkat memiliki kamera yang tersedia.");
        } else {
          setScanError("Tidak dapat mengakses kamera. Silakan coba lagi.");
        }
      } else {
        setScanError("Terjadi kesalahan yang tidak diketahui saat mengakses kamera.");
      }
    }
  };

  // Ensure useEffect is unconditional
  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    let stream: MediaStream | null = null;
    let isScanned = false;
    let isMounted = true;
    let videoEl: HTMLVideoElement | null = null;

    const startScanner = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });

        if (videoRef.current && isMounted) {
          videoEl = videoRef.current;
          videoEl.srcObject = stream;

          try {
            await videoEl.play();
          } catch (playError) {
            console.warn("Video play interrupted:", playError);
          }

          if (isMounted) {
            codeReader.decodeFromVideoDevice(
              undefined,
              videoEl,
              (result) => {
                if (result && !isScanned && isMounted) {
                  isScanned = true;
                  handleScan(result.getText());

                  if (stream) {
                    stream.getTracks().forEach((track) => track.stop());
                  }
                  if (videoEl) {
                    videoEl.srcObject = null;
                  }
                }
              }
            );
          }
        }
      } catch (err) {
        console.error("Camera error:", err);
      }
    };

    startScanner();

    return () => {
      isMounted = false;

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [handleScan]);

  // Add loading overlay to display during scanning
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  // Show loading while hydrating
  if (!isHydrated) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-900">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-900">
      {/* Header selalu muncul di atas kamera */}
      <div className="relative z-50">
        <Header
          title={mode === "validation" ? "Validasi Kemasan" : "Pemberian Obat"}
          showBack={true}
          isLoggedIn={isLoggedIn}
          currentPage="scanner"
        />
      </div>

      {/* Camera and overlays */}
      <div className="relative flex-1 w-full">
        {/* Camera View - Fullscreen */}
        {!scanSuccess && (
          <video
            ref={videoRef}
            className="fixed inset-0 w-full h-full object-cover z-0"
            autoPlay
            muted
            playsInline
          />
        )}

        {/* Loading State */}
        {isProcessing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-700">Memproses scan...</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {scanError && (
          <div className="fixed top-4 left-0 w-full flex justify-center mt-16 z-50">
            <div className="w-full max-w-md mx-4 p-4 border-l-4 border-red-500 bg-red-50 rounded-xl shadow-md relative animate-fade-in">
              <button
                type="button"
                aria-label="Tutup"
                className="absolute top-2 right-2 text-red-400 hover:text-red-600 rounded-full p-1 transition"
                onClick={handleRetryScan}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <p className="font-semibold text-red-700 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
                </svg>
                Scan Gagal
              </p>
              <p className="text-sm text-red-600 mt-1">{scanError}</p>
              <button
                onClick={handleRetryScan}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        )}

        {/* Success Message */}
        {scanSuccess && lastScanData && (
          <div className="fixed bottom-0 left-0 w-full flex justify-center mb-8 z-50">
            <div className="w-full max-w-md mx-4 p-6 border-l-4 border-green-500 bg-green-50 rounded-xl shadow-md animate-fade-in">
              <div className="flex items-center gap-3 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 9 0z" />
                </svg>
                <p className="font-semibold text-green-700 text-lg">
                  {lastScanData.mode === "validation" ? "Validasi Berhasil!" : "Pemberian Obat Berhasil!"}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 mt-2">
                <p className="text-sm text-gray-600">Kode Scan:</p>
                <p className="font-mono text-sm bg-gray-100 p-2 rounded mt-1 break-all">
                  {lastScanData.result}
                </p>
              </div>
              <p className="text-green-600 mt-3 flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                Mengarahkan ke beranda...
              </p>
            </div>
          </div>
        )}

        {/* Scan Result */}
        {scanResult && !scanError && !scanSuccess && (
          <div className="fixed top-4 left-0 w-full flex justify-center mt-16 z-40">
            <div
              className={`relative w-full max-w-md mx-4 p-4 border-l-4 ${scanMode === "validation"
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-green-500 bg-green-50"
                } rounded-xl shadow-md transition-all duration-300`}
            >
              {/* Tombol Close */}
              <button
                onClick={() => {
                  // Clear scan result (assuming setScanResult exists in scope)
                  setScanResult(null);
                }}
                className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-200 transition"
                aria-label="Tutup"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <p className="font-semibold text-gray-800">
                Hasil Scan Terakhir ({scanMode === "validation" ? "Validasi" : "Pemberian"}):
              </p>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 mt-1 break-all">
                {scanResult}
              </span>
              <p className="text-sm font-bold text-green-700 mt-2">
                {scanMode === "validation"
                  ? "Validasi Berhasil: Kemasan Sesuai!"
                  : "Pemberian Obat Berhasil: Data Tersimpan!"}
              </p>
            </div>
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>

  );
};
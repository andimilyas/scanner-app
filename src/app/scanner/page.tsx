"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useApp } from "@/app/context/AppContext";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  Suspense,
} from "react";
import BottomNavigation from "@/components/BottomNavigation";
import { ClipboardCheck, Scan } from "lucide-react";

// Dynamic import untuk html5-qrcode
let Html5Qrcode: any;
let Html5QrcodeScanType: any;

export default function ScannerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      }
    >
      <ScannerContent />
    </Suspense>
  );
}

const ScannerContent: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = searchParams.get("mode");
  const { setScanResult, setScanMode, user, isLoggedIn, isHydrated } = useApp();
  
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState<boolean>(false);
  const [lastScanData, setLastScanData] = useState<{
    result: string;
    mode: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<
    { id: string; label: string }[]
  >([]);
  const [showActions, setShowActions] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const html5QrcodeRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const scanInProgressRef = useRef(false);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef<boolean>(false);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Deteksi device type dan setup viewport
  useEffect(() => {
    const checkMobile = () => {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    };
    
    setIsMobile(checkMobile());

    // Prevent zoom pada mobile
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };

    document.addEventListener('touchstart', preventZoom, { passive: false });
    document.addEventListener('touchmove', preventZoom, { passive: false });

    // Set viewport untuk mencegah zoom
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const originalViewport = viewportMeta?.getAttribute('content');
    
    if (viewportMeta) {
      viewportMeta.setAttribute('content', 
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
      );
    }

    return () => {
      document.removeEventListener('touchstart', preventZoom);
      document.removeEventListener('touchmove', preventZoom);
      
      if (viewportMeta && originalViewport) {
        viewportMeta.setAttribute('content', originalViewport);
      }
    };
  }, []);

  // Loading progress animation
  useEffect(() => {
    if (!cameraStarted && !scanError && !scanSuccess) {
      progressIntervalRef.current = setInterval(() => {
        setLoadingProgress(prev => (prev >= 100 ? 0 : prev + 10));
      }, 300);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [cameraStarted, scanError, scanSuccess]);

  // Konfigurasi optimized untuk mobile vs desktop
  const getScannerConfig = useCallback((cameraId: string | null) => {
    if (isMobile) {
      // Optimized untuk mobile - minimal constraints
      return {
        fps: 8, // Lower FPS untuk battery dan performance
        qrbox: { width: 200, height: 200 },
        aspectRatio: 0.8,
        // Remove complex constraints yang bikin error di mobile
      };
    }
    
    // Desktop configuration
    return {
      fps: 15,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };
  }, [isMobile]);

  const toggleFlash = useCallback(() => {
    if (!html5QrcodeRef.current) return;
    
    setFlashOn((prev) => !prev);
    try {
      // Simple flash toggle tanpa complex constraints
      const scanner = html5QrcodeRef.current;
      if (scanner && scanner.getRunningTrackCamera) {
        const videoTrack = scanner.getRunningTrackCamera();
        if (videoTrack && typeof videoTrack.applyConstraints === "function") {
          videoTrack.applyConstraints({
            advanced: [{ torch: !flashOn }] as any,
          }).catch(() => {
            // Flash tidak supported, ignore error
          });
        }
      }
    } catch {
      // Flash tidak available
    }
  }, [flashOn]);

  const stopCamera = useCallback(async () => {
    if (html5QrcodeRef.current && isMountedRef.current) {
      try {
        await html5QrcodeRef.current.stop();
      } catch {
        // Ignore stop errors
      } finally {
        html5QrcodeRef.current = null;
      }
    }
    setCameraStarted(false);
  }, []);

  const handleScan = useCallback(
    async (data: string) => {
      if (!isMountedRef.current || isLoading || scanSuccess || scanInProgressRef.current) return;

      scanInProgressRef.current = true;
      setIsLoading(true);

      try {
        setScanResult(data);
        setScanMode(mode as "validation" | "dispensing" | null);

        const payload = {
          code: data,
          mode,
          user: user?.no_absen || "1234",
        };

        const response = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!result.success) {
          let errorMsg = "Terjadi kesalahan saat memproses scan.";
          if (typeof result.error === "string") {
            errorMsg = result.error.includes(
              "String or binary data would be truncated"
            )
              ? "Kode yang dipindai terlalu panjang atau tidak sesuai format. Silakan periksa barcode dan coba lagi."
              : result.error;
          }
          setScanError(errorMsg);
          return;
        }

        setScanSuccess(true);
        setLastScanData({ result: data, mode: mode as string });

        await stopCamera();
      } catch {
        setScanError("Terjadi kesalahan pada server. Silakan coba lagi.");
      } finally {
        setIsLoading(false);
        scanInProgressRef.current = false;
      }
    },
    [mode, user, setScanMode, setScanResult, isLoading, scanSuccess, stopCamera]
  );

  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      
      setIsLoading(true);
      setScanError(null);

      try {
        if (html5QrcodeRef.current) {
          await html5QrcodeRef.current.stop();
        }

        // Load library jika belum
        if (!Html5Qrcode) {
          const html5QrcodeModule = await import("html5-qrcode");
          Html5Qrcode = html5QrcodeModule.Html5Qrcode;
        }

        const html5Qr = new Html5Qrcode(scannerContainerRef.current?.id || "scanner-container");
        const result = await html5Qr.scanFile(file, true);
        
        handleScan(result);
      } catch {
        setScanError("Tidak dapat membaca kode dari gambar.");
      } finally {
        setIsLoading(false);
      }
    },
    [handleScan]
  );

  // Reset state ketika mode berubah
  useEffect(() => {
    setScanError(null);
    setScanSuccess(false);
    setLastScanData(null);
  }, [mode]);

  // Redirect jika belum login
  useEffect(() => {
    if (isHydrated && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoggedIn, isHydrated, router]);

  // Redirect setelah scan success
  useEffect(() => {
    if (scanSuccess) {
      const timer = setTimeout(() => {
        router.push("/");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [scanSuccess, router]);

  const getCameras = useCallback(async (): Promise<string | null> => {
    try {
      if (!Html5Qrcode) {
        const html5QrcodeModule = await import("html5-qrcode");
        Html5Qrcode = html5QrcodeModule.Html5Qrcode;
      }
      
      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length > 0) {
        setAvailableCameras(cameras);
        
        // Prioritize rear camera untuk mobile
        if (isMobile) {
          const rearCamera = cameras.find(
            (cam: any) =>
              cam.label.toLowerCase().includes("back") ||
              cam.label.toLowerCase().includes("rear") ||
              cam.label.toLowerCase().includes("environment") ||
              cam.label.includes("2")
          );
          return rearCamera?.id || cameras[0].id;
        }
        
        return cameras[0].id;
      }
    } catch (e) {
      console.warn("Error getting cameras:", e);
    }
    return null;
  }, [isMobile]);

  const startCamera = useCallback(async () => {
    if (!isMountedRef.current || initializationRef.current) return;

    initializationRef.current = true;
    setScanError(null);

    try {
      await stopCamera();

      // Load library
      if (!Html5Qrcode) {
        const html5QrcodeModule = await import("html5-qrcode");
        Html5Qrcode = html5QrcodeModule.Html5Qrcode;
        Html5QrcodeScanType = html5QrcodeModule.Html5QrcodeScanType;
      }

      const containerId = scannerContainerRef.current?.id || "scanner-container";
      html5QrcodeRef.current = new Html5Qrcode(containerId);

      // Dapatkan camera ID (skip untuk mobile jika terlalu lama)
      let cameraId: string | null = null;
      const cameraPromise = getCameras();
      
      // Timeout untuk mobile - langsung gunakan facingMode jika terlalu lama
      if (isMobile) {
        cameraId = await Promise.race([
          cameraPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000))
        ]);
      } else {
        cameraId = await cameraPromise;
      }

      const config = getScannerConfig(cameraId);

      await html5QrcodeRef.current.start(
        cameraId || { facingMode: "environment" },
        config,
        (decodedText: string) => {
          if (!scanInProgressRef.current) {
            handleScan(decodedText);
          }
        },
        () => {
          // Simplified error callback
        }
      );

      setCameraStarted(true);
    } catch (e: any) {
      console.error("Camera start error:", e);
      if (isMountedRef.current) {
        if (e.message?.includes('Permission')) {
          setScanError(
            "Izin akses kamera ditolak. Silakan berikan izin kamera di pengaturan browser."
          );
        } else if (e.message?.includes('NotAllowedError')) {
          setScanError(
            "Akses kamera diblokir. Pastikan tidak ada tab lain yang menggunakan kamera."
          );
        } else if (e.message?.includes('NotFoundError')) {
          setScanError(
            "Kamera tidak ditemukan. Pastikan perangkat memiliki kamera."
          );
        } else {
          setScanError("Gagal mengakses kamera. Silakan refresh halaman dan coba lagi.");
        }
      }
    } finally {
      if (isMountedRef.current) {
        initializationRef.current = false;
      }
    }
  }, [getCameras, getScannerConfig, handleScan, stopCamera, isMobile]);

  const handleRetryScan = useCallback(() => {
    if (!isMountedRef.current) return;

    setScanError(null);
    setScanSuccess(false);
    setLastScanData(null);
    scanInProgressRef.current = false;

    startCamera();
  }, [startCamera]);

  // Main camera initialization
  useEffect(() => {
    isMountedRef.current = true;

    if (isHydrated && isLoggedIn) {
      // Delay yang berbeda untuk mobile vs desktop
      const delay = isMobile ? 200 : 400;
      
      const initTimer = setTimeout(() => {
        if (isMountedRef.current && !initializationRef.current) {
          startCamera();
        }
      }, delay);

      return () => {
        clearTimeout(initTimer);
      };
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [isHydrated, isLoggedIn, startCamera, isMobile]);

  // Cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      initializationRef.current = false;
      scanInProgressRef.current = false;

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      if (html5QrcodeRef.current) {
        html5QrcodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  if (!isHydrated) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-900">
        <div className="flex items-center justify-center flex-1 flex-col gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p className="text-white text-lg">Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden relative bg-black">
      <style jsx global>{`
        /* Mobile-optimized styles */
        html, body {
          touch-action: pan-y pan-x;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
          overflow: hidden;
          height: 100%;
        }

        #scanner-container,
        #scanner-container .html5-qrcode,
        #scanner-container .html5-qrcode-element {
          width: 100% !important;
          height: 100% !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
        }

        #scanner-container video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          background: black;
          transform: none !important;
          -webkit-transform: none !important;
        }

        .html5-qrcode-region-mark {
          display: none !important;
        }

        @keyframes scanline {
          0% { top: 15%; }
          100% { top: 85%; }
        }

        .overlay-hole {
          position: relative;
          width: 280px;
          height: 280px;
          border-radius: 12px;
          box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.6);
          border: 2px solid rgba(255, 255, 255, 0.12);
          overflow: hidden;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
        }

        .overlay-hole .scanline {
          position: absolute;
          left: 8px;
          right: 8px;
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(99,102,241,0.95), rgba(139,92,246,0.85), rgba(99,102,241,0.95));
          box-shadow: 0 2px 8px rgba(99,102,241,0.25);
          animation: scanline 1.8s ease-in-out infinite alternate;
          top: 15%;
        }

        .overlay-hole::after{
          content: "";
          position: absolute;
          inset: 6px;
          border-radius: 9px;
          border: 1px solid rgba(255,255,255,0.06);
          pointer-events: none;
        }

        /* Mobile-specific adjustments */
        @media (max-width: 768px) {
          .overlay-hole {
            width: 240px;
            height: 240px;
          }
        }
      `}</style>
      
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center px-2 pt-3 pb-2 w-full z-40 bg-transparent">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-black/10 transition"
          aria-label="Kembali"
        >
          <svg
            width="24"
            height="24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        
        <div className="flex-1 text-center">
          <span className="text-white font-semibold text-base select-none">
            {mode === "validation" ? "Validasi Kemasan" : "Pemberian Obat"}
          </span>
        </div>
        
        <div className="relative">
          <button
            className="p-2 rounded-full hover:bg-black/10 transition"
            aria-label="Menu Aksi"
            onClick={() => setShowActions((prev) => !prev)}
            type="button"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
          
          {showActions && (
            <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-lg z-50 py-2 w-44 flex flex-col">
              <button
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-gray-800 text-sm"
                onClick={() => {
                  setShowActions(false);
                  toggleFlash();
                }}
                type="button"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill={flashOn ? "#fde047" : "none"}
                  stroke={flashOn ? "#fde047" : "#222"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-1"
                >
                  <path d="M7 2v11h3v9l7-12h-4l4-8z" />
                </svg>
                {flashOn ? "Matikan Flash" : "Nyalakan Flash"}
              </button>
              <label
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-gray-800 text-sm cursor-pointer"
                htmlFor="upload-image-action"
                onClick={() => setShowActions(false)}
              >
                <svg
                  width="18"
                  height="18"
                  fill="none"
                  stroke="#222"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                  className="mr-1"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2.5" />
                  <circle cx="12" cy="13" r="3" />
                  <path d="M15.5 8.5h.01" />
                </svg>
                Unggah Gambar
                <input
                  id="upload-image-action"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  aria-label="Unggah Gambar"
                  tabIndex={-1}
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Instruction Text */}
      <div
        className="w-full absolute top-0 text-white text-xs px-3 py-1 rounded-md font-medium text-center"
        style={{ marginTop: 150, zIndex: 30 }}
      >
        Arahkan barcode ke dalam kotak
      </div>
      
      {/* Scanner Area */}
      <div className="flex-1 relative overflow-hidden">
        <div
          id="scanner-container"
          ref={scannerContainerRef}
          className="w-full h-full absolute inset-0 z-10"
        />

        {cameraStarted && !scanSuccess && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="overlay-hole" aria-hidden="true">
              <div className="scanline" />
            </div>
          </div>
        )}

        {/* Loading State */}
        {!cameraStarted && !scanError && !scanSuccess && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-5"></div>
            <p className="text-white text-lg mb-1 text-center">
              {isMobile ? "Menyiapkan kamera..." : "Menginisialisasi kamera..."}
            </p>
            <p className="text-white text-xs opacity-60 text-center px-4 mb-4">
              {isMobile 
                ? "Ini mungkin membutuhkan waktu beberapa detik" 
                : "Sedang mengakses perangkat kamera"
              }
            </p>
            <div className="w-48 bg-gray-700 rounded-full h-1.5">
              <div 
                className="bg-white h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Error State */}
        {scanError && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
            <div className="w-full max-w-xs p-5 bg-white border-l-4 border-red-500 rounded-2xl shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="font-semibold text-red-700 text-base">Scan Gagal</p>
              </div>
              <p className="text-gray-600 mb-4 text-sm">{scanError}</p>
              <div className="flex gap-3">
                <button
                  onClick={handleRetryScan}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
                >
                  Coba Lagi
                </button>
                <button
                  onClick={() => router.push("/")}
                  className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors font-medium text-sm"
                >
                  Kembali
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {scanSuccess && lastScanData && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-xs p-5 border-l-4 border-green-500 bg-white rounded-2xl shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="font-semibold text-green-700 text-base">
                  Scan Berhasil!
                </p>
              </div>
              <div className="bg-gray-100 rounded-lg p-3 mt-2 border border-green-100">
                <p className="text-xs text-gray-600 font-semibold mb-1">Kode Scan:</p>
                <p className="font-mono text-xs bg-white p-2 rounded break-all border text-green-700">
                  {lastScanData.result}
                </p>
              </div>
              <div className="text-green-600 mt-4 flex items-center gap-2 justify-center bg-green-50 py-2 rounded-lg text-xs">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                <span className="font-medium">Mengarahkan ke beranda...</span>
              </div>
            </div>
          </div>
        )}

        {/* Mode Selector */}
        {cameraStarted && !scanSuccess && (
          <div className="absolute left-0 bottom-45 right-0 flex justify-center items-center z-40 px-4">
            <div className="w-full max-w-xs flex bg-white rounded-lg p-0.5 shadow">
              <button
                type="button"
                onClick={() => {
                  setScanMode("validation");
                  router.push("/scanner?mode=validation");
                }}
                className={`flex-1 py-2 font-semibold text-sm transition-all duration-200 ${
                  mode === "validation" || !mode
                    ? "bg-indigo-600 text-white rounded-lg"
                    : "text-indigo-600"
                }`}
              >
                <div className="flex flex-row items-center justify-center gap-2">
                  <span className="flex items-center justify-center rounded-full bg-white" style={{ width: 30, height: 30 }}>
                    <ClipboardCheck className="w-5 h-5 text-indigo-600" />
                  </span>
                  <span className="text-md font-medium">Validasi</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanMode("dispensing");
                  router.push("/scanner?mode=dispensing");
                }}
                className={`flex-1 py-2 font-semibold text-sm transition-all duration-200 ${
                  mode === "dispensing"
                    ? "bg-green-600 text-white rounded-lg"
                    : "text-green-600"
                }`}
              >
                <div className="flex flex-row items-center justify-center gap-2">
                  <span className="flex items-center justify-center rounded-full bg-white" style={{ width: 30, height: 30 }}>
                    <Scan className="w-5 h-5 text-green-600" />
                  </span>
                  <span className="text-md font-medium">Pemberian</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        <BottomNavigation />
      </div>
    </div>
  );
};
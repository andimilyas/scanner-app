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
import { Html5Qrcode, Html5QrcodeScanType } from "html5-qrcode";

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
  const { setScanResult, setScanMode, user, isLoggedIn, isHydrated } =
    useApp();
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

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef(true);
  const scanInProgressRef = useRef(false);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef<boolean>(false);

  // For handling flash toggle and flash state
  const [flashOn, setFlashOn] = useState(false);

  // Prevent zoom on mobile devices
  useEffect(() => {
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const preventDoubleTapZoom = (e: Event) => {
      e.preventDefault();
    };

    // Prevent pinch zoom
    document.addEventListener('touchstart', preventZoom, { passive: false });
    document.addEventListener('touchmove', preventZoom, { passive: false });
    
    // Prevent double tap zoom on scanner container
    const scannerElement = scannerContainerRef.current;
    if (scannerElement) {
      scannerElement.addEventListener('touchend', preventDoubleTapZoom);
    }

    // Set viewport meta tag to prevent zoom
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const originalViewport = viewportMeta?.getAttribute('content');
    
    if (viewportMeta) {
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    }

    return () => {
      document.removeEventListener('touchstart', preventZoom);
      document.removeEventListener('touchmove', preventZoom);
      
      if (scannerElement) {
        scannerElement.removeEventListener('touchend', preventDoubleTapZoom);
      }

      // Restore original viewport
      if (viewportMeta && originalViewport) {
        viewportMeta.setAttribute('content', originalViewport);
      }
    };
  }, []);

  const toggleFlash = useCallback(() => {
    setFlashOn((prev) => !prev);
    if (html5QrcodeRef.current) {
      try {
        const runtime = html5QrcodeRef.current as unknown as {
          getRunningTrack?: () => MediaStreamTrack | null | undefined;
        };
        const videoTrack = runtime.getRunningTrack?.();
        if (
          videoTrack &&
          typeof (videoTrack as MediaStreamTrack).applyConstraints ===
            "function"
        ) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (videoTrack as any).applyConstraints({
              advanced: [{ torch: !flashOn }],
            });
          } catch {
            // ignore failures applying torch constraint
          }
        }
      } catch {
        // Torch toggle failed or not supported
      }
    }
  }, [flashOn]);

  const stopCamera = useCallback(async () => {
    if (html5QrcodeRef.current && isMountedRef.current) {
      try {
        await html5QrcodeRef.current.stop();
      } catch {
        // Ignore stop errors during cleanup
      } finally {
        html5QrcodeRef.current = null;
      }
    }
    setCameraStarted(false);
  }, []);

  const handleScan = useCallback(
    async (data: string) => {
      if (
        !isMountedRef.current ||
        isLoading ||
        scanSuccess ||
        scanInProgressRef.current
      )
        return;

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
        console.error("Failed to send scan data");
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

        const reader = new FileReader();
        reader.onload = async (e) => {
          const imgDataUrl = e.target?.result;
          if (typeof imgDataUrl === "string") {
            try {
              const html5Qr = html5QrcodeRef.current;
              if (html5Qr) {
                const result = await html5Qr.scanFile(file, true);
                handleScan(result);
              }
            } catch {
              setScanError("Tidak dapat membaca kode dari gambar.");
            }
          }
          setIsLoading(false);
        };
        reader.readAsDataURL(file);
      } catch {
        setScanError("Gagal memproses gambar yang diupload.");
        setIsLoading(false);
      }
    },
    [handleScan]
  );

  useEffect(() => {
    setScanError(null);
    setScanSuccess(false);
    setLastScanData(null);
  }, [mode]);

  useEffect(() => {
    if (isHydrated && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoggedIn, isHydrated, router]);

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
      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length > 0) {
        setAvailableCameras(cameras);
        const rearCamera = cameras.find(
          (cam) =>
            cam.label.toLowerCase().includes("back") ||
            cam.label.toLowerCase().includes("rear") ||
            cam.label.toLowerCase().includes("environment")
        );
        return rearCamera?.id || cameras[0].id;
      }
    } catch (e) {
      console.error("Error getting cameras:", e);
    }
    return null;
  }, []);

  const startCamera = useCallback(async () => {
    if (!isMountedRef.current || initializationRef.current) return;

    initializationRef.current = true;

    try {
      await stopCamera();

      const cameraId = await getCameras();

      if (!cameraId) {
        throw new Error("Tidak ada kamera yang tersedia");
      }

      // Improved camera configuration for mobile devices
      const { Html5Qrcode } = await import("html5-qrcode");

      const containerId = scannerContainerRef.current?.id || "scanner-container";
      html5QrcodeRef.current = new Html5Qrcode(containerId);

      // Optimized configuration for mobile devices
      const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 }, // Fixed size untuk konsistensi
        aspectRatio: 1.0, // Square aspect ratio
        videoConstraints: {
          deviceId: { exact: cameraId },
          facingMode: "environment",
          // Use ideal constraints that work well on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
          // Important: Disable advanced features that cause zoom
          zoom: false,
          focusMode: "continuous",
        },
        supportedScanTypes: [
          Html5QrcodeScanType.SCAN_TYPE_CAMERA
        ],
      };

      await html5QrcodeRef.current.start(
        cameraId,
        config,
        (decodedText) => {
          if (!scanInProgressRef.current) {
            handleScan(decodedText);
          }
        },
        () => {
          // Empty error callback
        }
      );

      setCameraStarted(true);
      setScanError(null);
    } catch (e) {
      console.error("Camera start error:", e);
      if (isMountedRef.current) {
        if (e instanceof Error) {
          if (e.message.includes("Tidak ada kamera")) {
            setScanError(
              "Tidak ada kamera yang ditemukan. Pastikan perangkat memiliki kamera."
            );
          } else if (e.message.includes("Permission")) {
            setScanError(
              "Izin akses kamera ditolak. Silakan berikan izin kamera di browser."
            );
          } else {
            setScanError("Gagal mengakses kamera. Silakan coba lagi.");
          }
        } else {
          setScanError("Gagal mengakses kamera. Silakan coba lagi.");
        }
      }
    } finally {
      if (isMountedRef.current) {
        initializationRef.current = false;
      }
    }
  }, [getCameras, handleScan, stopCamera]);

  const handleRetryScan = () => {
    if (!isMountedRef.current) return;

    setScanError(null);
    setScanSuccess(false);
    setLastScanData(null);
    scanInProgressRef.current = false;

    startCamera();
  };

  useEffect(() => {
    isMountedRef.current = true;

    if (isHydrated && isLoggedIn) {
      const initTimer = setTimeout(() => {
        if (isMountedRef.current && !initializationRef.current) {
          startCamera();
        }
      }, 500);

      return () => {
        clearTimeout(initTimer);
      };
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [isHydrated, isLoggedIn, startCamera]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      initializationRef.current = false;
      scanInProgressRef.current = false;

      if (html5QrcodeRef.current) {
        html5QrcodeRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            html5QrcodeRef.current = null;
          });
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
        /* Prevent zoom and ensure proper mobile display */
        html, body {
          touch-action: pan-y pan-x;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
          overflow: hidden;
        }

        #scanner-container,
        #scanner-container .html5-qrcode,
        #scanner-container .html5-qrcode .html5-qrcode-camera__viewport,
        #scanner-container .html5-qrcode-element,
        #scanner-container .html5-qrcode-region {
          width: 100% !important;
          height: 100% !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
        }

        /* Improved mobile video display */
        #scanner-container video,
        #scanner-container canvas,
        #scanner-container .html5-qrcode .html5-qrcode-camera__viewport video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          background: black;
          transform: none !important;
          /* Prevent iOS safari from adding its own transforms */
          -webkit-transform: none !important;
        }

        /* Hide default qrbox border */
        .html5-qrcode-region-mark {
          display: none !important;
        }

        @keyframes scanline {
          0% {
            top: 15%;
          }
          100% {
            top: 85%;
          }
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

        /* Additional mobile-specific fixes */
        @media (max-width: 768px) {
          #scanner-container video {
            object-fit: cover !important;
            transform: none !important;
            -webkit-transform: none !important;
          }
        }
      `}</style>
      
      {/* Rest of your JSX remains the same */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center px-2 pt-3 pb-2 w-full z-40 bg-transparent"
        style={{
          backgroundColor: "transparent",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
        }}
      >
        <button
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back();
            }
          }}
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
            <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-lg z-900 py-2 w-44 flex flex-col">
              <button
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-gray-800 text-sm"
                onClick={() => {
                  setShowActions(false);
                  if (typeof toggleFlash === "function") toggleFlash();
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
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (typeof handleImageUpload === "function")
                        handleImageUpload(e);
                    }
                    e.target.value = "";
                  }}
                  aria-label="Unggah Gambar"
                  tabIndex={-1}
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Rest of your component remains the same */}
      <div
        className="w-full absolute top-0 text-white text-xs px-3 py-1 rounded-md font-medium shadow text-center"
        style={{ marginTop: 150, zIndex: 30 }}
      >
        Arahkan barcode ke dalam kotak
      </div>
      
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

        {/* Loading, Error, and Success states remain the same */}
        {!cameraStarted && !scanError && !scanSuccess && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-5"></div>
            <p className="text-white text-lg mb-1">Menyiapkan kamera...</p>
            {availableCameras.length > 0 && (
              <p className="text-white text-xs mt-2 opacity-60">
                {availableCameras.length} kamera tersedia
              </p>
            )}
          </div>
        )}

        {/* Error */}
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
                  onClick={() => router.push("/home")}
                  className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors font-medium text-sm"
                >
                  Kembali
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sukses */}
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

        {/* Mode selector buttons remain the same */}
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

      <div className="absolute bottom-0 left-0 right-0 z-30">
        <BottomNavigation />
      </div>
    </div>
  );
};
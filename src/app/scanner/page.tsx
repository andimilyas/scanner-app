"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useApp } from "@/app/context/AppContext";
import React, { useCallback, useEffect, useRef, useState, Suspense } from "react";
import BottomNavigation from "@/components/BottomNavigation";
import { ClipboardCheck, Scan, Camera, Upload } from "lucide-react";

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
  const mode = searchParams.get("mode") || "validation";
  const { setScanResult, setScanMode, user, isLoggedIn, isHydrated } = useApp();

  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState<boolean>(false);
  const [lastScanData, setLastScanData] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isCameraActive, setIsCameraActive] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScannedRef = useRef<string>("");
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const processingRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  // Prevent zoom on mobile
  useEffect(() => {
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    document.addEventListener("touchstart", preventZoom, { passive: false });
    document.addEventListener("touchmove", preventZoom, { passive: false });

    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const originalViewport = viewportMeta?.getAttribute("content");

    if (viewportMeta) {
      viewportMeta.setAttribute(
        "content",
        "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
      );
    }

    return () => {
      document.removeEventListener("touchstart", preventZoom);
      document.removeEventListener("touchmove", preventZoom);
      if (viewportMeta && originalViewport) {
        viewportMeta.setAttribute("content", originalViewport);
      }
    };
  }, []);

  // Redirect if not logged in
  useEffect(() => {
    if (isHydrated && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoggedIn, isHydrated, router]);

  // Reset states when mode changes
  useEffect(() => {
    setScanError(null);
    setScanSuccess(false);
    setLastScanData(null);
    lastScannedRef.current = "";
    processingRef.current = false;
  }, [mode]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  // Process scan result
  const processScan = useCallback(
    async (data: string) => {
      if (processingRef.current || isProcessing || scanSuccess) return;
      if (data === lastScannedRef.current) return;

      lastScannedRef.current = data;
      processingRef.current = true;
      setIsProcessing(true);
      setScanError(null);

      // Stop scanning while processing
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }

      try {
        setScanResult(data);
        setScanMode(mode as "validation" | "dispensing");

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
            errorMsg = result.error.includes("String or binary data would be truncated")
              ? "Kode terlalu panjang atau format tidak sesuai."
              : result.error;
          }

          stopCamera();
          setIsCameraActive(false);
          setScanError(errorMsg);

          processingRef.current = false;
          lastScannedRef.current = "";
          setIsProcessing(false);

          return;
        }

        setScanSuccess(true);
        setLastScanData(data);

        // setTimeout(() => {
        //   if (mountedRef.current) {
        //     router.push("/");
        //   }
        // }, 2500);
      } catch (error) {
        console.error("Scan error:", error);
        setScanError("Terjadi kesalahan koneksi. Silakan coba lagi.");
        processingRef.current = false;
        lastScannedRef.current = "";
        setIsProcessing(false);
      }
    },
    [mode, user, setScanMode, setScanResult, isProcessing, scanSuccess, stopCamera]
  );

  // Scan barcode from video
  const scanBarcode = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || processingRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    try {
      // Dynamic import jsQR
      const jsQR = (await import("jsqr")).default;
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code?.data) {
        await processScan(code.data);
      }
    } catch (error) {
      console.error("Barcode scan error:", error);
    }
  }, [processScan]);

  // Start camera
  const startCamera = useCallback(async () => {
    // Always stop first to avoid play() race
    stopCamera();
    try {
      const constraints = {
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current && mountedRef.current) {
        // Attach and wait for metadata before playing to avoid AbortError
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.setAttribute("webkit-playsinline", "true");

        const playPromise = new Promise<void>((resolve) => {
          const handler = () => {
            if (videoRef.current) {
              videoRef.current.removeEventListener("loadedmetadata", handler);
            }
            resolve();
          };
          if (videoRef.current && videoRef.current.readyState >= 1) {
            resolve();
          } else if (videoRef.current) {
            videoRef.current.addEventListener("loadedmetadata", handler);
          }
        });

        await playPromise;

        try {
          if (videoRef.current) {
            await videoRef.current.play();
          }
        } catch {
          // Defensive: some browsers may play automatically
        }
        setCameraReady(true);
        setScanError(null);

        // Start scanning
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
        }
        scanIntervalRef.current = setInterval(() => {
          if (mountedRef.current && !processingRef.current) {
            scanBarcode();
          }
        }, 300);
      }
    } catch (error) {
      console.error("Camera error:", error);
      if (mountedRef.current) {
        if (error instanceof Error) {
          if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
            setScanError("Izin kamera ditolak. Aktifkan izin kamera di browser.");
          } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
            setScanError("Kamera tidak ditemukan pada perangkat.");
          } else {
            setScanError("Gagal mengakses kamera. Coba refresh halaman.");
          }
        }
      }
    }
  }, [facingMode, scanBarcode, stopCamera]);


  // Handle image upload
  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || isProcessing) return;

      setIsProcessing(true);
      setScanError(null);

      try {
        const reader = new FileReader();
        reader.onload = async (loadEvent) => {
          const imgDataUrl = (loadEvent.target?.result || "") as string;

          const img = new window.Image();
          img.onload = async () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");

            if (!ctx) {
              setScanError("Gagal memproses gambar.");
              setIsProcessing(false);
              return;
            }

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const jsQR = (await import("jsqr")).default;
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code) {
              await processScan(code.data);
            } else {
              setScanError("Tidak dapat membaca barcode dari gambar.");
              setIsProcessing(false);
            }
          };
          img.src = imgDataUrl;
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error("Upload error:", error);
        setScanError("Gagal memproses gambar yang diupload.");
        setIsProcessing(false);
      }
    },
    [processScan, isProcessing]
  );

  const handleRetryScan = () => {
    setScanError(null);
    setScanSuccess(false);
    setLastScanData(null);
    lastScannedRef.current = "";
    processingRef.current = false;
    setIsProcessing(false);
    setIsCameraActive(true);
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    stopCamera();
    setTimeout(() => {
      startCamera();
    }, 100);
  };

  // Initialize camera
  useEffect(() => {
    mountedRef.current = true;

    if (isHydrated && isLoggedIn) {
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          startCamera();
        }
      }, 300);

      return () => {
        clearTimeout(timer);
      };
    }

    return () => {
      mountedRef.current = false;
    };
  }, [isHydrated, isLoggedIn, startCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (isCameraActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isCameraActive, startCamera, stopCamera]);

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
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center px-2 pt-3 pb-2 w-full z-40 bg-gradient-to-b from-black/60 to-transparent">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-white/10 transition"
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
            className="p-2 rounded-full hover:bg-white/10 transition"
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
              style={{ transform: "rotate(90deg)" }}
            >
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>

          {showActions && (
            <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-lg z-50 py-1 w-48 flex flex-col">
              <button
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-800 text-sm transition"
                onClick={() => {
                  setShowActions(false);
                  toggleCamera();
                }}
                type="button"
              >
                <Camera className="w-5 h-5" />
                <span>Ganti Kamera</span>
              </button>

              <label className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-800 text-sm cursor-pointer transition">
                <Upload className="w-5 h-5" />
                <span>Unggah Gambar</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  aria-label="Unggah Gambar"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-16 left-0 right-0 text-center z-30 px-4">
        <div className="inline-block bg-black/50 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full font-medium">
          Arahkan barcode ke dalam kotak
        </div>
      </div>

      {/* Scanner Container */}
      <div className="flex-1 relative overflow-hidden">
        {isCameraActive && (
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
        )}

        <canvas ref={canvasRef} className="hidden" />

        {/* Overlay with scan area */}
        {cameraReady && !scanSuccess && !scanError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="relative w-64 h-64 rounded-2xl border-4 border-white/30 shadow-2xl">
              {/* Corner decorations */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl"></div>

              {/* Scanning line animation */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-white to-transparent animate-scan-line"></div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {!cameraReady && !scanError && !scanSuccess && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mb-4"></div>
            <p className="text-white text-lg font-medium">Menyiapkan kamera...</p>
            <p className="text-white/60 text-sm mt-2">Mohon tunggu sebentar</p>
          </div>
        )}

        {/* Processing overlay */}
        {isProcessing && !scanSuccess && !scanError && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 shadow-xl">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mx-auto mb-3"></div>
              <p className="text-gray-800 font-medium">Memproses...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {scanError && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
            <div className="w-full max-w-sm p-6 bg-white rounded-2xl shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-6 h-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <p className="font-bold text-red-700 text-lg">Scan Gagal</p>
              </div>
              <p className="text-gray-700 mb-6 leading-relaxed">{scanError}</p>
              <button
                onClick={handleRetryScan}
                className="w-full px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold shadow-lg"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        )}

        {/* Success state */}
        {scanSuccess && lastScanData && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-sm p-6 bg-white rounded-2xl shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-7 h-7 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="font-bold text-green-700 text-lg">Scan Berhasil!</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-green-100">
                <p className="text-xs text-gray-600 font-semibold mb-2">Kode Scan:</p>
                <p className="font-mono text-sm bg-white p-3 rounded-lg break-all border-2 border-green-200 text-green-700 font-semibold">
                  {lastScanData}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Mode selector */}
        {cameraReady && !scanSuccess && !scanError && (
          <div className="absolute left-0 bottom-50 right-0 flex justify-center items-center z-40 px-4">
            <div className="w-full max-w-md flex bg-white/95 backdrop-blur-sm rounded-2xl p-1 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setScanMode("validation");
                  router.push("/scanner?mode=validation");
                }}
                className={`flex-1 py-3 px-4 font-semibold text-sm transition-all duration-200 rounded-xl ${
                  mode === "validation"
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "text-indigo-600 hover:bg-indigo-50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <ClipboardCheck className="w-5 h-5" />
                  <span>Validasi</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanMode("dispensing");
                  router.push("/scanner?mode=dispensing");
                }}
                className={`flex-1 py-3 px-4 font-semibold text-sm transition-all duration-200 rounded-xl ${
                  mode === "dispensing"
                    ? "bg-green-600 text-white shadow-lg"
                    : "text-green-600 hover:bg-green-50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Scan className="w-5 h-5" />
                  <span>Pemberian</span>
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

      <style jsx global>{`
        @keyframes scan-line {
          0% {
            top: 0;
          }
          100% {
            top: 100%;
          }
        }

        .animate-scan-line {
          animation: scan-line 2s ease-in-out infinite;
        }

        html, body {
          touch-action: pan-y pan-x;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
          overflow: hidden;
        }

        video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
    </div>
  );
};
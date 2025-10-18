"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useApp } from "@/app/context/AppContext";
import { Html5Qrcode } from "html5-qrcode";
import React, { useCallback, useEffect, useRef, useState, Suspense } from "react";
import BottomNavigation from "@/components/BottomNavigation";

export default function ScannerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    }>
      <ScannerContent />
    </Suspense>
  );
}

const ScannerContent: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = searchParams.get("mode");
  const { scanResult, scanMode, setScanResult, setScanMode, user, isLoggedIn, isHydrated } = useApp();
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState<boolean>(false);
  const [lastScanData, setLastScanData] = useState<{ result: string, mode: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef(true);
  const scanInProgressRef = useRef(false);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef<boolean>(false);

  // For handling flash toggle and flash state
  const [flashOn, setFlashOn] = useState(false);

  const toggleFlash = useCallback(() => {
    setFlashOn((prev) => !prev);
    // If camera and torch supported, toggle flashlight (torch mode)
    if (html5QrcodeRef.current) {
      // html5-qrcode supports controlling the torch via setTorchOn if implemented
      // See https://github.com/mebjas/html5-qrcode/issues/433
      // html5QrcodeRef.current.getRunningTrackSettings() is non-standard API and may need feature detection
      try {
        // Enable or disable the torch if the track supports it (on Chrome/Android)
        const tracks = (html5QrcodeRef.current as any)?.getRunningTrackSettings?.();
        const videoTrack = (html5QrcodeRef.current as any)?.getRunningTrack?.();
        if (videoTrack && typeof videoTrack.applyConstraints === "function") {
          videoTrack.applyConstraints({
            advanced: [{ torch: !flashOn }],
          });
        }
      } catch (e) {
        // Torch toggle failed or not supported
      }
    }
  }, [flashOn]);

  const handleScan = useCallback(async (data: string) => {
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
          errorMsg = result.error.includes("String or binary data would be truncated")
            ? "Kode yang dipindai terlalu panjang atau tidak sesuai format. Silakan periksa barcode dan coba lagi."
            : result.error;
        }
        setScanError(errorMsg);
        return;
      }

      setScanSuccess(true);
      setLastScanData({ result: data, mode: mode as string });

      // Stop scanner after successful scan
      await stopCamera();
    } catch (err) {
      console.error("Failed to send scan data:", err);
      setScanError("Terjadi kesalahan pada server. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
      scanInProgressRef.current = false;
    }
  }, [mode, user, setScanMode, setScanResult, isLoading, scanSuccess]);

  // For handling image file uploads
  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setIsLoading(true);
      setScanError(null);

      try {
        // Stop scanner before scanning image
        if (html5QrcodeRef.current) {
          await html5QrcodeRef.current.stop();
        }

        // Scan the uploaded image
        const reader = new FileReader();
        reader.onload = async (e) => {
          const imgDataUrl = e.target?.result;
          if (typeof imgDataUrl === "string") {
            try {
              // Html5Qrcode can't directly scan base64, but it can take a File object
              const html5Qr = html5QrcodeRef.current;
              if (html5Qr) {
                const result = await html5Qr.scanFile(file, true);
                handleScan(result);
              }
            } catch (err: any) {
              setScanError("Tidak dapat membaca kode dari gambar.");
            }
          }
          setIsLoading(false);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        setScanError("Gagal memproses gambar yang diupload.");
        setIsLoading(false);
      }
    },
    [handleScan]
  );

  // Reset states when mode changes
  useEffect(() => {
    setScanError(null);
    setScanSuccess(false);
    setLastScanData(null);
  }, [mode]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (isHydrated && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoggedIn, isHydrated, router]);

  // Auto redirect after success
  useEffect(() => {
    if (scanSuccess) {
      const timer = setTimeout(() => {
        router.push("/");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [scanSuccess, router]);


  const stopCamera = async () => {
    if (html5QrcodeRef.current && isMountedRef.current) {
      try {
        await html5QrcodeRef.current.stop();
      } catch (err) {
        // Ignore stop errors during cleanup
      } finally {
        html5QrcodeRef.current = null;
      }
    }
    setCameraStarted(false);
  };

  const getCameras = async (): Promise<string | null> => {
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length > 0) {
        setAvailableCameras(cameras);
        // Prioritize rear camera, then use first available camera
        const rearCamera = cameras.find(cam =>
          cam.label.toLowerCase().includes('back') ||
          cam.label.toLowerCase().includes('rear') ||
          cam.label.toLowerCase().includes('environment')
        );
        return rearCamera?.id || cameras[0].id;
      }
    } catch (err) {
      console.error("Error getting cameras:", err);
    }
    return null;
  };

  const startCamera = async () => {
    if (!isMountedRef.current || initializationRef.current) return;

    initializationRef.current = true;

    try {
      await stopCamera();

      // Get camera ID first
      const cameraId = await getCameras();

      if (!cameraId) {
        throw new Error("Tidak ada kamera yang tersedia");
      }

      html5QrcodeRef.current = new Html5Qrcode("scanner-container");

      const config = {
        fps: 10,
        qrbox: {
          width: Math.min(280, window.innerWidth - 40),
          height: Math.min(180, window.innerHeight - 200)
        },
        aspectRatio: window.innerWidth / window.innerHeight,
      };

      await html5QrcodeRef.current.start(
        cameraId, // Now cameraId is guaranteed to be a string
        config,
        (decodedText) => {
          // Debounce manual untuk prevent multiple rapid scans
          if (!scanInProgressRef.current) {
            handleScan(decodedText);
          }
        },
        () => {
          // Empty error callback - suppress all console errors
        }
      );

      setCameraStarted(true);
      setScanError(null);

    } catch (err) {
      console.error("Camera start error:", err);
      if (isMountedRef.current) {
        if (err instanceof Error) {
          if (err.message.includes("Tidak ada kamera")) {
            setScanError("Tidak ada kamera yang ditemukan. Pastikan perangkat memiliki kamera.");
          } else if (err.message.includes("Permission")) {
            setScanError("Izin akses kamera ditolak. Silakan berikan izin kamera di browser.");
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
  };

  const handleRetryScan = () => {
    if (!isMountedRef.current) return;

    setScanError(null);
    setScanSuccess(false);
    setLastScanData(null);
    scanInProgressRef.current = false;

    startCamera();
  };

  // Initialize scanner
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
  }, [isHydrated, isLoggedIn]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      initializationRef.current = false;
      scanInProgressRef.current = false;

      // Cleanup without async/await untuk prevent memory leaks
      if (html5QrcodeRef.current) {
        html5QrcodeRef.current.stop().catch(() => { }).finally(() => {
          html5QrcodeRef.current = null;
        });
      }
    };
  }, []);

  // Show loading while hydrating or camera starting
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
      <div
        className="absolute top-0 left-0 right-0 flex items-center px-2 pt-3 pb-2 w-full z-40 bg-transparent"
        style={{
          backgroundColor: "transparent",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
        }}
      >

        {/* Back Button */}
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
        {/* Title */}
        <div className="flex-1 text-center">
          <span className="text-white font-semibold text-base select-none">
            {mode === "validation" ? "Validasi Kemasan" : "Pemberian Obat"}
          </span>
        </div>
        {/* Action Buttons */}
        <div className="flex gap-1 items-center">
          {/* Upload Button */}
          <label className="p-2 rounded-full hover:bg-black/10 transition cursor-pointer flex items-center">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  if (typeof handleImageUpload === "function") handleImageUpload(e);
                }
                e.target.value = "";
              }}
              aria-label="Unggah Gambar"
            />
            {/* Upload/Photo SVG */}
            <svg
              width="22"
              height="22"
              fill="none"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <circle cx="12" cy="13" r="3" />
              <path d="M15.5 8.5h.01" />
            </svg>
          </label>
          {/* Flashlight Button */}
          <button
            className={`p-2 rounded-full flex items-center justify-center hover:bg-black/10 transition ${flashOn ? "bg-yellow-400/20" : ""}`}
            aria-label="Toggle Flashlight"
            onClick={() => {
              if (typeof toggleFlash === "function") toggleFlash();
            }}
          >
            {/* Flash SVG, colored if on */}
            <svg
              width="23"
              height="23"
              viewBox="0 0 24 24"
              fill={flashOn ? "#fde047" : "none"}
              stroke={flashOn ? "#fde047" : "white"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 2v11h3v9l7-12h-4l4-8z" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <div
          id="scanner-container"
          ref={scannerContainerRef}
          className="w-full h-full absolute inset-0 z-10"
        />

        {cameraStarted && !scanSuccess && (
          <div className="absolute inset-0 z-20">
            {/* Area scanner */}
            <div
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
              style={{ width: 320, height: 320 }} // Increased size
            >

              {/* Garis scan animasi */}
              <div
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-indigo-400 via-indigo-300 to-indigo-400 shadow-md rounded"
                style={{
                  animation: "scanline 1.8s ease-in-out infinite alternate", // Adjusted animation duration
                }}
              ></div>

              <style jsx>{`
              @keyframes scanline {
                0% {
                  top: 15%; // Adjusted starting position
                }
                100% {
                  top: 85%; // Adjusted ending position
                }
              }
            `}</style>
            </div>            
          </div>

        )}

        {/* Loading Kamera */}
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
                  onClick={() => router.push("/")}
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

        {cameraStarted && !scanSuccess && (
          <div className="absolute bottom-30 left-0 right-0 flex justify-center items-center z-40 px-4">
            <div className="w-full max-w-md flex bg-white rounded-xl p-1 shadow-md">
              <button
                onClick={() => {
                  if (scanMode !== "validation") {
                    setScanMode("validation");
                    router.push("/scanner?mode=validation");
                  }
                }}
                className={`flex-1 py-3 font-semibold text-base transition-all duration-200 ${scanMode === "validation"
                    ? "bg-indigo-600 text-white rounded-xl"
                    : "text-indigo-600"
                  }`}
              >
                Validasi
              </button>
              <button
                onClick={() => {
                  if (scanMode !== "dispensing") {
                    setScanMode("dispensing");
                    router.push("/scanner?mode=dispensing");
                  }
                }}
                className={`flex-1 py-3 font-semibold text-base transition-all duration-200 ${scanMode === "dispensing"
                    ? "bg-indigo-600 text-white rounded-xl"
                    : "text-indigo-600"
                  }`}
              >
                Pemberian
              </button>
            </div>
            <div className="w-full absolute bottom-[130%] text-white text-xs px-3 py-1 rounded-md font-medium shadow text-center">
              Arahkan barcode ke dalam kotak
            </div>
          </div>
        )}
      </div>
      {/* Footer Navigation (tetap tampil di bawah z-30) */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        <BottomNavigation />
      </div>
    </div>
  );
};
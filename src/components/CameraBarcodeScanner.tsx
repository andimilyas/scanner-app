"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface CameraBarcodeScannerProps {
  active: boolean;
  onScan: (code: string) => void;
  disabled?: boolean;
  accent?: "indigo" | "green";
}

const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({
  active,
  onScan,
  disabled = false,
  accent = "indigo",
}) => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const processingRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setReady(false);
  }, []);

  const scanFrame = useCallback(async () => {
    if (
      !active ||
      disabled ||
      processingRef.current ||
      !videoRef.current ||
      !canvasRef.current
    ) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const roiSize = Math.floor(Math.min(canvas.width, canvas.height) * 0.65);
    const roiX = Math.floor((canvas.width - roiSize) / 2);
    const roiY = Math.floor((canvas.height - roiSize) / 2);
    const imageData = ctx.getImageData(roiX, roiY, roiSize, roiSize);

    try {
      const jsQR = (await import("jsqr")).default;
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      if (code?.data) {
        processingRef.current = true;
        onScan(code.data);
        setTimeout(() => {
          processingRef.current = false;
        }, 800);
      }
    } catch (err) {
      console.error("Camera decode error:", err);
    }
  }, [active, disabled, onScan]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await new Promise<void>((resolve) => {
          const v = videoRef.current!;
          if (v.readyState >= 1) resolve();
          else v.addEventListener("loadedmetadata", () => resolve(), { once: true });
        });
        await videoRef.current.play().catch(() => undefined);
        setReady(true);
        intervalRef.current = setInterval(() => {
          if (mountedRef.current && !disabled) void scanFrame();
        }, 200);
      }
    } catch (err) {
      console.error("Camera error:", err);
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setError("Izin kamera ditolak. Aktifkan di pengaturan browser.");
        } else if (err.name === "NotFoundError") {
          setError("Kamera tidak ditemukan.");
        } else {
          setError("Gagal mengakses kamera.");
        }
      } else {
        setError("Gagal mengakses kamera.");
      }
    }
  }, [stopCamera, scanFrame, disabled]);

  useEffect(() => {
    mountedRef.current = true;
    if (active && !disabled) {
      const t = setTimeout(() => {
        if (mountedRef.current) void startCamera();
      }, 200);
      return () => {
        clearTimeout(t);
        mountedRef.current = false;
        stopCamera();
      };
    }
    stopCamera();
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [active, disabled, startCamera, stopCamera]);

  const ring =
    accent === "green" ? "border-green-400/80" : "border-indigo-400/80";

  return (
    <div className="relative w-full aspect-[4/3] max-h-[280px] bg-gray-900 rounded-xl overflow-hidden shadow-inner">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`relative w-48 h-48 rounded-xl border-2 ${ring} shadow-lg overflow-hidden`}
          >
            <div className="camera-scan-line absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent" />
          </div>
        </div>
      )}

      {!ready && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Menyiapkan kamera...</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-4 bg-gray-900/90">
          <p className="text-sm text-red-200 text-center">{error}</p>
        </div>
      )}

      {ready && !error && (
        <p className="absolute bottom-2 left-0 right-0 text-center text-white/90 text-xs px-2">
          Arahkan barcode ke dalam kotak
        </p>
      )}

    </div>
  );
};

export default CameraBarcodeScanner;

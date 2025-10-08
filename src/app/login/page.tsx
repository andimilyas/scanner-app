"use client";
import React, { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { QrCode } from "lucide-react";
import { useApp } from "@/app/context/AppContext";

export default function LoginPage() {
  const { setIsLoggedIn, setScanResult, setUser, isHydrated, isLoggedIn } = useApp();
  const [no_absen, setNo_absen] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [formError, setFormError] = useState<string>("");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isHydrated && isLoggedIn) {
      console.log('Redirecting to home from login');
      router.push("/home");
    }
  }, [isHydrated, isLoggedIn, router]);

  // Redirect to home if already logged in (only after hydration)
  useEffect(() => {
    if (isHydrated && localStorage.getItem('scanner_app_session')) {
      router.push("/home");
    }
  }, [isHydrated, router]);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError("");
    
    // Clear sensitive data from form after submission
    const formData = { no_absen: no_absen, password };
    
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest" // Add security header
        },
        body: JSON.stringify(formData),
      });
      
      let result;
      try {
        result = await response.json();
      } catch (err) {
        setFormError("Terjadi kesalahan pada server. Silakan coba lagi.");
        return;
      }
      
      if (result.success) {
        setIsLoggedIn(true);
        setUser(result.user);
        setScanResult(null);
        router.push("/home");
      } else {
        setFormError(result.message || "Login gagal");
      }
    } catch (error) {
      console.error("Login error:", error);
      setFormError("Terjadi kesalahan saat login");
    } finally {
      setIsLoading(false);
      // Clear sensitive data from memory
      formData.password = "";
    }
  };

  // Show loading while hydrating
  if (!isHydrated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-xl">
        <div className="flex flex-col items-center mb-6">
          <img
            src="https://apps.rsudpasarrebo.id/img/logo.png"
            alt="RSUD Pasar Rebo Logo"
            className="w-38 h-38"
            style={{ objectFit: "contain" }}
          />
          <div className="flex flex-col items-center justify-center w-full text-center">
            <h2 className="text-3xl font-bold text-gray-800">Selamat Datang</h2>
            <p className="text-sm text-gray-500 mt-1 mb-8">Masuk untuk memulai proses scanning.</p>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            let errorMsg = "";
            if (!/^\d{4}$/.test(no_absen)) {
              errorMsg = "No Absen harus terdiri dari 4 angka.";
            } else if (password.length === 0) {
              errorMsg = "Password tidak boleh kosong.";
            }
            if (errorMsg) {
              setFormError(errorMsg);
              return;
            }
            setFormError("");
            handleLogin(e);
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="no_absen" className="block text-sm font-medium text-gray-700 mb-1">
              No Absen
            </label>
            <input
              id="no_absen"
              type="text"
              value={no_absen}
              onChange={(e) => {
                // Only allow numbers and max 4 digits
                const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                setNo_absen(val);
                setFormError("");
              }}
              className={`w-full p-3 border rounded-xl text-black ${formError && formError.includes("No Absen") ? "border-red-500" : ""}`}
              placeholder="1234"
              required
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              autoComplete="off"
            />
            {formError && formError.includes("No Absen") && (
              <p className="text-xs text-red-600 mt-1">{formError}</p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFormError("");
              }}
              className={`w-full p-3 border rounded-xl text-black ${formError && formError.includes("Password") ? "border-red-500" : ""}`}
              placeholder="********"
              required
              autoComplete="off"
            />
            {formError && formError.includes("Password") && (
              <p className="text-xs text-red-600 mt-1">{formError}</p>
            )}
          </div>
          {formError && !formError.includes("No Absen") && !formError.includes("Password") && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{formError}</p>
            </div>
          )}
          <button
            type="submit"
            className={`w-full py-3 px-4 font-semibold rounded-xl transition-colors ${
              isLoading
                ? "bg-indigo-400 text-white cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin mr-2 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  ></path>
                </svg>
                Memproses...
              </span>
            ) : (
              "Masuk"
            )}
          </button>
        </form>
      </div>
      <div className="mt-12 flex flex-col items-center text-gray-400 text-xs">
        <span>Scanner Apotek</span>
        <span className="mt-1">v1.0.0</span>
      </div>
    </div>
  );
}

"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/app/context/AppContext";

export default function RootPage() {
  const { isHydrated } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated) {
      // Check if user is logged in
      const savedSession = localStorage.getItem('scanner_app_session');
      if (savedSession) {
        try {
          const sessionData = JSON.parse(savedSession);
          if (sessionData.isLoggedIn && sessionData.user) {
            router.push("/home");
            return;
          }
        } catch (error) {
          console.error('Error parsing session:', error);
        }
      }
      // Redirect to login if not logged in
      router.push("/login");
    }
  }, [isHydrated, router]);

  // Show loading while hydrating
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );
}

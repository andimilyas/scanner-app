"use client";
import React, { useEffect, useState } from "react";
import { useApp } from "@/app/context/AppContext";
import { useRouter } from "next/navigation";
import BottomNavigation from "@/components/BottomNavigation";
import { Logout } from "@mui/icons-material";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";

function ProfilePage() {
  const { user, isLoggedIn, logout, isHydrated } = useApp();
  const router = useRouter();
  const [openLogoutDialog, setOpenLogoutDialog] = useState(false);

  // Redirect to login if not authenticated (only after hydration)
  useEffect(() => {
    if (isHydrated && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoggedIn, isHydrated, router]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

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
      <div className="flex flex-col items-center flex-1 w-full min-h-screen">
        <div className="w-full max-w-lg mx-auto flex flex-col items-center min-h-screen bg-white rounded-b-2xl shadow-lg overflow-hidden p-0">
          {/* Profile Header */}
          <div className="w-full bg-gradient-to-r from-indigo-600 to-blue-500 flex flex-col items-center justify-center py-8 mb-4 rounded-b-2xl">
            <div className="w-20 h-20 rounded-full bg-white border-4 border-indigo-200 flex items-center justify-center mb-2 shadow">
              <span className="text-3xl font-bold text-indigo-600">
                {user?.name?.[0]?.toUpperCase()}
              </span>
            </div>
            <div className="text-white text-lg font-bold">{user?.name}</div>
            <div className="w-full text-center text-sm">
              No. Absen: <span className="font-mono">{user?.no_absen}</span>
            </div>
          </div>

          {/* Menu List */}
          <div className="w-full flex-1 px-4">
            <div className="bg-white rounded-xl shadow mb-4 divide-y divide-gray-100">
              <button
                onClick={() => router.push("/history")}
                className="flex items-center w-full py-4 px-3 hover:bg-indigo-50 transition group"
              >
                <svg
                  className="w-6 h-6 text-indigo-500 mr-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <rect x="4" y="4" width="16" height="16" rx="3" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 10h8M8 14h5"
                  />
                </svg>
                <span className="flex-1 text-left text-gray-800 font-medium">
                  Riwayat Pemindaian
                </span>
                <svg
                  className="w-4 h-4 text-gray-300 group-hover:text-indigo-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
              <button
                onClick={() => setOpenLogoutDialog(true)}
                className="flex items-center w-full py-4 px-3 hover:bg-red-50 transition group"
              >
                <Logout className="text-red-600 mr-3" />
                <span className="flex-1 text-left text-red-600 font-medium">
                  Keluar
                </span>
              </button>
              <Dialog
                PaperProps={{
                  style: {
                    borderRadius: 8,
                  },
                }}
                open={openLogoutDialog}
                onClose={() => setOpenLogoutDialog(false)}
              >
                <DialogTitle>Konfirmasi Keluar</DialogTitle>
                <DialogContent>
                  <DialogContentText>
                    Apakah Anda yakin ingin keluar dari aplikasi?
                  </DialogContentText>
                </DialogContent>
                <DialogActions style={{ padding: 24 }}>
                  <Button
                    onClick={() => setOpenLogoutDialog(false)}
                    color="primary"
                    style={{ textTransform: "none" }}
                  >
                    Batal
                  </Button>
                  <Button
                    style={{ borderRadius: 8, textTransform: "none" }}
                    onClick={() => {
                      setOpenLogoutDialog(false);
                      handleLogout();
                    }}
                    color="error"
                    variant="contained"
                  >
                    Keluar
                  </Button>
                </DialogActions>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
      <BottomNavigation />
    </div>
  );
}

export default ProfilePage;

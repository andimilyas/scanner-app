import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { QrCode, Home, ClipboardCheck, Scan } from "lucide-react";
import Drawer from "@mui/material/Drawer";


const BottomNavigation: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="flex justify-between items-center max-w-md mx-auto px-8 py-2">
        {/* Home */}
        <button
          onClick={() => router.push("/home")}
          className={`flex flex-col items-center transition ${pathname === "/" || pathname.startsWith("/home") ? "text-indigo-600" : "text-gray-500 hover:text-indigo-600"}`}
        >
          <Home className="h-7 w-7 mb-1" />
          <span className="text-xs font-medium">Beranda</span>
        </button>

        {/* Scan (center, prominent) */}
        <button
          onClick={handleDrawerOpen}
          className="relative -mt-8 bg-indigo-600 rounded-full aspect-square w-20 h-20 p-3 shadow-lg border-4 border-white flex flex-col items-center justify-center text-white hover:bg-indigo-700 transition "
          style={{ boxShadow: "0 4px 16px rgba(99,102,241,0.15)" }}
        >
          <QrCode size={48} />
          <span className="text-xs font-medium">Scan</span>
        </button>

        {/* Profile */}
        <button
          onClick={() => router.push("/profile")}
          className={`flex flex-col items-center transition ${pathname.startsWith("/profile") ? "text-indigo-600" : "text-gray-500 hover:text-indigo-600"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="9" r="3" strokeWidth={2} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 19c0-2.5 2.5-4 6-4s6 1.5 6 4" />
          </svg>
          <span className="text-xs font-medium">Akun</span>
        </button>        

        <Drawer
          anchor="bottom"
          open={open}
          onClose={handleDrawerClose}
          PaperProps={{
            sx: {
              width: "100%",
              maxWidth: "32rem",
              marginLeft: "auto",
              marginRight: "auto",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
            },
          }}
        >
        {/* Isi drawer di sini */}
        <div className="w-full max-w-lg mx-auto px-4 py-4">
          <div className="w-12 h-1 rounded-full bg-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-2 text-gray-800">Pilih Mode Pemindaian</h3>
          <button
            onClick={() => {
              setOpen(false);
              router.push("/scanner?mode=validation");
            }}
            className="w-full p-4 mb-3 bg-white border border-indigo-200 rounded-xl shadow hover:shadow-md flex items-center gap-3 transition"
          >
            <span className="flex items-center justify-center rounded-full bg-indigo-100/70" style={{ width: 40, height: 40 }}>
              <ClipboardCheck className="w-6 h-6 text-indigo-600" />
            </span>
            <div className="flex flex-col items-start">
              <span className="font-semibold text-indigo-700">Validasi Kemasan Resep</span>
              <span className="text-xs text-gray-500 text-left">Pindai barcode kemasan obat untuk verifikasi resep.</span>
            </div>
          </button>
          <button
            onClick={() => {
              setOpen(false);
              router.push("/scanner?mode=dispensing");
            }}
            className="w-full p-4 bg-white border border-green-200 rounded-xl shadow hover:shadow-md flex items-center gap-3 transition"
          >
            <span className="flex items-center justify-center rounded-full bg-green-100/70" style={{ width: 40, height: 40 }}>
              <Scan className="w-6 h-6 text-green-600" />
            </span>
            <div className="flex flex-col items-start">
              <span className="font-semibold text-green-700">Pemberian Obat ke Pasien</span>
              <span className="text-xs text-gray-500 text-left">Pindai kode pasien/resep untuk mencatat pemberian.</span>
            </div>
          </button>
        </div>
        </Drawer>
      </div>
    </nav>
  );
};

export default BottomNavigation;
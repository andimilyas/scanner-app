import React from "react";

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  isLoggedIn?: boolean;
  currentPage?: string;
  handleLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  onBack,
}) => (
  <div className="flex items-center justify-between p-4 bg-white shadow-md">
    {showBack ? (
      <button
        onClick={
          onBack
            ? onBack
            : () => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                window.history.back();
              }
            }
        }
        className="p-1 rounded-full text-indigo-600 hover:bg-indigo-50"
        aria-label="Kembali"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-arrow-left"
        >
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
      </button>
    ) : (
      <div className="w-6" />
    )}
    <h1 className="text-xl font-semibold text-gray-800 text-center flex-1">
      {title}
    </h1>
  </div>
);

export default Header;

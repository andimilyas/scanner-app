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
            width="24"
            height="24"
            fill="none"
            stroke="#6366f1"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d="M15 18l-6-6 6-6" />
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

import React from "react";

const LoadingOverlay: React.FC = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
    <div className="flex flex-col items-center p-4 bg-white rounded-xl shadow-2xl">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent border-solid rounded-full animate-spin"></div>
      <p className="mt-3 text-gray-700 font-medium">Memproses data...</p>
    </div>
  </div>
);

export default LoadingOverlay;

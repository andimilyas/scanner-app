import "./globals.css";
import { AppProvider } from "./context/AppContext"

export const metadata = {
  title: "Scanner Apotek",
  description: "Aplikasi Scanner Apotek",
};

import { ReactNode } from "react";

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}

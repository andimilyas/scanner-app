"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction } from "react";

type ScanMode = "validation" | "dispensing" | null;

interface User {
  no_absen: string;
  name?: string;
  role?: string;
}

interface AppContextType {
  isLoggedIn: boolean;
  setIsLoggedIn: Dispatch<SetStateAction<boolean>>;
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  scanMode: ScanMode;
  setScanMode: Dispatch<SetStateAction<ScanMode>>;
  scanResult: string | null;
  setScanResult: Dispatch<SetStateAction<string | null>>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  isHydrated: boolean;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Ensure hydration completes even if session restoration fails
  useEffect(() => {
    const initializeApp = () => {
      try {
        const savedSession = sessionStorage.getItem('scanner_app_session');

        if (savedSession) {
          const sessionData = JSON.parse(savedSession);
          const SESSION_EXPIRY = 8 * 60 * 60 * 1000;

          // Check session expiry
          if (sessionData.timestamp && (Date.now() - sessionData.timestamp) > SESSION_EXPIRY) {
            sessionStorage.removeItem('scanner_app_session');
            setIsLoggedIn(false);
          } else if (sessionData.isLoggedIn && sessionData.user) {
            setIsLoggedIn(true);
            setUser(sessionData.user);
            if (sessionData.scanResult) setScanResult(sessionData.scanResult);
            if (sessionData.scanMode) setScanMode(sessionData.scanMode);
            console.log('Session restored successfully');
          } else {
            setIsLoggedIn(false);
          }
        } else {
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error('Error loading session:', error);
        sessionStorage.removeItem('scanner_app_session');
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
        setIsHydrated(true); // Ensure hydration completes
      }
    };

    initializeApp();
  }, []);

  // Add loading state management for smoother transitions
  useEffect(() => {
    if (isLoading) {
      console.log('Loading state active');
    } else {
      console.log('Loading state inactive');
    }
  }, [isLoading]);

  // Save session to localStorage whenever state changes
  useEffect(() => {
    if (!isHydrated) return; // Avoid saving before hydration
    if (typeof window !== 'undefined') {
      const sessionData = {
        isLoggedIn,
        user,
        scanResult,
        scanMode,
        timestamp: Date.now()
      };
      
      if (isLoggedIn) {
        sessionStorage.setItem('scanner_app_session', JSON.stringify(sessionData));
      } else {
        sessionStorage.removeItem('scanner_app_session');
      }
    }
  }, [isLoggedIn, user, scanResult, scanMode, isHydrated]);

  // Logout function
  const logout = () => {
    setIsLoggedIn(false);
    setUser(null);
    setScanResult(null);
    setScanMode(null);
    setIsLoading(false);
    
    // Clear localStorage
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('scanner_app_session');
    }
    
    // Log logout event
    console.log('User logged out successfully');
  };

  return (
    <AppContext.Provider
      value={{
        isLoggedIn,
        setIsLoggedIn,
        user,
        setUser,
        scanMode,
        setScanMode,
        scanResult,
        setScanResult,
        isLoading,
        setIsLoading,
        isHydrated,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

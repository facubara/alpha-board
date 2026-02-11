"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { LoginModal } from "./login-modal";

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  requireAuth: (callback: () => void) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp("(^| )" + name + "=([^;]+)")
  );
  return match ? match[2] : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof document === "undefined") return false;
    return getCookie("auth_status") === "1";
  });
  const [showModal, setShowModal] = useState(false);
  const pendingCallback = useRef<(() => void) | null>(null);

  const login = useCallback(async (password: string): Promise<boolean> => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setIsAuthenticated(false);
  }, []);

  const requireAuth = useCallback(
    (callback: () => void) => {
      if (isAuthenticated) {
        callback();
        return;
      }
      pendingCallback.current = callback;
      setShowModal(true);
    },
    [isAuthenticated]
  );

  const handleLoginSuccess = useCallback(() => {
    setShowModal(false);
    const cb = pendingCallback.current;
    pendingCallback.current = null;
    if (cb) cb();
  }, []);

  const handleModalClose = useCallback(() => {
    setShowModal(false);
    pendingCallback.current = null;
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, requireAuth }}>
      {children}
      {showModal && (
        <LoginModal
          onLogin={async (password) => {
            const success = await login(password);
            if (success) handleLoginSuccess();
            return success;
          }}
          onClose={handleModalClose}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

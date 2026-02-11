"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

interface LoginModalProps {
  onLogin: (password: string) => Promise<boolean>;
  onClose: () => void;
}

export function LoginModal({ onLogin, onClose }: LoginModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || loading) return;

    setLoading(true);
    setError("");
    const success = await onLogin(password);
    if (!success) {
      setError("Invalid password");
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-6 shadow-lg">
        <h2 className="mb-1 text-sm font-semibold text-primary">
          Authentication Required
        </h2>
        <p className="mb-4 text-xs text-secondary">
          Enter the admin password to perform this action.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="border-[var(--border-default)] bg-[var(--bg-surface)] font-mono text-sm text-primary"
          />

          {error && (
            <p className="text-xs text-bearish">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-secondary transition-colors-fast hover:text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!password || loading}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm font-medium text-primary transition-colors-fast hover:bg-[var(--bg-elevated)] disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Login"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

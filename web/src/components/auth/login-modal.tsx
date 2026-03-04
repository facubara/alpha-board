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
      role="dialog"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div className="w-full max-w-sm rounded-none border border-void-border bg-void p-6">
        <h2 className="mb-1 text-sm font-semibold text-text-primary">
          Authentication Required
        </h2>
        <p className="mb-4 text-xs text-text-secondary">
          Enter the admin password to perform this action.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="border-void-border bg-void-surface font-mono text-sm text-text-primary"
          />

          {error && (
            <p className="text-xs text-data-loss">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-none px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors-fast hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!password || loading}
              className="rounded-none border border-void-border bg-void-surface px-3 py-1.5 text-sm font-medium text-text-primary transition-colors-fast hover:bg-void-muted disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Login"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

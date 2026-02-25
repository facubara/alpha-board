"use client";

/**
 * Exchange Settings — Configure Binance API keys for copy-trade execution.
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type { ExchangeSettings } from "@/lib/types";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

export function ExchangeSettingsSection() {
  const { requireAuth } = useAuth();
  const [settings, setSettings] = useState<ExchangeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Form state
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [tradingMode, setTradingMode] = useState<"spot" | "futures" | "both">(
    "futures"
  );
  const [maxPositionUsd, setMaxPositionUsd] = useState("100");
  const [defaultLeverage, setDefaultLeverage] = useState("1");
  const [enabled, setEnabled] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${WORKER_URL}/exchange/settings`);
      const data: ExchangeSettings = await res.json();
      setSettings(data);
      if (data.configured) {
        setTradingMode(data.tradingMode || "futures");
        setMaxPositionUsd(String(data.maxPositionUsd || 100));
        setDefaultLeverage(String(data.defaultLeverage || 1));
        setEnabled(data.enabled ?? true);
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = () => {
    requireAuth(async () => {
      setSaving(true);
      setTestResult(null);
      try {
        const res = await fetch(`${WORKER_URL}/exchange/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            api_secret: apiSecret,
            trading_mode: tradingMode,
            max_position_usd: parseFloat(maxPositionUsd),
            default_leverage: parseInt(defaultLeverage, 10),
            enabled,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          setTestResult({
            success: false,
            message: err.detail || "Save failed",
          });
          setSaving(false);
          return;
        }
        setApiKey("");
        setApiSecret("");
        await fetchSettings();
        setTestResult({ success: true, message: "Settings saved" });
        setSaving(false);
      } catch (e) {
        setTestResult({
          success: false,
          message: e instanceof Error ? e.message : "Save failed",
        });
        setSaving(false);
      }
    });
  };

  const handleTest = () => {
    requireAuth(async () => {
      setTesting(true);
      setTestResult(null);
      try {
        const res = await fetch(`${WORKER_URL}/exchange/test`, {
          method: "POST",
        });
        const data = await res.json();
        if (data.success) {
          setTestResult({
            success: true,
            message: `Connected — canTrade: ${data.canTrade}, canWithdraw: ${data.canWithdraw}`,
          });
        } else {
          setTestResult({
            success: false,
            message: data.error || "Connection failed",
          });
        }
        setTesting(false);
      } catch (e) {
        setTestResult({
          success: false,
          message: e instanceof Error ? e.message : "Test failed",
        });
        setTesting(false);
      }
    });
  };

  const handleDelete = () => {
    requireAuth(async () => {
      try {
        await fetch(`${WORKER_URL}/exchange/settings`, { method: "DELETE" });
        setSettings({ configured: false });
        setApiKey("");
        setApiSecret("");
        setTestResult({ success: true, message: "API keys removed" });
      } catch {
        /* ignore */
      }
    });
  };

  if (loading) {
    return (
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-muted">
        Loading exchange settings...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">
          Binance Copy Trade
        </h2>
        <p className="mt-1 text-sm text-muted">
          Connect your Binance API keys to execute trades directly from agent
          signals. Keys are encrypted at rest and never sent to the browser.
        </p>
      </div>

      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-4">
        {/* Status */}
        {settings?.configured && (
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                settings.enabled ? "bg-green-500" : "bg-yellow-500"
              }`}
            />
            <span className="text-[var(--text-secondary)]">
              {settings.enabled ? "Active" : "Disabled"} — Key:{" "}
              <code className="text-xs">{settings.maskedApiKey}</code>
            </span>
          </div>
        )}

        {/* API Key inputs */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="exchange-api-key" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              API Key
            </label>
            <input
              id="exchange-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                settings?.configured
                  ? "Enter new key to update"
                  : "Binance API Key"
              }
              className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            />
          </div>
          <div>
            <label htmlFor="exchange-api-secret" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              API Secret
            </label>
            <input
              id="exchange-api-secret"
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder={
                settings?.configured
                  ? "Enter new secret to update"
                  : "Binance API Secret"
              }
              className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            />
          </div>
        </div>

        {/* Preferences */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="exchange-trading-mode" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              Trading Mode
            </label>
            <select
              id="exchange-trading-mode"
              value={tradingMode}
              onChange={(e) =>
                setTradingMode(e.target.value as "spot" | "futures" | "both")
              }
              className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
            >
              <option value="spot">Spot</option>
              <option value="futures">Futures</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div>
            <label htmlFor="exchange-max-position" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              Max Position (USD)
            </label>
            <input
              id="exchange-max-position"
              type="number"
              min={1}
              value={maxPositionUsd}
              onChange={(e) => setMaxPositionUsd(e.target.value)}
              className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label htmlFor="exchange-default-leverage" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              Default Leverage
            </label>
            <input
              id="exchange-default-leverage"
              type="number"
              min={1}
              max={125}
              value={defaultLeverage}
              onChange={(e) => setDefaultLeverage(e.target.value)}
              className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
            />
          </div>
        </div>

        {/* Enable toggle */}
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded"
          />
          Enable copy-trade execution
        </label>

        {/* Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSave}
            disabled={saving || (!apiKey && !settings?.configured)}
            className="rounded bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {settings?.configured && (
            <>
              <button
                onClick={handleTest}
                disabled={testing}
                className="rounded border border-[var(--border-default)] px-4 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
              >
                {testing ? "Testing..." : "Test Connection"}
              </button>
              <button
                onClick={handleDelete}
                className="rounded border border-red-500/30 px-4 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10"
              >
                Delete Keys
              </button>
            </>
          )}
        </div>

        {/* Test result */}
        {testResult && (
          <div
            className={`rounded px-3 py-2 text-sm ${
              testResult.success
                ? "bg-green-500/10 text-green-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {testResult.message}
          </div>
        )}

        {/* Safety instructions */}
        <div className="rounded bg-[var(--bg-elevated)] px-3 py-2.5 text-xs text-[var(--text-tertiary)] space-y-1">
          <p className="font-medium text-[var(--text-secondary)]">
            Safety setup:
          </p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>
              Create a dedicated API key with <strong>trading only</strong>{" "}
              permissions (no withdrawals)
            </li>
            <li>
              IP-restrict the key to the Fly.io worker IP for maximum security
            </li>
            <li>
              The max position cap prevents accidental large orders
            </li>
            <li>All executions are logged in the audit trail</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

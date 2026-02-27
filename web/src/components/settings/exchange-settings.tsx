"use client";

/**
 * Exchange Settings — Configure Binance API keys for copy-trade execution.
 */

import { useReducer, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFetch } from "@/hooks/use-fetch";
import type { ExchangeSettings } from "@/lib/types";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

// ─── Reducer ───
interface ExchangeState {
  apiKey: string;
  apiSecret: string;
  tradingMode: "spot" | "futures" | "both";
  maxPositionUsd: string;
  defaultLeverage: string;
  enabled: boolean;
  saving: boolean;
  testing: boolean;
  testResult: { success: boolean; message: string } | null;
  settingsOverride: ExchangeSettings | null;
}

type ExchangeAction =
  | { type: "SET_FIELD"; field: keyof Pick<ExchangeState, "apiKey" | "apiSecret" | "maxPositionUsd" | "defaultLeverage">; value: string }
  | { type: "SET_TRADING_MODE"; value: "spot" | "futures" | "both" }
  | { type: "SET_ENABLED"; value: boolean }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_TESTING"; value: boolean }
  | { type: "SET_TEST_RESULT"; value: { success: boolean; message: string } | null }
  | { type: "SAVE_SUCCESS" }
  | { type: "DELETE_SUCCESS" }
  | { type: "APPLY_FETCHED"; settings: ExchangeSettings };

function exchangeReducer(state: ExchangeState, action: ExchangeAction): ExchangeState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_TRADING_MODE":
      return { ...state, tradingMode: action.value };
    case "SET_ENABLED":
      return { ...state, enabled: action.value };
    case "SET_SAVING":
      return { ...state, saving: action.value };
    case "SET_TESTING":
      return { ...state, testing: action.value };
    case "SET_TEST_RESULT":
      return { ...state, testResult: action.value };
    case "SAVE_SUCCESS":
      return { ...state, apiKey: "", apiSecret: "", saving: false, testResult: { success: true, message: "Settings saved" } };
    case "DELETE_SUCCESS":
      return {
        ...state,
        settingsOverride: { configured: false },
        apiKey: "",
        apiSecret: "",
        testResult: { success: true, message: "API keys removed" },
      };
    case "APPLY_FETCHED":
      if (!action.settings.configured) return state;
      return {
        ...state,
        tradingMode: action.settings.tradingMode || "futures",
        maxPositionUsd: String(action.settings.maxPositionUsd || 100),
        defaultLeverage: String(action.settings.defaultLeverage || 1),
        enabled: action.settings.enabled ?? true,
      };
  }
}

export function ExchangeSettingsSection() {
  const { requireAuth } = useAuth();

  const fetchUrl = WORKER_URL ? `${WORKER_URL}/exchange/settings` : null;
  const { data: fetchedSettings, loading, refetch } = useFetch<ExchangeSettings>(fetchUrl);

  const [state, dispatch] = useReducer(exchangeReducer, {
    apiKey: "",
    apiSecret: "",
    tradingMode: "futures",
    maxPositionUsd: "100",
    defaultLeverage: "1",
    enabled: true,
    saving: false,
    testing: false,
    testResult: null,
    settingsOverride: null,
  });

  // Apply fetched settings once available
  const settings = state.settingsOverride ?? fetchedSettings;
  const appliedRef = useRef(false);
  useEffect(() => {
    if (fetchedSettings && !appliedRef.current && fetchedSettings.configured) {
      appliedRef.current = true;
      dispatch({ type: "APPLY_FETCHED", settings: fetchedSettings });
    }
  }, [fetchedSettings]);

  const handleSave = () => {
    requireAuth(async () => {
      dispatch({ type: "SET_SAVING", value: true });
      dispatch({ type: "SET_TEST_RESULT", value: null });

      let result: Response | null = null;
      try {
        result = await fetch(`${WORKER_URL}/exchange/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: state.apiKey,
            api_secret: state.apiSecret,
            trading_mode: state.tradingMode,
            max_position_usd: parseFloat(state.maxPositionUsd),
            default_leverage: parseInt(state.defaultLeverage, 10),
            enabled: state.enabled,
          }),
        });
      } catch (e) {
        dispatch({
          type: "SET_TEST_RESULT",
          value: {
            success: false,
            message: e instanceof Error ? e.message : "Save failed",
          },
        });
        dispatch({ type: "SET_SAVING", value: false });
        return;
      }

      if (!result.ok) {
        let errMsg = "Save failed";
        try {
          const err = await result.json();
          errMsg = err.detail || errMsg;
        } catch { /* ignore parse error */ }
        dispatch({ type: "SET_TEST_RESULT", value: { success: false, message: errMsg } });
        dispatch({ type: "SET_SAVING", value: false });
        return;
      }

      refetch();
      dispatch({ type: "SAVE_SUCCESS" });
    });
  };

  const handleTest = () => {
    requireAuth(async () => {
      dispatch({ type: "SET_TESTING", value: true });
      dispatch({ type: "SET_TEST_RESULT", value: null });

      let data: { success?: boolean; canTrade?: boolean; canWithdraw?: boolean; error?: string } | null = null;
      try {
        const res = await fetch(`${WORKER_URL}/exchange/test`, {
          method: "POST",
        });
        data = await res.json();
      } catch (e) {
        dispatch({
          type: "SET_TEST_RESULT",
          value: {
            success: false,
            message: e instanceof Error ? e.message : "Test failed",
          },
        });
        dispatch({ type: "SET_TESTING", value: false });
        return;
      }

      if (data?.success) {
        dispatch({
          type: "SET_TEST_RESULT",
          value: {
            success: true,
            message: `Connected — canTrade: ${data.canTrade}, canWithdraw: ${data.canWithdraw}`,
          },
        });
      } else {
        dispatch({
          type: "SET_TEST_RESULT",
          value: {
            success: false,
            message: data?.error || "Connection failed",
          },
        });
      }
      dispatch({ type: "SET_TESTING", value: false });
    });
  };

  const handleDelete = useCallback(() => {
    requireAuth(async () => {
      try {
        await fetch(`${WORKER_URL}/exchange/settings`, { method: "DELETE" });
      } catch {
        return;
      }
      dispatch({ type: "DELETE_SUCCESS" });
    });
  }, [requireAuth]);

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
                settings.enabled ? "bg-[var(--status-connected)]" : "bg-[var(--accent-yellow)]"
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
              value={state.apiKey}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "apiKey", value: e.target.value })}
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
              value={state.apiSecret}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "apiSecret", value: e.target.value })}
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
              value={state.tradingMode}
              onChange={(e) =>
                dispatch({ type: "SET_TRADING_MODE", value: e.target.value as "spot" | "futures" | "both" })
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
              value={state.maxPositionUsd}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "maxPositionUsd", value: e.target.value })}
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
              value={state.defaultLeverage}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "defaultLeverage", value: e.target.value })}
              className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
            />
          </div>
        </div>

        {/* Enable toggle */}
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(e) => dispatch({ type: "SET_ENABLED", value: e.target.checked })}
            className="rounded"
          />
          Enable copy-trade execution
        </label>

        {/* Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSave}
            disabled={state.saving || (!state.apiKey && !settings?.configured)}
            className="rounded bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {state.saving ? "Saving..." : "Save"}
          </button>
          {settings?.configured && (
            <>
              <button
                onClick={handleTest}
                disabled={state.testing}
                className="rounded border border-[var(--border-default)] px-4 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
              >
                {state.testing ? "Testing..." : "Test Connection"}
              </button>
              <button
                onClick={handleDelete}
                className="rounded border border-[var(--bearish)]/30 px-4 py-1.5 text-sm font-medium text-bearish hover:bg-[var(--bearish-subtle)]"
              >
                Delete Keys
              </button>
            </>
          )}
        </div>

        {/* Test result */}
        {state.testResult && (
          <div
            className={`rounded px-3 py-2 text-sm ${
              state.testResult.success
                ? "bg-[var(--bullish-subtle)] text-bullish"
                : "bg-[var(--bearish-subtle)] text-bearish"
            }`}
          >
            {state.testResult.message}
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

/**
 * Settings Page — LLM cost control toggles.
 *
 * Server component with ISR 60s. Fetches settings + costs in parallel.
 */

import { getLlmSettings, getLlmCosts } from "@/lib/queries/settings";
import { SettingsPage } from "@/components/settings/settings-page";
import { ExchangeSettingsSection } from "@/components/settings/exchange-settings";
import { FollowingImport } from "@/components/settings/following-import";

export const revalidate = 60;

export default async function SettingsRoute() {
  const [sections, costs] = await Promise.all([
    getLlmSettings(),
    getLlmCosts(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Configure exchange connections, notifications, and LLM models
        </p>
      </div>

      {sections.length > 0 ? (
        <SettingsPage sections={sections} costs={costs} />
      ) : (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-8 text-center text-sm text-muted">
          No LLM settings found. The migration may not have run yet.
        </div>
      )}

      {/* Exchange / Copy-Trade settings */}
      <ExchangeSettingsSection />

      {/* Twitter Following Import */}
      <FollowingImport />
    </div>
  );
}

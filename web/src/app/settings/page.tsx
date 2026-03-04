/**
 * Settings Page — LLM cost control toggles.
 *
 * Server component with ISR 60s. Fetches settings + costs in parallel.
 */

import { PageHeader } from "@/components/terminal";
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
      <PageHeader title="Settings" subtitle="Configure exchange connections, notifications, and LLM models" />

      {sections.length > 0 ? (
        <SettingsPage sections={sections} costs={costs} />
      ) : (
        <div className="rounded-none border border-void-border bg-void-surface px-4 py-8 text-center text-sm text-text-tertiary">
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

/**
 * Settings page loading skeleton.
 */
export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="h-7 w-28 rounded-none bg-void-muted skeleton" />
        <div className="mt-2 h-4 w-64 rounded-none bg-void-muted skeleton" />
      </div>

      {/* LLM settings sections */}
      {Array.from({ length: 3 }).map((_, s) => (
        <div
          key={s}
          className="rounded-none border border-void-border bg-void-surface p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="h-5 w-40 rounded-none bg-void-muted skeleton" />
            <div className="h-4 w-16 rounded-none bg-void-muted skeleton" />
          </div>
          {/* Toggle rows */}
          {Array.from({ length: 3 }).map((_, r) => (
            <div key={r} className="flex items-center justify-between py-2">
              <div className="space-y-1">
                <div className="h-4 w-32 rounded-none bg-void-muted skeleton" />
                <div className="h-3 w-48 rounded-none bg-void-muted skeleton" />
              </div>
              <div className="h-6 w-11 rounded-full bg-void-muted skeleton" />
            </div>
          ))}
        </div>
      ))}

      {/* Exchange settings section */}
      <div className="rounded-none border border-void-border bg-void-surface p-4 space-y-4">
        <div className="h-5 w-44 rounded-none bg-void-muted skeleton" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 rounded-none bg-void-muted skeleton" />
              <div className="h-9 rounded-none bg-void-muted skeleton" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

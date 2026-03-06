export default function AgentDetailLoading() {
  return (
    <div className="min-h-screen bg-void px-4 py-8">
      <div className="w-full max-w-[1800px] mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-void-surface border border-void-border animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-48 bg-void-surface border border-void-border animate-pulse" />
            <div className="h-3 w-32 bg-void-surface border border-void-border animate-pulse" />
          </div>
        </div>

        {/* Stats row skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-20 bg-void-surface border border-void-border animate-pulse"
            />
          ))}
        </div>

        {/* Tabs skeleton */}
        <div className="h-10 w-full max-w-xl bg-void-surface border border-void-border animate-pulse" />

        {/* Content skeleton */}
        <div className="h-96 bg-void-surface border border-void-border animate-pulse" />
      </div>
    </div>
  );
}

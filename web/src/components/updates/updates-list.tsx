import { type ChangelogEntry } from "@/lib/data/changelog";

function groupByMonth(entries: ChangelogEntry[]) {
  const groups: { label: string; entries: ChangelogEntry[] }[] = [];

  for (const entry of entries) {
    const d = new Date(entry.date + "T00:00:00");
    const label = d.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.entries.push(entry);
    } else {
      groups.push({ label, entries: [entry] });
    }
  }

  return groups;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function UpdatesList({ entries }: { entries: ChangelogEntry[] }) {
  const groups = groupByMonth(entries);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted">
            {group.label}
          </h2>
          <div className="space-y-3">
            {group.entries.map((entry) => (
              <div
                key={entry.date + entry.title}
                className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3"
              >
                <div className="flex items-baseline gap-3">
                  <span className="shrink-0 font-mono text-xs text-muted">
                    {formatDate(entry.date)}
                  </span>
                  <span className="text-sm font-medium text-primary">
                    {entry.title}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {entry.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

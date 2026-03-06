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
          <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-text-tertiary">
            {group.label}
          </h2>
          <div>
            {group.entries.map((entry) => (
              <div
                key={entry.date + entry.title}
                className="flex border-b border-void-border py-3 first:pt-0 last:border-b-0"
              >
                {/* Date column — fixed width, right-aligned with vertical rule */}
                <div className="w-28 shrink-0 border-r border-void-border pr-4 text-right font-mono text-xs text-text-tertiary">
                  {formatDate(entry.date)}
                </div>

                {/* Content column */}
                <div className="flex-1 pl-4">
                  <span className="font-mono text-sm uppercase tracking-widest text-text-primary">
                    {entry.title}
                  </span>
                  <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                    <span className="text-text-tertiary">{">"} </span>
                    {entry.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

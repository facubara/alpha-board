import { TerminalTabs } from "@/components/terminal";

const TABS = [
  { label: "Marketplace", href: "/agents/marketplace" },
  { label: "Seasons", href: "/agents/seasons" },
];

export default function AgentsTabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <TerminalTabs tabs={TABS} />
      {children}
    </div>
  );
}

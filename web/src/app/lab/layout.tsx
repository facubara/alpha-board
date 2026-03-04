import { TerminalTabs } from "@/components/terminal";

const TABS = [
  { label: "Backtester", href: "/lab/backtest" },
  { label: "Analytics", href: "/lab/analytics" },
  { label: "Processing", href: "/lab/processing" },
];

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <TerminalTabs tabs={TABS} />
      {children}
    </div>
  );
}

import { TerminalTabs } from "@/components/terminal";

const TABS = [
  { label: "Network Status", href: "/system/status" },
  { label: "Updates", href: "/system/updates" },
];

export default function SystemLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <TerminalTabs tabs={TABS} />
      {children}
    </div>
  );
}

import { TerminalTabs } from "@/components/terminal";

const TABS = [
  { label: "Coin Rankings", href: "/radar/coins" },
  { label: "Memecoins", href: "/radar/memecoins" },
  { label: "Tweets", href: "/radar/tweets" },
];

export default function RadarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <TerminalTabs tabs={TABS} />
      {children}
    </div>
  );
}

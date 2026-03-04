import { PageHeader } from "@/components/terminal";
import { RankingsTable } from "@/components/rankings";

export default function RankingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rankings"
        subtitle="Real-time crypto market rankings based on technical indicators"
      />
      <RankingsTable />
    </div>
  );
}

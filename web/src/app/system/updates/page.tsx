import { Metadata } from "next";
import { PageHeader } from "@/components/terminal";
import { changelog } from "@/lib/data/changelog";
import { UpdatesList } from "@/components/updates/updates-list";

export const metadata: Metadata = {
  title: "Updates — Alpha Board",
  description: "Product changelog — what's new in Alpha Board.",
};

export default function UpdatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Updates" subtitle="Product changelog and recent feature releases" />

      <UpdatesList entries={changelog} />
    </div>
  );
}

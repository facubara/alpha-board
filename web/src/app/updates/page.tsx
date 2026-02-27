import { Metadata } from "next";
import { changelog } from "@/lib/data/changelog";
import { UpdatesList } from "@/components/updates/updates-list";

export const metadata: Metadata = {
  title: "Updates — Alpha Board",
  description: "Product changelog — what's new in Alpha Board.",
};

export default function UpdatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Updates</h1>
        <p className="mt-1 text-sm text-muted">
          Product changelog and recent feature releases
        </p>
      </div>

      <UpdatesList entries={changelog} />
    </div>
  );
}

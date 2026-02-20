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
        <h1 className="text-xl font-semibold text-primary">Updates</h1>
        <p className="mt-1 text-sm text-muted">
          Product changelog — what we&apos;ve shipped recently
        </p>
      </div>

      <UpdatesList entries={changelog} />
    </div>
  );
}

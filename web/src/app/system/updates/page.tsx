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
      <h1 className="font-mono text-xl text-text-primary uppercase tracking-widest border-b border-void-border pb-2">
        {">"}_  UPDATES <span className="animate-pulse text-terminal-amber">█</span>
      </h1>

      <UpdatesList entries={changelog} />
    </div>
  );
}

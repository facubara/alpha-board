"use client";

import type { WatchWallet, WalletActivity } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WalletLeaderboard } from "./wallet-leaderboard";
import { WalletActivityFeed } from "./wallet-activity-feed";

const triggerClass =
  "rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium text-text-secondary data-[state=active]:border-text-primary data-[state=active]:text-text-primary";

export function WalletTabs({
  wallets,
  activity,
}: {
  wallets: WatchWallet[];
  activity: WalletActivity[];
}) {
  return (
    <Tabs defaultValue="wallets">
      <TabsList className="border-b border-void-border bg-transparent p-0">
        <TabsTrigger value="wallets" className={triggerClass}>
          Wallets
        </TabsTrigger>
        <TabsTrigger value="activity" className={triggerClass}>
          Activity
        </TabsTrigger>
      </TabsList>
      <TabsContent value="wallets" className="pt-4">
        <WalletLeaderboard initialWallets={wallets} />
      </TabsContent>
      <TabsContent value="activity" className="pt-4">
        <WalletActivityFeed initialActivity={activity} />
      </TabsContent>
    </Tabs>
  );
}

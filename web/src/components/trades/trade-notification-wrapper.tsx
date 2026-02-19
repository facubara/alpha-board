import { getRecentTrades } from "@/lib/queries/trades";
import { TradeNotificationProvider } from "./trade-notification-provider";

/**
 * Server component wrapper that fetches initial trades
 * and passes them to the client-side TradeNotificationProvider.
 */
export async function TradeNotificationWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialTrades = await getRecentTrades(50);
  return (
    <TradeNotificationProvider initialTrades={initialTrades}>
      {children}
    </TradeNotificationProvider>
  );
}

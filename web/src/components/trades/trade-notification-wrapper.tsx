import { TradeNotificationProvider } from "./trade-notification-provider";

/**
 * Sync wrapper — no server-side data fetch.
 * Initial trades are fetched client-side in the provider to avoid
 * blocking the layout render (was adding ~1.4s to LCP).
 * SSE handles real-time updates after mount.
 */
export function TradeNotificationWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TradeNotificationProvider>
      {children}
    </TradeNotificationProvider>
  );
}

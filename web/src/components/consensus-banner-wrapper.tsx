import { getConsensusData } from "@/lib/queries/consensus";
import { ConsensusBanner } from "./consensus-banner";

/**
 * Server component wrapper that fetches initial consensus data
 * and passes it to the client-side marquee banner.
 */
export async function ConsensusBannerWrapper() {
  const data = await getConsensusData();
  return <ConsensusBanner initialData={data} />;
}

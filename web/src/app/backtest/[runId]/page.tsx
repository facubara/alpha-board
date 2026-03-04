import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ runId: string }>;
}

export default async function BacktestRunRedirect({ params }: Props) {
  const { runId } = await params;
  redirect(`/lab/backtest/${runId}`);
}

import { notFound } from "next/navigation";
import { EventDetail } from "@/components/events/event-detail";
export const metadata = { title: "Event details · CommitPass" };
export default async function EventPage({
  params,
}: {
  params: Promise<{ vault: string }>;
}) {
  const { vault } = await params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(vault)) notFound();
  return <EventDetail vault={vault} />;
}

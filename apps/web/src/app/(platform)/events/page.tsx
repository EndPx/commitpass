import { EventList } from "@/components/events/event-list";
export const metadata = { title: "Your events · CommitPass" };
export default function EventsPage() {
  return <EventList personal />;
}

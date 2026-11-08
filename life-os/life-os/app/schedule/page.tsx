import type { Metadata } from "next";
import { ScheduleView } from "@/components/views/ScheduleView";

export const metadata: Metadata = { title: "Jadwal Saya" };

export default function Page() {
  return <ScheduleView />;
}

import type { Metadata } from "next";
import { AnalyticsView } from "@/components/views/AnalyticsView";

export const metadata: Metadata = { title: "Analitik" };

export default function Page() {
  return <AnalyticsView />;
}

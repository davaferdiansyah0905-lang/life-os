import type { Metadata } from "next";
import { GoalsView } from "@/components/views/GoalsView";

export const metadata: Metadata = { title: "Goals & Impian" };

export default function Page() {
  return <GoalsView />;
}

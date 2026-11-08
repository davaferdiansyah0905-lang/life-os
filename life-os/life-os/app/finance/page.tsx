import type { Metadata } from "next";
import { FinanceView } from "@/components/views/FinanceView";

export const metadata: Metadata = { title: "Keuangan" };

export default function Page() {
  return <FinanceView />;
}

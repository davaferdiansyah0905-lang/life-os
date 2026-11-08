import type { Metadata } from "next";
import { NotesView } from "@/components/views/NotesView";

export const metadata: Metadata = { title: "Catatan" };

export default function Page() {
  return <NotesView />;
}

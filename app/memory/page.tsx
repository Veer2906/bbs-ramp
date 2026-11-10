import { MemoryView } from "@/components/memory-view";
import { PageTransition } from "@/components/page-transition";

export default function Page() {
  return (
    <PageTransition>
      <MemoryView />
    </PageTransition>
  );
}

import { Suspense } from "react";
import { LedgerView } from "@/components/ledger-view";
import { PageTransition } from "@/components/page-transition";

export default function Page() {
  return (
    <PageTransition>
      <Suspense fallback={null}>
        <LedgerView />
      </Suspense>
    </PageTransition>
  );
}

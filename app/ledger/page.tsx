import { Suspense } from "react";
import { LedgerView } from "@/components/ledger-view";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LedgerView />
    </Suspense>
  );
}

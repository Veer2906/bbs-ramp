import { Suspense } from "react";
import { DocumentsView } from "@/components/documents-view";
import { PageTransition } from "@/components/page-transition";

export default function Page() {
  return (
    <PageTransition>
      <Suspense fallback={null}>
        <DocumentsView />
      </Suspense>
    </PageTransition>
  );
}

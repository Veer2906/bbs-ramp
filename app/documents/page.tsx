import { Suspense } from "react";
import { DocumentsView } from "@/components/documents-view";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DocumentsView />
    </Suspense>
  );
}

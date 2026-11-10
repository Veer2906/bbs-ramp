import { IssuesView } from "@/components/issues-view";
import { PageTransition } from "@/components/page-transition";

export default function Page() {
  return (
    <PageTransition>
      <IssuesView />
    </PageTransition>
  );
}

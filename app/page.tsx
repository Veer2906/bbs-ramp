import { Suspense } from "react";
import { AgentView } from "@/components/agent/agent-view";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AgentView />
    </Suspense>
  );
}

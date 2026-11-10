import { VaultView } from "@/components/vault-view";
import { PageTransition } from "@/components/page-transition";

export default function Page() {
  return (
    <PageTransition>
      <VaultView />
    </PageTransition>
  );
}

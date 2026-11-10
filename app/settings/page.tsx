import { SettingsView } from "@/components/settings-view";
import { PageTransition } from "@/components/page-transition";

export default function Page() {
  return (
    <PageTransition>
      <SettingsView />
    </PageTransition>
  );
}

import type { Metadata } from "next";
import { Cormorant_Garamond, Geist_Mono, Inter } from "next/font/google";
import { Backdrop } from "@/components/backdrop";
import { Sidebar } from "@/components/sidebar";
import { StorageBanner } from "@/components/storage-banner";
import { WorkspaceProvider } from "@/components/workspace-provider";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const display = Cormorant_Garamond({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Team Rampresso",
  description: "A computer-use agent for legacy vendor portals. It signs in, retrieves the documents and closes the month against your ledger.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden text-[14px]">
        <WorkspaceProvider>
          <div className="flex h-full">
            <Sidebar />
            <main className="relative isolate my-2 mr-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-[22px] shadow-[0_0_0_1px_rgb(244_241_234/0.08)]">
              <Backdrop />
              <StorageBanner />
              <div className="min-h-0 flex-1">{children}</div>
            </main>
          </div>
        </WorkspaceProvider>
      </body>
    </html>
  );
}

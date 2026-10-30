import type { Metadata } from "next";
import { Geist_Mono, Inter_Tight, Newsreader } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import { StorageBanner } from "@/components/storage-banner";
import { WorkspaceProvider } from "@/components/workspace-provider";
import "./globals.css";

// Free stand-ins for Ramp's TWK Lausanne (sans) and Burgess (serif); globals.css prefers the originals if installed.
const sans = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"] });
const serif = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agent",
  description: "Retrieve, match and validate financial documents from legacy vendor portals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden text-[14px]">
        <WorkspaceProvider>
          <div className="flex h-full">
            <Sidebar />
            <main className="flex min-w-0 flex-1 flex-col">
              <StorageBanner />
              <div className="min-h-0 flex-1">{children}</div>
            </main>
          </div>
        </WorkspaceProvider>
      </body>
    </html>
  );
}

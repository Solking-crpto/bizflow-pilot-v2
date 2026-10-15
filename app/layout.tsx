import "./globals.css";
import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { NetworkBanner } from "@/components/layout/NetworkBadge";
import { Footer } from "@/components/layout/Footer";
import { assertValidSandboxMode } from "@/lib/networks";
import { FirstVisitChoiceModal } from "@/components/common/FirstVisitChoiceModal";
import { TestnetExtrasPanel } from "@/components/testnet/TestnetExtrasPanel";
import { MainnetExtrasBanner } from "@/components/mainnet/MainnetExtrasBanner";
import { AppProviders } from "@/components/providers/AppProviders";

export const metadata: Metadata = {
  title: "BizFlow Pilot V2 — Policy-Approved USDC Settlement on Arc",
  description:
    "Turns verified business activity into policy-approved USDC payments on Arc, with tamper-evident audit anchoring.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  assertValidSandboxMode();
  const networkMode = (process.env.NEXT_PUBLIC_NETWORK_MODE || "testnet") as "testnet" | "mainnet";
  const isPublicSandbox =
    process.env.PUBLIC_SANDBOX === "true" || process.env.NEXT_PUBLIC_PUBLIC_SANDBOX === "true";

  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
        <AppProviders>
          <FirstVisitChoiceModal networkMode={networkMode} />
          <NetworkBanner mode={networkMode} isPublicSandbox={isPublicSandbox} />
          <div className="flex flex-1 min-h-0">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <TopNav networkMode={networkMode} />
              <main className="flex-1 p-6 md:p-8 max-w-[1280px] w-full mx-auto overflow-y-auto">
                <TestnetExtrasPanel />
                <MainnetExtrasBanner />
                {children}
              </main>
              <Footer networkMode={networkMode} />
            </div>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}

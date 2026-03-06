import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PlanFlowAI",
  description: "Professional website development",
};

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No Header, no sidebar, no Foundry chrome — clean client-facing pages
  return <>{children}</>;
}

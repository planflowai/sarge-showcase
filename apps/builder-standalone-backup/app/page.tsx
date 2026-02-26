"use client";

import BuilderPage from "@sarge/builder/components/BuilderPage";
import ChatDrawer from "../components/ChatDrawer";
import { JuryToast } from "@sarge/core";

export default function Home() {
  return (
    <div className="flex h-screen w-full">
      <BuilderPage />
      <ChatDrawer />
      <JuryToast />
    </div>
  );
}

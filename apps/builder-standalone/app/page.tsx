"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import BuilderPage from "@sarge/builder/components/BuilderPage";
import { ErrorBoundary } from "../components/ui/error-boundary";
import { JuryToast } from "@sarge/core";
import { useConversationStore } from "@sarge/chat/index.client";
import { useArtifactStore } from "@sarge/builder/index.client";
import { WarRoomPopout } from "@/components/chat/WarRoomPopout";
import { WorkbenchPopout } from "@/components/workbench/WorkbenchPopout";
import WorkbenchDashboard from "@/components/workbench/WorkbenchDashboard";
import { useWorkbenchStore } from "@/lib/stores/workbenchStore";
import DeployPanel from "@/components/deploy/DeployPanel";

export default function Home() {
  const searchParams = useSearchParams();
  const {
    loadConversations,
    createConversation,
    setCurrent,
  } = useConversationStore();

  // War Room popout detection — ?warroom=1&slot=mon5&provider=anthropic&model=...
  const isPopout = searchParams.get("warroom") === "1";
  const popoutSlotId = searchParams.get("slot") ?? "";
  const popoutProvider = searchParams.get("provider") ?? "";
  const popoutModel = searchParams.get("model") ?? "";

  // Workbench popout detection — ?workbench=1&slot=N&monitor=M&provider=P&model=M
  const isWorkbenchPopout = searchParams.get("workbench") === "1";
  const wbSlot     = parseInt(searchParams.get("slot")     ?? "1", 10);
  const wbMonitor  = parseInt(searchParams.get("monitor")  ?? "1", 10);
  const wbProvider = searchParams.get("provider") ?? "anthropic";
  const wbModel    = searchParams.get("model")    ?? "";

  // Workbench command center state
  const workbenchActive = useWorkbenchStore((s) => s.active);
  const lockedCode      = useWorkbenchStore((s) => s.lockedCode);
  const clearLocked     = useWorkbenchStore((s) => s.clearLocked);

  // When Lock Winner fires: inject code into artifact panel then clear
  useEffect(() => {
    if (!lockedCode) return;
    useArtifactStore.getState().setCode(lockedCode, null, "Workbench Winner");
    useArtifactStore.getState().setActiveTab("preview");
    clearLocked();
  }, [lockedCode, clearLocked]);

  // Auto-create a conversation so ChatView has a valid conversationId
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    if (isPopout || isWorkbenchPopout) return; // Popouts don't need conversations
    initRef.current = true;
    (async () => {
      await loadConversations();
      const state = useConversationStore.getState();
      if (state.conversations.length === 0) {
        await createConversation("Builder Chat");
      } else if (!state.currentConversationId) {
        setCurrent(state.conversations[0].id);
      }
    })();
  }, [loadConversations, createConversation, setCurrent, isPopout, isWorkbenchPopout]);

  // Workbench popout window — full-viewport builder slot
  if (isWorkbenchPopout) {
    return (
      <WorkbenchPopout
        slotNum={wbSlot}
        monitorNumber={wbMonitor}
        provider={wbProvider}
        model={wbModel}
      />
    );
  }

  // War Room popout window — renders full-viewport overlay
  if (isPopout && popoutSlotId && popoutProvider) {
    return <WarRoomPopout slotId={popoutSlotId} provider={popoutProvider} model={popoutModel} />;
  }

  // Workbench command center — full-screen overlay on builder page
  if (workbenchActive) {
    return (
      <div className="flex h-full w-full">
        <WorkbenchDashboard />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full">
      <ErrorBoundary fallbackTitle="Builder Error">
        <BuilderPage deployContent={<DeployPanel />} />
      </ErrorBoundary>
      <JuryToast />
    </div>
  );
}

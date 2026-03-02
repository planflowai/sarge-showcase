"use client";

import React, { Suspense, useEffect, useRef, useState, useCallback, lazy } from "react";
import { useSearchParams } from "next/navigation";
import { ErrorBoundary } from "../components/ui/error-boundary";
import { JuryToast } from "@sarge/core";
import { useConversationStore } from "@sarge/chat/index.client";
import { useArtifactStore } from "@sarge/builder/index.client";
import { useBuilderStore } from "@sarge/builder/index.client";
import { useWorkbenchStore } from "@/lib/stores/workbenchStore";

// Lazy-load heavy components that are only conditionally rendered
const BuilderPage = lazy(() => import("@sarge/builder/components/BuilderPage"));
const DeployPanel = lazy(() => import("@/components/deploy/DeployPanel"));
const WarRoomPopout = lazy(() => import("@/components/chat/WarRoomPopout").then(m => ({ default: m.WarRoomPopout })));
const WorkbenchPopout = lazy(() => import("@/components/workbench/WorkbenchPopout").then(m => ({ default: m.WorkbenchPopout })));
const WorkbenchDashboard = lazy(() => import("@/components/workbench/WorkbenchDashboard"));
const NewProjectWizard = lazy(() => import("@/components/project/NewProjectWizard"));

const LoadingFallback = <div className="flex h-full w-full items-center justify-center"><span className="text-zinc-500">Loading...</span></div>;

export default function Home() {
  return (
    <Suspense fallback={LoadingFallback}>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
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
    useArtifactStore.getState().setCode(lockedCode, null, "Pit Winner");
    useArtifactStore.getState().setActiveTab("preview");
    clearLocked();
  }, [lockedCode, clearLocked]);

  // Listen for pit:launch event from BuilderPage orange button
  useEffect(() => {
    const handler = () => useWorkbenchStore.getState().setActive(true);
    window.addEventListener("pit:launch", handler);
    return () => window.removeEventListener("pit:launch", handler);
  }, []);

  // New Project Wizard — triggered by project:new-wizard event from BuilderSidebar
  const [showWizard, setShowWizard] = useState(false);
  useEffect(() => {
    const handler = () => setShowWizard(true);
    window.addEventListener("project:new-wizard", handler);
    return () => window.removeEventListener("project:new-wizard", handler);
  }, []);

  const handleWizardCreated = useCallback(async (projectPath: string, _projectName: string) => {
    // Open the newly created project in the builder via list-directory API
    try {
      const res = await fetch("/api/builder/list-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: projectPath }),
      });
      const data = await res.json();
      if (data.success) {
        useBuilderStore.getState().setProject(data.projectPath, data.projectName, data.tree);
      }
    } catch {
      // Fallback: just set path and name without tree
      useBuilderStore.getState().setProject(projectPath, _projectName, []);
    }
  }, []);

  // Pit auto-restore REMOVED — caused popout flood on Edge restart.
  // The Pit must be launched explicitly via button click only.

  // One-time cleanup of stale persist keys (messageStore persist was removed)
  useEffect(() => {
    try {
      if (localStorage.getItem("message")) localStorage.removeItem("message");
    } catch {}
  }, []);

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
      <Suspense fallback={LoadingFallback}>
        <WorkbenchPopout
          slotNum={wbSlot}
          monitorNumber={wbMonitor}
          provider={wbProvider}
          model={wbModel}
        />
      </Suspense>
    );
  }

  // War Room popout window — renders full-viewport overlay
  if (isPopout && popoutSlotId && popoutProvider) {
    return (
      <Suspense fallback={LoadingFallback}>
        <WarRoomPopout slotId={popoutSlotId} provider={popoutProvider} model={popoutModel} />
      </Suspense>
    );
  }

  // Workbench command center — full-screen overlay on builder page
  if (workbenchActive) {
    return (
      <Suspense fallback={LoadingFallback}>
        <div className="flex h-full w-full">
          <WorkbenchDashboard />
        </div>
      </Suspense>
    );
  }

  return (
    <div className="flex h-full w-full">
      <ErrorBoundary fallbackTitle="Builder Error">
        <Suspense fallback={LoadingFallback}>
          <BuilderPage deployContent={
            <Suspense fallback={<div className="p-4 text-zinc-500 text-sm">Loading deploy...</div>}>
              <DeployPanel />
            </Suspense>
          } />
        </Suspense>
      </ErrorBoundary>
      <JuryToast />
      {showWizard && (
        <Suspense fallback={null}>
          <NewProjectWizard
            isOpen={showWizard}
            onClose={() => setShowWizard(false)}
            onCreated={handleWizardCreated}
          />
        </Suspense>
      )}
    </div>
  );
}

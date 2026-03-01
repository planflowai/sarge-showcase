"use client";

import { useState } from "react";
import { useForensicLogStore } from "@/lib/stores/forensicLogStore";
import { ForensicSidebar } from "./ForensicSidebar";
import { TimelineView } from "./TimelineView";
import { InvestigationView } from "./InvestigationView";
import { ReplayView } from "./ReplayView";
import { ExportView } from "./ExportView";

export function ForensicLogView() {
  const currentView = useForensicLogStore((s) => s.currentView);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-full overflow-hidden bg-white dark:bg-zinc-950">
        <ForensicSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div className="flex-1 overflow-auto">
          {currentView === "timeline" && <TimelineView />}
          {currentView === "investigation" && <InvestigationView />}
          {currentView === "replay" && <ReplayView />}
          {currentView === "export" && <ExportView />}
        </div>
      </div>
    </div>
  );
}

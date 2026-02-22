"use client";

import { useEffect } from "react";

/**
 * Workspace Layout - Minimal layout for pop-out workspace windows
 *
 * This layout hides the main SARGE navigation and sidebar,
 * giving workspace windows full screen real estate.
 */
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Hide parent layout elements when workspace pages load
  useEffect(() => {
    // Add a class to body to signal we're in workspace mode
    document.body.classList.add("workspace-mode");

    // Hide the header and sidebar
    const header = document.querySelector("header");
    const sidebar = document.querySelector('[class*="Sidebar"]');
    const mainWrapper = document.querySelector(".flex.flex-col.h-dvh");

    if (header) (header as HTMLElement).style.display = "none";
    if (sidebar) (sidebar as HTMLElement).style.display = "none";

    // Make the main content take full screen
    if (mainWrapper) {
      (mainWrapper as HTMLElement).style.height = "100vh";
      const innerWrapper = mainWrapper.querySelector(".flex.flex-1");
      if (innerWrapper) {
        (innerWrapper as HTMLElement).style.height = "100%";
      }
    }

    return () => {
      document.body.classList.remove("workspace-mode");
      if (header) (header as HTMLElement).style.display = "";
      if (sidebar) (sidebar as HTMLElement).style.display = "";
      if (mainWrapper) {
        (mainWrapper as HTMLElement).style.height = "";
        const innerWrapper = mainWrapper.querySelector(".flex.flex-1");
        if (innerWrapper) {
          (innerWrapper as HTMLElement).style.height = "";
        }
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950">
      {children}
    </div>
  );
}

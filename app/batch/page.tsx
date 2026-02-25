"use client";

import { TestModeView } from "@/components/test/TestModeView";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { useEffect } from "react";

export default function BatchPage() {
  useEffect(() => {
    useTestModeStore.setState({ batchModeActive: true });
  }, []);

  return (
    <div className="h-full w-full">
      <TestModeView />
    </div>
  );
}

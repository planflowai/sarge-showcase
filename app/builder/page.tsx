"use client";

import BuilderPage from "@/components/Builder/BuilderPage";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function Builder() {
  return (
    <ErrorBoundary fallbackTitle="Builder Error">
      <BuilderPage />
    </ErrorBoundary>
  );
}

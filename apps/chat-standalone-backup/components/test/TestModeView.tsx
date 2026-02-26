"use client";
import dynamic from "next/dynamic";
const TestModeViewImpl = dynamic(
  () => import("@sarge/chat/components/test/TestModeView").then(m => ({ default: m.TestModeView })),
  { ssr: false }
);
export function TestModeView() {
  return <TestModeViewImpl />;
}

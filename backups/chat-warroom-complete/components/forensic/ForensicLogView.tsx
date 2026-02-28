"use client";
import dynamic from "next/dynamic";
const ForensicLogViewImpl = dynamic(
  () => import("@sarge/chat/components/forensic/ForensicLogView").then(m => ({ default: m.ForensicLogView })),
  { ssr: false }
);
export function ForensicLogView() {
  return <ForensicLogViewImpl />;
}

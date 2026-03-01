"use client";

import { PinLock } from "@/components/auth/PinLock";
import { EnvManager } from "@/components/env/EnvManager";

export default function EnvManagerPage() {
  return (
    <PinLock>
      <EnvManager />
    </PinLock>
  );
}

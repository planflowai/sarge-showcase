"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePinStore } from "@/lib/stores/pinStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

export function PinLock({ children }: { children: React.ReactNode }) {
  const {
    pinEnabled,
    isLocked,
    hydrated,
    hydrate,
    verifyPin,
    unlock,
    setPin,
    checkTimeout,
    touchActivity,
  } = usePinStore();

  const [pin, setInputPin] = useState("");
  const [error, setError] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [confirmPin, setConfirmPin] = useState("");
  const [setupStep, setSetupStep] = useState<"enter" | "confirm">("enter");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!pinEnabled) return;
    const interval = setInterval(checkTimeout, 60_000);
    return () => clearInterval(interval);
  }, [pinEnabled, checkTimeout]);

  useEffect(() => {
    if (!pinEnabled) return;
    const touch = () => touchActivity();
    window.addEventListener("keydown", touch);
    window.addEventListener("click", touch);
    return () => {
      window.removeEventListener("keydown", touch);
      window.removeEventListener("click", touch);
    };
  }, [pinEnabled, touchActivity]);

  useEffect(() => {
    if ((isLocked || isSettingUp) && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLocked, isSettingUp]);

  const handleSubmit = useCallback(() => {
    if (isSettingUp) {
      if (setupStep === "enter") {
        if (pin.length < 4 || pin.length > 6) {
          setError(true);
          setTimeout(() => setError(false), 500);
          return;
        }
        setConfirmPin(pin);
        setInputPin("");
        setSetupStep("confirm");
        return;
      }
      if (pin === confirmPin) {
        setPin(pin);
        setInputPin("");
        setIsSettingUp(false);
        setSetupStep("enter");
        setConfirmPin("");
      } else {
        setError(true);
        setInputPin("");
        setTimeout(() => setError(false), 500);
        setSetupStep("enter");
        setConfirmPin("");
      }
      return;
    }

    if (verifyPin(pin)) {
      unlock();
      setInputPin("");
      setError(false);
    } else {
      setError(true);
      setInputPin("");
      setTimeout(() => setError(false), 500);
    }
  }, [pin, confirmPin, isSettingUp, setupStep, verifyPin, unlock, setPin]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  if (!hydrated) return null;

  // No PIN set — show children but offer setup
  if (!pinEnabled && !isSettingUp) {
    return (
      <div className="relative">
        {!pinEnabled && (
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={() => setIsSettingUp(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors"
            >
              <Lock className="w-3 h-3" />
              Set PIN
            </button>
          </div>
        )}
        {children}
      </div>
    );
  }

  // PIN set and unlocked
  if (pinEnabled && !isLocked) {
    return <>{children}</>;
  }

  // Lock screen
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div
        className={cn(
          "w-80 space-y-6 text-center transition-transform",
          error && "animate-[shake_0.5s_ease-in-out]"
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-200 dark:bg-zinc-800">
            <Lock className="h-8 w-8 text-[#FF6700]" />
          </div>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#FF6700]" />
            <h1 className="text-lg font-bold text-[#FF6700]">
              {isSettingUp ? "Set Up PIN" : "ENV Manager"}
            </h1>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-zinc-400">
            {isSettingUp
              ? setupStep === "enter"
                ? "Set a PIN (4-6 digits)"
                : "Confirm your PIN"
              : "Enter your PIN to access ENV Manager"}
          </p>

          <Input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={handleKeyDown}
            placeholder="****"
            className={cn(
              "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-center text-2xl tracking-[0.5em] text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 placeholder:tracking-[0.5em]",
              error && "border-red-500"
            )}
          />

          {error && (
            <p className="text-xs text-red-400">
              {isSettingUp ? "PINs didn't match. Try again." : "Wrong PIN."}
            </p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={pin.length < 4}
            className="w-full bg-[#FF6700] text-white hover:bg-[#e65c00] disabled:opacity-40"
          >
            {isSettingUp
              ? setupStep === "enter"
                ? "Next"
                : "Set PIN"
              : "Unlock"}
          </Button>
        </div>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          10%,
          30%,
          50%,
          70%,
          90% {
            transform: translateX(-4px);
          }
          20%,
          40%,
          60%,
          80% {
            transform: translateX(4px);
          }
        }
      `}</style>
    </div>
  );
}

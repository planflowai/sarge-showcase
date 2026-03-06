/**
 * Forge Trials — Results API
 * GET: List or load benchmark results from disk.
 * DELETE: Remove a result file.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { BenchmarkRun } from "@sarge/benchmark";

const SAVE_DIR =
  process.env.BENCHMARK_SAVE_DIR ||
  (process.platform === "win32"
    ? "L:/AI_MASTER_BUILDS/.benchmarks"
    : "/AI_MASTER_BUILDS/.benchmarks");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("id");

  try {
    await fs.mkdir(SAVE_DIR, { recursive: true });

    if (runId) {
      // Load specific run
      const filePath = path.join(SAVE_DIR, `${runId}.json`);
      const data = await fs.readFile(filePath, "utf-8");
      const run: BenchmarkRun = JSON.parse(data);
      return NextResponse.json(run);
    }

    // List all runs (sorted newest first)
    const files = await fs.readdir(SAVE_DIR);
    const runs: Array<{
      id: string;
      startedAt: number;
      completedAt?: number;
      status: string;
      modelCount: number;
      roundCount: number;
    }> = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const data = await fs.readFile(
          path.join(SAVE_DIR, file),
          "utf-8"
        );
        const run: BenchmarkRun = JSON.parse(data);
        runs.push({
          id: run.id,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          status: run.status,
          modelCount: run.models.length,
          roundCount: run.scenarios.length,
        });
      } catch {
        // Skip corrupt files
      }
    }

    runs.sort((a, b) => b.startedAt - a.startedAt);
    return NextResponse.json({ runs });
  } catch {
    return NextResponse.json({ runs: [] });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("id");

  if (!runId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const filePath = path.join(SAVE_DIR, `${runId}.json`);
    await fs.unlink(filePath);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "File not found" },
      { status: 404 }
    );
  }
}

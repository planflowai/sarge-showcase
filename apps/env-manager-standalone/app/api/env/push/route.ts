import { NextResponse } from "next/server";
import { existsSync, readFileSync, writeFileSync } from "fs";
import {
  MASTER_ENV_PATH,
  findAppEnvPaths,
} from "../helpers";

export async function POST() {
  try {
    if (!existsSync(MASTER_ENV_PATH)) {
      return NextResponse.json(
        { error: "Master .env.local not found" },
        { status: 404 }
      );
    }

    const masterContent = readFileSync(MASTER_ENV_PATH, "utf-8");
    const appPaths = findAppEnvPaths();
    const updated: string[] = [];

    for (const appEnvPath of appPaths) {
      try {
        writeFileSync(appEnvPath, masterContent, "utf-8");
        updated.push(appEnvPath);
      } catch {
        // Skip paths we can't write to
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount: updated.length,
      updatedPaths: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to push env" },
      { status: 500 }
    );
  }
}

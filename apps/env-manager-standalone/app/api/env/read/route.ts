import { NextResponse } from "next/server";
import {
  MASTER_ENV_PATH,
  parseEnvFile,
  maskValue,
  categorizeKey,
  readRotationLog,
  getFileInfo,
} from "../helpers";

export async function GET() {
  try {
    const entries = parseEnvFile(MASTER_ENV_PATH);
    const rotationLog = readRotationLog();
    const fileInfo = getFileInfo(MASTER_ENV_PATH);

    const keys = entries.map((e) => ({
      key: e.key,
      maskedValue: maskValue(e.value),
      hasValue: e.value.length > 0,
      category: categorizeKey(e.key),
      lastRotated: rotationLog[e.key]?.lastRotated || null,
    }));

    return NextResponse.json({
      keys,
      fileInfo,
      totalKeys: keys.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to read .env.local" },
      { status: 500 }
    );
  }
}

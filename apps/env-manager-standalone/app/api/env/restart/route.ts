import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST() {
  try {
    // Get list of currently online apps
    const { stdout } = await execAsync("pm2 jlist", { timeout: 10000 });
    const pm2Apps = JSON.parse(stdout);
    const onlineApps = pm2Apps.filter(
      (a: any) => a.pm2_env?.status === "online"
    );

    if (onlineApps.length === 0) {
      return NextResponse.json({
        success: true,
        restarted: 0,
        apps: [],
        message: "No apps are currently running",
      });
    }

    // Restart only online apps
    const restarted: string[] = [];
    for (const app of onlineApps) {
      try {
        await execAsync(`pm2 restart ${app.name}`, { timeout: 10000 });
        restarted.push(app.name);
      } catch {
        // Skip failed restarts
      }
    }

    return NextResponse.json({
      success: true,
      restarted: restarted.length,
      apps: restarted,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to restart apps" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const VALID_APPS = new Set([
  "beast",
  "chat-standalone",
  "builder-standalone",
  "diagnostics-standalone",
  "apps-standalone",
  "war-room",
  "guardian-standalone",
  "jury-standalone",
  "debate-standalone",
  "forensic-standalone",
  "trading-standalone",
]);

export async function POST(req: Request) {
  try {
    const { appName, action } = await req.json();

    if (!appName || !action) {
      return NextResponse.json(
        { error: "Missing appName or action" },
        { status: 400 }
      );
    }

    if (!VALID_APPS.has(appName)) {
      return NextResponse.json(
        { error: `Unknown app: ${appName}` },
        { status: 400 }
      );
    }

    if (appName === "builder-standalone") {
      return NextResponse.json(
        { error: "Cannot stop the app serving this launcher" },
        { status: 400 }
      );
    }

    if (action !== "start" && action !== "stop") {
      return NextResponse.json(
        { error: 'Action must be "start" or "stop"' },
        { status: 400 }
      );
    }

    // Sanitize: appName is validated against VALID_APPS set above
    const cmd = `pm2 ${action} ${appName}`;
    await execAsync(cmd, { timeout: 15000 });

    // Brief pause then get new status
    await new Promise((r) => setTimeout(r, 1000));

    const { stdout } = await execAsync("pm2 jlist", { timeout: 10000 });
    const pm2Apps = JSON.parse(stdout);
    const app = pm2Apps.find((a: any) => a.name === appName);

    return NextResponse.json({
      success: true,
      app: {
        name: appName,
        status: app?.pm2_env?.status || (action === "start" ? "online" : "stopped"),
        cpu: app?.monit?.cpu ?? 0,
        memory: app?.monit?.memory ?? 0,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to toggle app" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const APP_PORTS: Record<string, number> = {
  beast: 5000,
  "chat-standalone": 3100,
  "builder-standalone": 3101,
  "diagnostics-standalone": 3102,
  "apps-standalone": 3103,
  "war-room": 3004,
  "guardian-standalone": 3104,
  "jury-standalone": 3105,
  "debate-standalone": 3106,
  "forensic-standalone": 3107,
  "trading-standalone": 3108,
};

export async function GET() {
  try {
    const { stdout } = await execAsync("pm2 jlist", { timeout: 10000 });
    const pm2Apps = JSON.parse(stdout);

    const apps = pm2Apps
      .filter((app: any) => APP_PORTS[app.name] !== undefined)
      .map((app: any) => ({
        name: app.name,
        port: APP_PORTS[app.name],
        status: app.pm2_env?.status || "stopped",
        cpu: app.monit?.cpu ?? 0,
        memory: app.monit?.memory ?? 0,
        uptime: app.pm2_env?.pm_uptime ?? null,
        restarts: app.pm2_env?.restart_time ?? 0,
      }));

    // Add any apps in APP_PORTS that PM2 doesn't know about (not registered)
    const knownNames = new Set(apps.map((a: any) => a.name));
    for (const [name, port] of Object.entries(APP_PORTS)) {
      if (!knownNames.has(name)) {
        apps.push({
          name,
          port,
          status: "stopped",
          cpu: 0,
          memory: 0,
          uptime: null,
          restarts: 0,
        });
      }
    }

    // Sort by port
    apps.sort((a: any, b: any) => a.port - b.port);

    // System totals
    const totalCpu = apps.reduce((sum: number, a: any) => sum + a.cpu, 0);
    const totalMemory = apps.reduce((sum: number, a: any) => sum + a.memory, 0);
    const runningCount = apps.filter((a: any) => a.status === "online").length;

    return NextResponse.json({
      apps,
      system: {
        totalCpu: Math.round(totalCpu),
        totalMemory,
        totalMemoryMB: Math.round(totalMemory / 1024 / 1024),
        runningCount,
        totalCount: apps.length,
      },
    });
  } catch (err: any) {
    // PM2 not running or not installed
    return NextResponse.json(
      {
        apps: Object.entries(APP_PORTS)
          .map(([name, port]) => ({
            name,
            port,
            status: "stopped" as const,
            cpu: 0,
            memory: 0,
            uptime: null,
            restarts: 0,
          }))
          .sort((a, b) => a.port - b.port),
        system: {
          totalCpu: 0,
          totalMemory: 0,
          totalMemoryMB: 0,
          runningCount: 0,
          totalCount: Object.keys(APP_PORTS).length,
        },
        error: err.message,
      },
      { status: 200 }
    );
  }
}

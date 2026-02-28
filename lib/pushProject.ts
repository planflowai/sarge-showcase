/**
 * Push project to GitHub via the deploy API.
 * Beast mirror of packages/builder/src/lib/pushProject.ts
 * targets defaults to ["github"] only to avoid burning hosting credits.
 */
export async function pushProject(
  projectPath: string,
  projectName: string,
  targets: string[] = ["github"]
): Promise<{ success: boolean; message: string; deployResults?: Record<string, string> }> {
  try {
    const res = await fetch("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "push",
        projectPath,
        projectName,
        targets,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, message: data.error || "Push failed" };
    }

    // Build descriptive message from per-target deploy results
    const results: Record<string, string> = data.deployResults || {};
    const succeeded = Object.entries(results).filter(([, v]) => v === "success").map(([k]) => k);
    const failed = Object.entries(results).filter(([, v]) => v === "failed").map(([k]) => k);

    let message: string;
    if (succeeded.length > 0 && failed.length === 0) {
      message = `Pushed to ${succeeded.join(", ")}`;
    } else if (succeeded.length > 0 && failed.length > 0) {
      message = `Pushed to ${succeeded.join(", ")}. Failed: ${failed.join(", ")}`;
    } else if (failed.length > 0) {
      message = `Push failed: ${failed.join(", ")}`;
    } else {
      message = data.message || "Pushed successfully";
    }

    return { success: failed.length === 0, message, deployResults: results };
  } catch (err: any) {
    return { success: false, message: err.message || "Network error" };
  }
}

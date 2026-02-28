/**
 * Push project to GitHub via the deploy API.
 * Beast mirror of packages/builder/src/lib/pushProject.ts
 * targets defaults to ["github"] only to avoid burning hosting credits.
 */
export async function pushProject(
  projectPath: string,
  projectName: string,
  targets: string[] = ["github"]
): Promise<{ success: boolean; message: string }> {
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

    return { success: true, message: data.message || "Pushed successfully" };
  } catch (err: any) {
    return { success: false, message: err.message || "Network error" };
  }
}

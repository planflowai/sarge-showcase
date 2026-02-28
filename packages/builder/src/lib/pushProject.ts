/**
 * Push project to GitHub via the deploy API.
 * Standalone utility — no store dependency.
 */
export async function pushProject(
  projectPath: string,
  projectName: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "push",
        projectPath,
        projectName,
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

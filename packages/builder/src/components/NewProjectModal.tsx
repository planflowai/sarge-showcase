"use client";

/**
 * New Project Modal
 *
 * Opens when user clicks "Use [Template]" button.
 * - Prompts for project name
 * - Checks for folder conflicts
 * - Creates folder and initializes project
 * - Applies template capabilities
 *
 * NOTE: SaaS templates (from saasStore) define CAPABILITIES.
 *       Project templates (from projectTemplates) define STARTER FILES.
 *       This modal bridges both: applies capabilities AND creates files.
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FolderPlus,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type SaaSTemplate } from "@/lib/stores/saasStore";
import { useBuilderStore } from "@/lib/stores/builderStore";
import { PROJECT_TEMPLATES } from "@/lib/projectTemplates";

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: SaaSTemplate | null;
  onProjectCreated?: (projectPath: string, projectName: string) => void;
}

type FolderStatus = "idle" | "checking" | "available" | "exists" | "error";

export default function NewProjectModal({
  isOpen,
  onClose,
  template,
  onProjectCreated,
}: NewProjectModalProps) {
  const [projectName, setProjectName] = useState("");
  const [folderStatus, setFolderStatus] = useState<FolderStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  // Use a base directory that's relative to the app
  const [baseDir] = useState("L:\\ai_builder\\projects");

  const setProject = useBuilderStore((s) => s.setProject);

  // Generate folder name from project name
  const folderName = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const fullPath = `${baseDir}\\${folderName}`;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      // Pre-fill with template name as suggestion
      const suggestedName = template?.name
        ? `My ${template.name}`
        : "My New Project";
      setProjectName(suggestedName);
      setFolderStatus("idle");
      setStatusMessage("");
      setIsCreating(false);
    }
  }, [isOpen, template]);

  // Check folder availability when name changes (debounced)
  useEffect(() => {
    if (!folderName || !isOpen) {
      setFolderStatus("idle");
      return;
    }

    const timer = setTimeout(async () => {
      setFolderStatus("checking");
      setStatusMessage("Checking folder availability...");

      try {
        const res = await fetch("/api/builder/check-folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: fullPath }),
        });

        const data = await res.json();

        if (data.exists) {
          setFolderStatus("exists");
          setStatusMessage(`Folder "${folderName}" already exists. Choose a different name.`);
        } else {
          setFolderStatus("available");
          setStatusMessage(`Folder "${folderName}" is available.`);
        }
      } catch (err) {
        console.error("[NewProjectModal] Error checking folder:", err);
        // Assume available if check fails - we'll handle conflict on create
        setFolderStatus("available");
        setStatusMessage("Ready to create project.");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [folderName, fullPath, isOpen]);

  const handleCreate = async () => {
    if (!folderName || folderStatus === "exists" || isCreating) return;

    setIsCreating(true);
    setStatusMessage("Creating project folder...");

    try {
      // Create the folder
      const res = await fetch("/api/builder/create-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: fullPath,
          name: projectName,
          templateId: template?.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      // Update builder store - set project with the created files tree
      // If the API returned files, use them; otherwise set an empty tree
      const fileTree = data.files || [];
      setProject(fullPath, projectName, fileTree);

      console.log("[NewProjectModal] Project created:", fullPath);

      // Notify parent
      onProjectCreated?.(fullPath, projectName);
      onClose();
    } catch (err: any) {
      console.error("[NewProjectModal] Error creating project:", err);
      setFolderStatus("error");
      setStatusMessage(err.message || "Failed to create project folder.");
      setIsCreating(false);
    }
  };

  const getStatusIcon = () => {
    switch (folderStatus) {
      case "checking":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "available":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "exists":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Folder className="h-4 w-4 text-zinc-400" />;
    }
  };

  const canCreate = folderName && folderStatus === "available" && !isCreating;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-purple-500" />
            New Project
          </DialogTitle>
          <DialogDescription>
            {template ? (
              <>
                Create a new project using the{" "}
                <span className="font-medium text-purple-600 dark:text-purple-400">
                  {template.icon} {template.name}
                </span>{" "}
                template.
              </>
            ) : (
              "Create a new project folder."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My Awesome Game"
              disabled={isCreating}
              autoFocus
            />
          </div>

          {/* Folder Path Preview */}
          <div className="space-y-2">
            <Label className="text-xs text-zinc-500">Folder Location</Label>
            <div
              className={cn(
                "flex items-center gap-2 p-2 rounded-md border text-sm font-mono",
                folderStatus === "exists"
                  ? "border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30"
                  : folderStatus === "available"
                  ? "border-green-300 bg-green-50 dark:bg-green-500/10 dark:border-green-500/30"
                  : folderStatus === "error"
                  ? "border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30"
                  : "border-zinc-200 bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-700"
              )}
            >
              {getStatusIcon()}
              <span className="truncate text-xs">
                {folderName ? fullPath : "Enter a project name..."}
              </span>
            </div>
            {statusMessage && (
              <p
                className={cn(
                  "text-xs",
                  folderStatus === "exists"
                    ? "text-amber-600 dark:text-amber-400"
                    : folderStatus === "available"
                    ? "text-green-600 dark:text-green-400"
                    : folderStatus === "error"
                    ? "text-red-600 dark:text-red-400"
                    : "text-zinc-500"
                )}
              >
                {statusMessage}
              </p>
            )}
          </div>

          {/* Template Capabilities Preview */}
          {template && template.enabledCapabilities.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-zinc-500">
                Capabilities ({template.enabledCapabilities.length})
              </Label>
              <div className="flex flex-wrap gap-1">
                {template.enabledCapabilities.slice(0, 5).map((cap) => (
                  <span
                    key={cap}
                    className="px-2 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 rounded"
                  >
                    {cap.replace(/_/g, " ")}
                  </span>
                ))}
                {template.enabledCapabilities.length > 5 && (
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400 rounded">
                    +{template.enabledCapabilities.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!canCreate}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <FolderPlus className="h-4 w-4 mr-2" />
                Create Project
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

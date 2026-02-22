"use client";

import { ChevronRight, ChevronDown, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileNode, getFileIcon, useBuilderStore } from "@/lib/stores/builderStore";

interface FileTreeProps {
  nodes: FileNode[];
  onFileSelect: (path: string) => void;
  level?: number;
}

function FileTreeNode({
  node,
  onFileSelect,
  level = 0,
}: {
  node: FileNode;
  onFileSelect: (path: string) => void;
  level: number;
}) {
  const { expandedFolders, toggleFolder, currentFilePath } = useBuilderStore();
  const isExpanded = expandedFolders.includes(node.path);
  const isSelected = currentFilePath === node.path;

  const handleClick = () => {
    if (node.type === 'directory') {
      toggleFolder(node.path);
    } else {
      onFileSelect(node.path);
    }
  };

  const indent = level * 12;

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1 w-full px-2 py-1 text-left text-sm rounded-md transition-colors",
          "hover:bg-zinc-200 dark:hover:bg-zinc-800",
          isSelected && node.type === 'file' && "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
        )}
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        {node.type === 'directory' ? (
          <>
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 text-amber-500 flex-shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-amber-500 flex-shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 flex-shrink-0" />
            <span className="text-sm flex-shrink-0">{getFileIcon(node.name)}</span>
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {node.type === 'directory' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              onFileSelect={onFileSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ nodes, onFileSelect, level = 0 }: FileTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-xs text-zinc-500">
        No files found
      </div>
    );
  }

  return (
    <div className="py-1">
      {nodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          onFileSelect={onFileSelect}
          level={level}
        />
      ))}
    </div>
  );
}

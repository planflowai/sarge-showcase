/**
 * Shared attachment utilities for chat inputs (main chat + builder chat)
 */

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string; // text content or base64 data URL for images
  isImage: boolean;
}

export async function readFileAsAttachment(file: File): Promise<Attachment> {
  const isImage = file.type.startsWith("image/");

  const content = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    if (isImage) {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(file);
    }
  });

  return {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type,
    size: file.size,
    content,
    isImage,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Read a project file as an attachment via the builder API
 */
export async function readProjectFileAsAttachment(
  filePath: string,
  projectPath: string
): Promise<Attachment | null> {
  try {
    const response = await fetch('/api/builder/read-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, projectPath, binary: true }),
    });

    const data = await response.json();
    if (!data.success) return null;

    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const imageExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'avif', 'svg']);
    const isImage = imageExts.has(ext);
    const fileName = filePath.split(/[/\\]/).pop() || filePath;

    return {
      id: crypto.randomUUID(),
      name: fileName,
      type: isImage ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'text/plain',
      size: data.content?.length || 0,
      content: data.content || '',
      isImage,
    };
  } catch {
    return null;
  }
}

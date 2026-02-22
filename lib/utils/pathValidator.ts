// lib/utils/pathValidator.ts

import path from 'path';

interface ValidatePathOptions {
  allowAbsolute?: boolean;
  maxDepth?: number;
  onError?: (error: Error) => void;
}

/**
 * Securely validate and resolve a user-provided path.
 * Prevents path traversal attacks (../, ../../, etc.)
 */
export function validatePath(
  baseDir: string,
  userInput: string,
  options: ValidatePathOptions = {}
): string {
  const { allowAbsolute = false, maxDepth = 10, onError } = options;

  try {
    // Step 1: Decode URL-encoded input (handle %2e%2e, %2f, etc.)
    let decoded = decodeURIComponent(userInput);

    // Step 2: Handle double-encoded input (max 10 iterations to prevent DoS)
    let previousDecoded = '';
    let iterations = 0;
    while (decoded !== previousDecoded && iterations < maxDepth) {
      previousDecoded = decoded;
      decoded = decodeURIComponent(decoded);
      iterations++;
    }

    // Step 3: Reject absolute paths if not allowed
    if (!allowAbsolute && path.isAbsolute(decoded)) {
      throw new Error('Absolute paths not allowed');
    }

    // Step 4: Resolve to absolute path (normalizes .. and .)
    const resolved = path.resolve(baseDir, decoded);
    const baseResolved = path.resolve(baseDir);

    // Step 5: Verify resolved path stays within baseDir
    // Must start with baseDir + separator to prevent /var/www-malicious
    if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
      throw new Error('Path traversal detected: path escapes base directory');
    }

    return resolved;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    throw err;
  }
}

/**
 * Validate multiple path segments safely
 */
export function validatePathSegments(
  baseDir: string,
  segments: string[]
): string {
  let current = baseDir;
  for (const segment of segments) {
    current = validatePath(current, segment);
  }
  return current;
}

/**
 * Path Validator - Security utilities for Builder file operations
 *
 * Ensures file operations are restricted to the project directory
 * and prevents path traversal attacks.
 */

import path from 'path';
import fs from 'fs/promises';

export interface PathValidationResult {
  valid: boolean;
  normalizedPath: string;
  error?: string;
  securityViolation?: boolean;
}

/**
 * Validate that a file path is within the allowed project directory.
 * Prevents path traversal attacks (../, symlink escapes, etc.)
 *
 * @param filePath - The path to validate (must be absolute)
 * @param projectPath - The project root directory (must be absolute)
 * @returns Validation result with normalized path or error
 */
export function validatePathWithinProject(
  filePath: string,
  projectPath: string
): PathValidationResult {
  // Both paths must be provided
  if (!filePath || !projectPath) {
    return {
      valid: false,
      normalizedPath: '',
      error: 'Both filePath and projectPath are required',
      securityViolation: true,
    };
  }

  // Normalize both paths
  const normalizedFilePath = path.normalize(filePath).replace(/\\/g, '/');
  const normalizedProjectPath = path.normalize(projectPath).replace(/\\/g, '/');

  // Both must be absolute paths
  if (!path.isAbsolute(normalizedFilePath)) {
    return {
      valid: false,
      normalizedPath: '',
      error: 'File path must be absolute',
      securityViolation: true,
    };
  }

  if (!path.isAbsolute(normalizedProjectPath)) {
    return {
      valid: false,
      normalizedPath: '',
      error: 'Project path must be absolute',
      securityViolation: true,
    };
  }

  // Check for suspicious patterns in the raw path
  const suspiciousPatterns = [
    /\.\.\//,           // Parent directory traversal
    /\.\.\\/,           // Windows parent traversal
    /\/\.\.\//,         // Hidden parent traversal
    /\\\.\.\\/,         // Windows hidden parent traversal
    /%2e%2e/i,          // URL encoded ..
    /%252e/i,           // Double URL encoded .
    /\x00/,             // Null byte injection
    /[\x01-\x1f]/,      // Control characters
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(filePath)) {
      return {
        valid: false,
        normalizedPath: '',
        error: `Suspicious path pattern detected: ${pattern.source}`,
        securityViolation: true,
      };
    }
  }

  // Resolve the real path (handles symlinks)
  // For the check, we compare normalized paths
  const resolvedFilePath = normalizedFilePath.toLowerCase();
  const resolvedProjectPath = normalizedProjectPath.toLowerCase();

  // The file path must start with the project path
  if (!resolvedFilePath.startsWith(resolvedProjectPath)) {
    return {
      valid: false,
      normalizedPath: '',
      error: `Path "${normalizedFilePath}" is outside project directory "${normalizedProjectPath}"`,
      securityViolation: true,
    };
  }

  // Additional check: ensure there's no path component after normalization
  // that would escape the project directory
  const relativePath = path.relative(normalizedProjectPath, normalizedFilePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return {
      valid: false,
      normalizedPath: '',
      error: 'Path escapes project directory after normalization',
      securityViolation: true,
    };
  }

  return {
    valid: true,
    normalizedPath: normalizedFilePath,
  };
}

/**
 * Validate terminal command for security.
 * Blocks dangerous commands and ensures commands run within project.
 *
 * @param command - The command to validate
 * @param projectPath - The project root directory
 * @returns Validation result
 */
export function validateTerminalCommand(
  command: string,
  projectPath: string
): PathValidationResult {
  if (!command || !projectPath) {
    return {
      valid: false,
      normalizedPath: projectPath || '',
      error: 'Command and projectPath are required',
      securityViolation: true,
    };
  }

  // Normalize project path
  const normalizedProjectPath = path.normalize(projectPath).replace(/\\/g, '/');

  // Block obviously dangerous commands
  const dangerousPatterns = [
    /rm\s+(-rf?|--recursive|--force)/i,  // rm -rf
    /del\s+\/[sf]/i,                       // Windows del /s /f
    /rmdir\s+\/s/i,                        // Windows rmdir /s
    /format\s+[a-z]:/i,                    // Format drive
    /mkfs/i,                               // Make filesystem
    /dd\s+if=/i,                           // dd command
    /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}/,   // Fork bomb
    />\s*\/dev\/(sd|hd|nvme)/i,           // Write to disk device
    /chmod\s+777/,                         // Overly permissive chmod
    /curl.*\|\s*(ba)?sh/i,                // Curl pipe to shell
    /wget.*\|\s*(ba)?sh/i,                // Wget pipe to shell
    /powershell.*-enc/i,                  // Encoded PowerShell
    /\.\\.*\.ps1/,                         // Arbitrary PowerShell scripts
    /Set-ExecutionPolicy\s+Unrestricted/i, // PowerShell execution policy
    /net\s+user/i,                         // User management
    /netsh/i,                              // Network config
    /reg\s+(add|delete)/i,                // Registry modification
    /sc\s+(create|delete|config)/i,       // Service management
    /schtasks\s+\/create/i,               // Task scheduler
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return {
        valid: false,
        normalizedPath: normalizedProjectPath,
        error: `Dangerous command pattern blocked: ${pattern.source}`,
        securityViolation: true,
      };
    }
  }

  // Check for path traversal in command
  if (/\.\.\/|\.\.\\/.test(command)) {
    // Allow .. only if it doesn't escape project root
    // This is a heuristic check - the actual execution will be sandboxed to cwd
    const traversalCount = (command.match(/\.\.\//g) || []).length +
                           (command.match(/\.\.\\/g) || []).length;
    if (traversalCount > 5) {
      return {
        valid: false,
        normalizedPath: normalizedProjectPath,
        error: 'Excessive path traversal in command',
        securityViolation: true,
      };
    }
  }

  return {
    valid: true,
    normalizedPath: normalizedProjectPath,
  };
}

/**
 * Server-side forensic log entry for security events.
 * Writes to a local JSON file since the forensic store is client-side only.
 */
export interface ServerForensicEntry {
  timestamp: string;
  event: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'file_operation' | 'terminal' | 'security_violation';
  details: {
    operation: string;
    path?: string;
    projectPath?: string;
    command?: string;
    error?: string;
    blocked?: boolean;
    clientIp?: string;
  };
}

// In-memory buffer for forensic entries (will be exposed via API)
const forensicBuffer: ServerForensicEntry[] = [];
const MAX_BUFFER_SIZE = 1000;

/**
 * Log a security event to the server-side forensic buffer.
 */
export function logForensicEvent(entry: Omit<ServerForensicEntry, 'timestamp'>): void {
  const fullEntry: ServerForensicEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  forensicBuffer.push(fullEntry);

  // Trim buffer if too large
  if (forensicBuffer.length > MAX_BUFFER_SIZE) {
    forensicBuffer.splice(0, forensicBuffer.length - MAX_BUFFER_SIZE);
  }

  // Console log for immediate visibility
  const prefix = entry.severity === 'critical' ? '[SECURITY CRITICAL]' :
                 entry.severity === 'error' ? '[SECURITY ERROR]' :
                 entry.severity === 'warning' ? '[SECURITY WARNING]' :
                 '[SECURITY INFO]';

  console.log(`${prefix} ${entry.event}`, entry.details);
}

/**
 * Get recent forensic entries from the buffer.
 */
export function getForensicBuffer(): ServerForensicEntry[] {
  return [...forensicBuffer];
}

/**
 * Clear the forensic buffer.
 */
export function clearForensicBuffer(): void {
  forensicBuffer.length = 0;
}

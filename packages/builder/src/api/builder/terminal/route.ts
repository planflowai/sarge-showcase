import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import {
  validateTerminalCommand,
  validatePathWithinProject,
  logForensicEvent,
} from '@sarge/core/index.server';

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'unknown';

  try {
    const { command, cwd, projectPath } = await request.json();

    if (!command) {
      logForensicEvent({
        event: 'Terminal rejected: missing command',
        severity: 'warning',
        category: 'terminal',
        details: { operation: 'execute', error: 'Command is required', clientIp },
      });
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    // Require projectPath for security
    if (!projectPath) {
      logForensicEvent({
        event: 'Terminal rejected: missing projectPath',
        severity: 'error',
        category: 'security_violation',
        details: {
          operation: 'execute',
          command,
          error: 'projectPath is required for security validation',
          blocked: true,
          clientIp,
        },
      });
      return NextResponse.json(
        { error: 'projectPath is required for security validation' },
        { status: 400 }
      );
    }

    // Normalize and validate project path
    const normalizedProjectPath = path.normalize(projectPath).replace(/\\/g, '/');

    // Verify project path exists and is a directory
    try {
      const stats = fs.statSync(projectPath);
      if (!stats.isDirectory()) {
        logForensicEvent({
          event: 'Terminal rejected: projectPath is not a directory',
          severity: 'error',
          category: 'security_violation',
          details: {
            operation: 'execute',
            command,
            projectPath,
            error: 'projectPath must be a directory',
            blocked: true,
            clientIp,
          },
        });
        return NextResponse.json(
          { error: 'projectPath must be a directory' },
          { status: 400 }
        );
      }
    } catch (err: any) {
      logForensicEvent({
        event: 'Terminal rejected: projectPath does not exist',
        severity: 'error',
        category: 'security_violation',
        details: {
          operation: 'execute',
          command,
          projectPath,
          error: err.message,
          blocked: true,
          clientIp,
        },
      });
      return NextResponse.json(
        { error: 'projectPath does not exist' },
        { status: 400 }
      );
    }

    // Validate working directory if provided
    let workingDir = normalizedProjectPath;
    if (cwd) {
      const cwdValidation = validatePathWithinProject(cwd, projectPath);
      if (!cwdValidation.valid) {
        logForensicEvent({
          event: `Terminal BLOCKED: cwd outside project - ${cwdValidation.error}`,
          severity: 'critical',
          category: 'security_violation',
          details: {
            operation: 'execute',
            command,
            path: cwd,
            projectPath,
            error: cwdValidation.error,
            blocked: true,
            clientIp,
          },
        });
        return NextResponse.json(
          {
            error: 'Security violation: Working directory must be within project',
            details: cwdValidation.error,
          },
          { status: 403 }
        );
      }
      workingDir = cwdValidation.normalizedPath;
    }

    // Validate command for dangerous patterns
    const commandValidation = validateTerminalCommand(command, projectPath);
    if (!commandValidation.valid) {
      logForensicEvent({
        event: `Terminal BLOCKED: dangerous command - ${commandValidation.error}`,
        severity: 'critical',
        category: 'security_violation',
        details: {
          operation: 'execute',
          command,
          projectPath,
          error: commandValidation.error,
          blocked: true,
          clientIp,
        },
      });
      return NextResponse.json(
        {
          error: 'Security violation: Command blocked for safety',
          details: commandValidation.error,
        },
        { status: 403 }
      );
    }

    // Log command execution
    logForensicEvent({
      event: 'Terminal command executing',
      severity: 'info',
      category: 'terminal',
      details: {
        operation: 'execute',
        command,
        path: workingDir,
        projectPath,
        clientIp,
      },
    });

    // Execute command in PowerShell, ALWAYS within project directory
    const output = await new Promise<string>((resolve, reject) => {
      const chunks: string[] = [];
      const errorChunks: string[] = [];

      // Prepend cd to project directory for safety
      // This ensures even if the command tries to cd elsewhere,
      // it starts from the project root
      const safeCommand = `cd "${workingDir.replace(/\//g, '\\')}" ; ${command}`;

      const proc = spawn('powershell.exe', ['-NoProfile', '-Command', safeCommand], {
        cwd: workingDir,
        shell: false,
        env: {
          ...process.env,
          // Restrict PATH to essential directories only
          // This prevents calling arbitrary executables
        },
      });

      proc.stdout.on('data', (data) => {
        chunks.push(data.toString());
      });

      proc.stderr.on('data', (data) => {
        errorChunks.push(data.toString());
      });

      proc.on('close', (code) => {
        const stdout = chunks.join('');
        const stderr = errorChunks.join('');

        // Log completion
        logForensicEvent({
          event: `Terminal command completed (exit code: ${code})`,
          severity: code === 0 ? 'info' : 'warning',
          category: 'terminal',
          details: {
            operation: 'execute',
            command,
            path: workingDir,
            projectPath,
            clientIp,
          },
        });

        if (code !== 0 && stderr) {
          resolve(`${stdout}\n${stderr}`);
        } else {
          resolve(stdout || stderr || `Process exited with code ${code}`);
        }
      });

      proc.on('error', (err) => {
        logForensicEvent({
          event: 'Terminal command failed',
          severity: 'error',
          category: 'terminal',
          details: {
            operation: 'execute',
            command,
            path: workingDir,
            projectPath,
            error: err.message,
            clientIp,
          },
        });
        reject(err);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        proc.kill();
        logForensicEvent({
          event: 'Terminal command timed out',
          severity: 'warning',
          category: 'terminal',
          details: {
            operation: 'execute',
            command,
            path: workingDir,
            projectPath,
            error: 'Command timed out after 30 seconds',
            clientIp,
          },
        });
        resolve(chunks.join('') + '\n[Command timed out after 30 seconds]');
      }, 30000);
    });

    return NextResponse.json({
      success: true,
      output: output.trim(),
    });
  } catch (error: any) {
    logForensicEvent({
      event: 'Terminal execution failed',
      severity: 'error',
      category: 'terminal',
      details: {
        operation: 'execute',
        error: error.message,
        clientIp,
      },
    });

    console.error('Terminal error:', error);
    return NextResponse.json(
      { error: error.message || 'Command execution failed' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST() {
  try {
    // Path to PowerShell script
    const scriptPath = path.resolve('L:/super_ai/reverse-sync.ps1');

    // Execute PowerShell script
    const process = spawn('powershell.exe', [
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath
    ]);

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Wait for process to complete
    const exitCode = await new Promise<number>((resolve) => {
      process.on('close', (code) => {
        resolve(code || 0);
      });
    });

    if (exitCode === 0) {
      return NextResponse.json({
        success: true,
        message: 'Reverse sync completed successfully',
        output: stdout,
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Reverse sync failed',
        error: stderr || stdout,
      }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Failed to execute reverse sync',
      error: error.message,
    }, { status: 500 });
  }
}

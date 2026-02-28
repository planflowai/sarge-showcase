import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

/**
 * POST /api/builder/browse-folder
 *
 * Opens the native OS folder picker dialog and returns the selected path.
 * Used because browsers block reading file paths from drag-and-drop events.
 *
 * Windows: PowerShell FolderBrowserDialog (via -EncodedCommand)
 * macOS:   osascript choose folder
 * Linux:   zenity or kdialog
 */
export async function POST() {
  const platform = os.platform();

  try {
    let selectedPath = '';

    if (platform === 'win32') {
      // PowerShell script — use EncodedCommand to avoid shell quoting issues
      const script = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$form = New-Object System.Windows.Forms.Form',
        '$form.TopMost = $true',
        '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
        '$dialog.Description = "Select Project Folder"',
        '$dialog.ShowNewFolderButton = $false',
        'if ($dialog.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {',
        '  Write-Output $dialog.SelectedPath',
        '}',
      ].join('\n');

      // Encode as UTF-16LE base64 (PowerShell -EncodedCommand format)
      const encoded = Buffer.from(script, 'utf16le').toString('base64');

      const { stdout } = await execAsync(
        `powershell -NonInteractive -EncodedCommand ${encoded}`,
        { timeout: 30000 }
      );
      selectedPath = stdout.trim();

    } else if (platform === 'darwin') {
      const { stdout } = await execAsync(
        "osascript -e 'tell app \"Finder\" to POSIX path of (choose folder with prompt \"Select Project Folder\")'",
        { timeout: 30000 }
      );
      selectedPath = stdout.trim();

    } else {
      // Linux — try zenity, then kdialog
      try {
        const { stdout } = await execAsync(
          'zenity --file-selection --directory --title="Select Project Folder"',
          { timeout: 30000 }
        );
        selectedPath = stdout.trim();
      } catch {
        const { stdout } = await execAsync(
          'kdialog --getexistingdirectory "$HOME"',
          { timeout: 30000 }
        );
        selectedPath = stdout.trim();
      }
    }

    if (!selectedPath) {
      // User cancelled — not an error
      return NextResponse.json({ cancelled: true });
    }

    return NextResponse.json({ path: selectedPath });

  } catch (error: any) {
    console.error('[browse-folder] Error:', error?.message);
    // If the user simply cancelled, PowerShell exits with code 1 but stdout is empty
    if (!error?.stdout?.trim() && !error?.stderr?.trim()) {
      return NextResponse.json({ cancelled: true });
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to open folder picker' },
      { status: 500 }
    );
  }
}

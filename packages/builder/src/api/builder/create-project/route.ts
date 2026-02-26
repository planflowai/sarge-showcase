import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getTemplateById, type ProjectTemplate } from '../../../lib/projectTemplates';
import {
  validatePathWithinProject,
  logForensicEvent,
} from '@sarge/core';

const BUILDER_PROJECTS_DIR =
  process.env.BUILDER_PROJECTS_DIR ||
  (process.platform === 'win32' ? 'L:/ai_builder/projects' : '/ai_builder/projects');

// Default starter template for when no matching template is found
const DEFAULT_STARTER: ProjectTemplate = {
  id: 'default',
  name: 'Default',
  description: 'Default starter',
  icon: '📁',
  files: [
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Project</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .container {
      text-align: center;
      padding: 3rem;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      max-width: 500px;
    }
    h1 { color: #1e293b; font-size: 2.5rem; margin-bottom: 1rem; }
    p { color: #64748b; font-size: 1.125rem; line-height: 1.6; }
    .badge {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 0.5rem 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>My Project</h1>
    <p>Your new project is ready. Start building something amazing!</p>
    <span class="badge">🚀 Built with AI Builder</span>
  </div>
</body>
</html>`,
    },
  ],
};

export async function POST(request: NextRequest) {
  const clientIp =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    const { templateId, projectPath, projectName, path: altPath, name: altName } = await request.json();

    // Support both parameter naming conventions
    const finalPath = projectPath || altPath;
    const finalName = projectName || altName;

    console.log('[create-project] Request:', { templateId, finalPath, finalName });

    if (!finalPath) {
      return NextResponse.json({ error: 'Project path is required' }, { status: 400 });
    }

    // Try to find template, fall back to default if not found
    let template = templateId ? getTemplateById(templateId) : null;

    if (!template) {
      console.log('[create-project] Template not found, using default starter:', templateId);
      template = DEFAULT_STARTER;
    }

    // Normalize path
    const normalizedPath = path.normalize(finalPath);

    // Check if path is absolute
    if (!path.isAbsolute(normalizedPath)) {
      return NextResponse.json({ error: 'Project path must be absolute' }, { status: 400 });
    }

    // Security: validate the target path is within BUILDER_PROJECTS_DIR sandbox
    const sandboxValidation = validatePathWithinProject(normalizedPath, BUILDER_PROJECTS_DIR);
    if (!sandboxValidation.valid) {
      logForensicEvent({
        event: `create-project BLOCKED: path outside sandbox — ${sandboxValidation.error}`,
        severity: 'critical',
        category: 'security_violation',
        details: {
          operation: 'create-project',
          path: finalPath,
          projectPath: BUILDER_PROJECTS_DIR,
          error: sandboxValidation.error,
          blocked: true,
          clientIp,
        },
      });
      return NextResponse.json(
        { error: 'Access denied: path outside sandbox' },
        { status: 403 }
      );
    }

    // Create project directory
    console.log('[create-project] Creating directory:', normalizedPath);
    await fs.mkdir(normalizedPath, { recursive: true });

    // Write template files
    for (const file of template.files) {
      const filePath = path.join(normalizedPath, file.path);
      const fileDir = path.dirname(filePath);

      // Ensure directory exists
      await fs.mkdir(fileDir, { recursive: true });

      // Write file
      console.log('[create-project] Writing file:', filePath);
      await fs.writeFile(filePath, file.content, 'utf-8');
    }

    // Create BUILDER_LOG.md
    const logContent = `# Builder Log — ${finalName || path.basename(normalizedPath)}
Last updated: ${new Date().toLocaleString()}

## Current State
Project created from "${template.name}" template.

## Session: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
### Changes Made
- ✨ Created project from ${template.name} template
${template.files.map(f => `- ✨ Created \`${f.path}\``).join('\n')}

### Current Plan
*New project - ready to customize.*

### Next Steps
- [ ] Review generated files
- [ ] Customize the template
- [ ] Add your content
`;

    await fs.writeFile(
      path.join(normalizedPath, 'BUILDER_LOG.md'),
      logContent,
      'utf-8'
    );

    console.log('[create-project] Project created successfully');

    return NextResponse.json({
      success: true,
      projectPath: normalizedPath,
      projectName: finalName || path.basename(normalizedPath),
      template: template.name,
      filesCreated: template.files.length + 1, // +1 for BUILDER_LOG.md
    });
  } catch (error: any) {
    console.error('[create-project] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create project' },
      { status: 500 }
    );
  }
}

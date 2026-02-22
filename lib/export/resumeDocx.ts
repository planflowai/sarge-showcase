import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

export async function exportResumeToDocx(
  resumeText: string,
  fileName: string = 'resume'
) {
  const lines = resumeText.split('\n');
  const children: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      children.push(new Paragraph({ text: '' }));
      continue;
    }

    // ALL CAPS lines → section header style
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 2 && !trimmed.startsWith('-')) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed, bold: true, size: 24 })],
          spacing: { before: 200, after: 100 },
          border: { bottom: { color: '000000', size: 6, style: 'single' } },
        })
      );
    } else if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
      // Bullet points
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed.slice(1).trim(), size: 20 })],
          bullet: { level: 0 },
          spacing: { after: 40 },
        })
      );
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed, size: 20 })],
          spacing: { after: 60 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        children,
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 900, right: 900 },
          },
        },
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${fileName.replace(/\s+/g, '-').toLowerCase()}.docx`);
}

export async function exportCoverLetterToDocx(
  text: string,
  jobTitle: string = 'cover-letter'
) {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  const children: Paragraph[] = paragraphs.map(
    (para) =>
      new Paragraph({
        children: [new TextRun({ text: para.trim(), size: 22 })],
        spacing: { after: 240 },
        alignment: AlignmentType.JUSTIFIED,
      })
  );

  const doc = new Document({
    sections: [
      {
        children,
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 900, right: 900 },
          },
        },
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${jobTitle.replace(/\s+/g, '-').toLowerCase()}-cover-letter.docx`);
}

import { jsPDF } from 'jspdf';

export function exportResumeToPDF(resumeText: string, fileName: string = 'resume') {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);

  const paragraphs = resumeText.split(/\n\n+/);

  for (const para of paragraphs) {
    if (!para.trim()) continue;
    const lines = doc.splitTextToSize(para.trim(), maxWidth);

    for (const line of lines) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }

      // ALL CAPS lines = section headers, render bold
      if (line === line.toUpperCase() && line.trim().length > 2) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
      }

      doc.text(line, margin, y);
      y += 5;
    }
    y += 3; // paragraph gap
  }

  doc.save(`${fileName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

export function exportCoverLetterToPDF(text: string, jobTitle: string = 'cover-letter') {
  const doc = new jsPDF();
  const margin = 25;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = 30;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);

  const paragraphs = text.split(/\n\n+/);

  for (const para of paragraphs) {
    if (!para.trim()) continue;
    const lines = doc.splitTextToSize(para.trim(), maxWidth);

    for (const line of lines) {
      if (y > 270) {
        doc.addPage();
        y = 30;
      }
      doc.text(line, margin, y);
      y += 6;
    }
    y += 8; // larger gap between paragraphs
  }

  doc.save(`${jobTitle.replace(/\s+/g, '-').toLowerCase()}-cover-letter.pdf`);
}

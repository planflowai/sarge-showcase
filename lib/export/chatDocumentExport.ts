/**
 * Chat Document Exports
 * Generates and downloads files in various formats (PPTX, PDF, DOCX, XLSX, CSV, ZIP)
 */

import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, AlignmentType, UnderlineType } from 'docx';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import PptxGenJS from 'pptxgenjs';

/**
 * Generate and download a PowerPoint presentation
 */
export async function generateAndDownloadPptx(data: {
  title: string;
  slides: Array<{ title: string; content: string[]; notes?: string }>;
}): Promise<void> {
  try {
    const pptx = new PptxGenJS();
    pptx.title = data.title;
    pptx.subject = 'Generated Presentation';
    pptx.author = 'AI Builder';

    for (const slide of data.slides) {
      const s = pptx.addSlide();

      // Slide title
      s.addText(slide.title, {
        x: 0.5,
        y: 0.3,
        w: '90%',
        fontSize: 28,
        bold: true,
        color: '1a1a1a',
      });

      // Slide content (bullets)
      let bulletY = 1.2;
      for (const bullet of slide.content) {
        s.addText(bullet, {
          x: 0.7,
          y: bulletY,
          w: '85%',
          fontSize: 14,
          color: '333333',
          bullet: { type: 'bullet' },
          align: 'left',
        });
        bulletY += 0.4;
      }

      // Speaker notes
      if (slide.notes) {
        s.addNotes(slide.notes);
      }
    }

    const fileName = `${data.title.replace(/\s+/g, '-').toLowerCase()}.pptx`;
    await pptx.writeFile({ fileName });
  } catch (err) {
    console.error('PPTX generation failed:', err);
    throw new Error(`PowerPoint generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Generate and download an Excel spreadsheet
 */
export async function generateAndDownloadXlsx(data: {
  filename: string;
  sheets: Array<{ name: string; headers: string[]; rows: string[][] }>;
}): Promise<void> {
  try {
    const wb = XLSX.utils.book_new();

    for (const sheet of data.sheets) {
      const wsData = [sheet.headers, ...sheet.rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Auto-fit columns
      const colWidths = sheet.headers.map((h) => Math.max(h.length + 2, 12));
      ws['!cols'] = colWidths.map((w) => ({ wch: w }));

      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    }

    const fileName = `${data.filename.replace(/\s+/g, '-').toLowerCase()}.xlsx`;
    XLSX.writeFile(wb, fileName);
  } catch (err) {
    console.error('XLSX generation failed:', err);
    throw new Error(`Excel generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Generate and download a PDF document
 */
export function generateAndDownloadPdf(data: {
  title: string;
  sections: Array<{ heading?: string; content: string }>;
}): void {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(data.title, margin, y);
    y += 12;

    // Sections
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);

    for (const section of data.sections) {
      // Page break if needed
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      // Section heading
      if (section.heading) {
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(section.heading, margin, y);
        y += 7;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
      }

      // Section content
      const lines = doc.splitTextToSize(section.content, maxWidth);
      for (const line of lines) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += 5;
      }

      y += 5;
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, 290, { align: 'center' });
    }

    const fileName = `${data.title.replace(/\s+/g, '-').toLowerCase()}.pdf`;
    doc.save(fileName);
  } catch (err) {
    console.error('PDF generation failed:', err);
    throw new Error(`PDF generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Generate and download a Word document
 */
export async function generateAndDownloadDocx(data: {
  title: string;
  sections: Array<{ heading?: string; content: string }>;
}): Promise<void> {
  try {
    const paragraphs: Paragraph[] = [
      new Paragraph({
        text: data.title,
        style: 'Heading1',
        spacing: { after: 400 },
      }),
    ];

    for (const section of data.sections) {
      if (section.heading) {
        paragraphs.push(
          new Paragraph({
            text: section.heading,
            style: 'Heading2',
            spacing: { before: 200, after: 200 },
          })
        );
      }

      paragraphs.push(
        new Paragraph({
          text: section.content,
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED,
        })
      );
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const fileName = `${data.title.replace(/\s+/g, '-').toLowerCase()}.docx`;
    saveAs(blob, fileName);
  } catch (err) {
    console.error('DOCX generation failed:', err);
    throw new Error(`Word generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Generate and download a CSV file
 */
export function generateAndDownloadCsv(data: {
  filename: string;
  headers: string[];
  rows: string[][];
}): void {
  try {
    // Escape CSV values
    const escapeCsv = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      data.headers.map(escapeCsv).join(','),
      ...data.rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const fileName = `${data.filename.replace(/\s+/g, '-').toLowerCase()}.csv`;
    saveAs(blob, fileName);
  } catch (err) {
    console.error('CSV generation failed:', err);
    throw new Error(`CSV generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Generate and download a ZIP archive
 */
export async function generateAndDownloadZip(data: {
  filename: string;
  files: Array<{ name: string; content: string }>;
}): Promise<void> {
  try {
    const zip = new JSZip();

    for (const file of data.files) {
      zip.file(file.name, file.content);
    }

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const fileName = `${data.filename.replace(/\s+/g, '-').toLowerCase()}.zip`;
    saveAs(blob, fileName);
  } catch (err) {
    console.error('ZIP generation failed:', err);
    throw new Error(`ZIP generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

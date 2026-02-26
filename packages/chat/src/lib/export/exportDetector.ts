/**
 * Export Intent Detector
 * Recognizes when user wants to export/create a file (PPTX, PDF, DOCX, XLSX, CSV, ZIP)
 */

export type ExportFormat = 'pptx' | 'pdf' | 'docx' | 'xlsx' | 'csv' | 'zip';

const patterns: Record<ExportFormat, RegExp[]> = {
  pptx: [
    /create.*powerpoint/i,
    /make.*powerpoint/i,
    /export.*pptx/i,
    /generate.*presentation/i,
    /build.*slides/i,
    /create.*slides/i,
    /make.*presentation/i,
  ],
  pdf: [
    /create.*pdf/i,
    /export.*pdf/i,
    /save.*pdf/i,
    /make.*pdf/i,
    /generate.*pdf/i,
  ],
  docx: [
    /create.*word/i,
    /export.*word/i,
    /save.*docx/i,
    /make.*word doc/i,
    /export.*docx/i,
    /create.*document/i,
  ],
  xlsx: [
    /create.*excel/i,
    /export.*excel/i,
    /make.*spreadsheet/i,
    /create.*xlsx/i,
    /export.*xlsx/i,
    /generate.*spreadsheet/i,
    /make.*excel/i,
  ],
  csv: [
    /create.*csv/i,
    /export.*csv/i,
    /make.*csv/i,
    /generate.*csv/i,
  ],
  zip: [
    /create.*zip/i,
    /export.*zip/i,
    /make.*zip/i,
    /bundle.*files/i,
    /create.*archive/i,
  ],
};

/**
 * Detect if the user is asking to export/create a file
 * @param text User message text
 * @returns Export format if detected, null otherwise
 */
export function detectExportIntent(text: string): ExportFormat | null {
  for (const [format, regexes] of Object.entries(patterns)) {
    if (regexes.some((r) => r.test(text))) {
      return format as ExportFormat;
    }
  }
  return null;
}

export const formatLabels: Record<ExportFormat, string> = {
  pptx: 'PowerPoint',
  pdf: 'PDF',
  docx: 'Word',
  xlsx: 'Excel',
  csv: 'CSV',
  zip: 'ZIP',
};

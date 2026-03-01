import { jsPDF } from "jspdf";
import type { Message } from "@/lib/types";
import type { Debate } from "@/lib/types";
import { providers } from "@/lib/providers";

function getProviderName(provider?: string): string {
  if (!provider) return "Assistant";
  const p = providers.find((pr) => pr.id === provider);
  return p ? p.name : "Assistant";
}

// Helper to strip markdown formatting for cleaner PDF text
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "") // Remove headers
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Bold
    .replace(/\*([^*]+)\*/g, "$1") // Italic
    .replace(/__([^_]+)__/g, "$1") // Bold underscore
    .replace(/_([^_]+)_/g, "$1") // Italic underscore
    .replace(/`([^`]+)`/g, "$1") // Inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Links
    .replace(/^[\s]*[-*+]\s+/gm, "• ") // Bullet points
    .replace(/^[\s]*\d+\.\s+/gm, "  ") // Numbered lists
    .replace(/>\s+/g, "") // Blockquotes
    .replace(/---+/g, "") // Horizontal rules
    .replace(/\n{3,}/g, "\n\n"); // Multiple newlines
}

// Helper to add wrapped text with page breaks
function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  for (const line of lines) {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

export function exportChatToPDF(messages: Message[], title?: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  doc.setFontSize(16);
  doc.text(title || "The Foundry - Chat Export", margin, y);
  y += 10;

  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text(`Exported: ${new Date().toLocaleString()}`, margin, y);
  y += 10;

  doc.setTextColor(0);

  for (const msg of messages) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    const sender =
      msg.role === "user" ? "You" : getProviderName(msg.provider);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`${sender}:`, margin, y);
    y += 5;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    const lines = doc.splitTextToSize(msg.content, maxWidth);
    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += 4.5;
    }

    y += 5;
  }

  doc.save(`${(title || "chat-export").replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

/**
 * Export only the Executive Summary to PDF (clean format)
 */
export function exportDebateSummaryToPDF(debate: Debate) {
  if (!debate.executiveSummary) {
    alert("No executive summary available for this debate.");
    return;
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = 25;

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Executive Summary", margin, y);
  y += 12;

  // Topic
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  const topicLines = doc.splitTextToSize(debate.topic, maxWidth);
  for (const line of topicLines) {
    doc.text(line, margin, y);
    y += 5;
  }
  y += 5;

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Metadata
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  const participantNames = debate.participants
    .map((p) => getProviderName(p.provider))
    .join(" vs ");
  doc.text(`Participants: ${participantNames}`, margin, y);
  y += 5;
  doc.text(`Rounds: ${debate.rounds}`, margin, y);
  y += 5;
  doc.text(`Date: ${new Date(debate.createdAt).toLocaleDateString()}`, margin, y);
  y += 10;

  // Summary content
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);

  const cleanSummary = stripMarkdown(debate.executiveSummary);
  const paragraphs = cleanSummary.split(/\n\n+/);

  for (const paragraph of paragraphs) {
    if (paragraph.trim()) {
      y = addWrappedText(doc, paragraph.trim(), margin, y, maxWidth, 5);
      y += 4;
    }
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      290,
      { align: "center" }
    );
    doc.text(
      `Exported: ${new Date().toLocaleString()}`,
      pageWidth - margin,
      290,
      { align: "right" }
    );
  }

  const filename = `summary-${debate.topic.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().slice(0, 50)}.pdf`;
  doc.save(filename);
}

/**
 * Export the full debate thread to PDF
 */
export function exportDebateThreadToPDF(debate: Debate) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  let y = 25;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Debate Thread", margin, y);
  y += 10;

  // Topic
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  const topicLines = doc.splitTextToSize(debate.topic, maxWidth);
  for (const line of topicLines) {
    doc.text(line, margin, y);
    y += 4.5;
  }
  y += 5;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Metadata
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  const participantNames = debate.participants
    .map((p) => getProviderName(p.provider))
    .join(" vs ");
  doc.text(`${participantNames} | ${debate.rounds} rounds | ${new Date(debate.createdAt).toLocaleDateString()}`, margin, y);
  y += 10;

  doc.setTextColor(0);

  // Messages
  for (const msg of debate.messages) {
    if (y > 265) {
      doc.addPage();
      y = 20;
    }

    const sender = getProviderName(msg.provider);

    // Sender name with colored background
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 4, maxWidth, 7, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(sender, margin + 2, y);
    y += 6;

    // Message content
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);

    const cleanContent = stripMarkdown(msg.content);
    const lines = doc.splitTextToSize(cleanContent, maxWidth - 4);
    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin + 2, y);
      y += 4.5;
    }

    y += 6;
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      290,
      { align: "center" }
    );
  }

  const filename = `debate-${debate.topic.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().slice(0, 50)}.pdf`;
  doc.save(filename);
}

/**
 * Legacy function - now exports summary by default
 */
export function exportDebateToPDF(debate: Debate) {
  exportDebateSummaryToPDF(debate);
}

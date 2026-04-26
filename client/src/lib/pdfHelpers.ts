import jsPDF from "jspdf";

export const BRAND = {
  primary: [0, 152, 219] as [number, number, number],
  ink: [23, 41, 56] as [number, number, number],
  accent: [150, 212, 16] as [number, number, number],
  muted: [110, 120, 130] as [number, number, number],
  border: [220, 224, 230] as [number, number, number],
  unresolved: [180, 80, 80] as [number, number, number],
  panelBg: [248, 250, 252] as [number, number, number],
};

export const TOP_AFTER_HEADER = 64;

export function ensureSpace(doc: jsPDF, y: number, needed: number, marginBottom = 40): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - marginBottom) {
    doc.addPage();
    return TOP_AFTER_HEADER;
  }
  return y;
}

export function drawHeader(doc: jsPDF, title: string, subtitle: string, rightMeta: string) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND.ink);
  doc.rect(0, 0, pageW, 44, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 40, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(subtitle, 40, 36);

  doc.setFontSize(9);
  doc.text(rightMeta, pageW - 40, 36, { align: "right" });
}

export function drawFooter(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BRAND.border);
    doc.setLineWidth(0.5);
    doc.line(40, pageH - 28, pageW - 40, pageH - 28);
    doc.setTextColor(...BRAND.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Guideway Care", 40, pageH - 16);
    doc.text(`Page ${i} of ${total}`, pageW - 40, pageH - 16, { align: "right" });
  }
}

export function sectionHeading(doc: jsPDF, label: string, y: number): number {
  y = ensureSpace(doc, y, 24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.primary);
  doc.text(label.toUpperCase(), 40, y);
  doc.setDrawColor(...BRAND.border);
  doc.setLineWidth(0.5);
  doc.line(40, y + 3, doc.internal.pageSize.getWidth() - 40, y + 3);
  return y + 14;
}

export function bigSectionTitle(doc: jsPDF, label: string, y: number, accent: [number, number, number] = BRAND.primary): number {
  y = ensureSpace(doc, y, 40);
  doc.setFillColor(...accent);
  doc.rect(40, y, 4, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...BRAND.ink);
  doc.text(label, 52, y + 16);
  return y + 32;
}

export function keyValue(doc: jsPDF, items: Array<[string, string]>, y: number): number {
  doc.setFontSize(9);
  const pageW = doc.internal.pageSize.getWidth();
  const colW = (pageW - 80) / 2;
  let row = y;
  let col = 0;
  for (const [k, v] of items) {
    const x = 40 + col * colW;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.muted);
    doc.text(k.toUpperCase(), x, row);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.ink);
    const wrapped = doc.splitTextToSize(v || "—", colW - 8);
    doc.text(wrapped, x, row + 11);
    col = col === 0 ? 1 : 0;
    if (col === 0) row += 28;
  }
  if (col === 1) row += 28;
  return row + 4;
}

export function paragraph(doc: jsPDF, text: string, y: number): number {
  if (!text || !text.trim()) return y;
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...BRAND.ink);
  const lines = doc.splitTextToSize(text, pageW - 80);
  y = ensureSpace(doc, y, lines.length * 12);
  doc.text(lines, 40, y);
  return y + lines.length * 12 + 4;
}

export function preBlock(doc: jsPDF, text: string, y: number): number {
  if (!text || !text.trim()) return y;
  const pageW = doc.internal.pageSize.getWidth();
  const innerW = pageW - 100;
  doc.setFont("courier", "normal");
  doc.setFontSize(8.5);
  const lines = doc.splitTextToSize(text, innerW);
  const totalH = lines.length * 11 + 16;
  // Render in chunks if too tall for current page
  let i = 0;
  while (i < lines.length) {
    y = ensureSpace(doc, y, 40);
    const pageH = doc.internal.pageSize.getHeight();
    const room = pageH - 40 - y;
    const linesPerChunk = Math.max(1, Math.floor((room - 16) / 11));
    const chunk = lines.slice(i, i + linesPerChunk);
    const chunkH = chunk.length * 11 + 12;
    doc.setFillColor(...BRAND.panelBg);
    doc.setDrawColor(...BRAND.border);
    doc.setLineWidth(0.5);
    doc.roundedRect(40, y, pageW - 80, chunkH, 4, 4, "FD");
    doc.setTextColor(...BRAND.ink);
    doc.text(chunk, 50, y + 12);
    y += chunkH + 4;
    i += chunk.length;
  }
  return y + 4;
}

export function chipList(
  doc: jsPDF,
  label: string,
  values: string[],
  y: number,
  opts?: { dashed?: boolean }
): number {
  if (!values || values.length === 0) return y;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - 80;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.muted);
  doc.text(label.toUpperCase(), 40, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let x = 40;
  const chipH = 14;
  const padX = 6;
  const gap = 4;
  for (const v of values) {
    const w = doc.getTextWidth(v) + padX * 2;
    if (x + w > 40 + maxW) {
      x = 40;
      y += chipH + gap;
      y = ensureSpace(doc, y, chipH + gap);
    }
    doc.setDrawColor(...(opts?.dashed ? BRAND.muted : BRAND.border));
    doc.setFillColor(245, 247, 250);
    if (opts?.dashed && (doc as any).setLineDashPattern) {
      (doc as any).setLineDashPattern([2, 2], 0);
    }
    doc.roundedRect(x, y - chipH + 4, w, chipH, 3, 3, "FD");
    if (opts?.dashed && (doc as any).setLineDashPattern) {
      (doc as any).setLineDashPattern([], 0);
    }
    doc.setTextColor(...BRAND.ink);
    doc.text(v, x + padX, y + 1);
    x += w + gap;
  }
  return y + chipH + 8;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "pathway";
}

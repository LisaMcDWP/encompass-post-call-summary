import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BRAND,
  ensureSpace,
  drawHeader as drawHeaderShared,
  drawFooter,
  sectionHeading,
  keyValue,
  paragraph,
} from "./pdfHelpers";

interface EnumValue {
  label: string;
  color?: string;
  promptHint?: string;
}

export interface ObservationForPdf {
  id: number;
  name: string;
  displayName: string;
  description: string;
  domain: string;
  valueType: string;
  value: EnumValue[];
  isActive: boolean;
  promptGuidance: string;
}

const COLOR_LABELS: Record<string, string> = {
  GREEN: "Green (Positive)",
  YELLOW: "Yellow (Neutral)",
  RED: "Red (Negative)",
  BLUE: "Blue (Info)",
  GRAY: "Gray",
};

function drawHeader(doc: jsPDF, pathwayName: string, totalObservations: number) {
  const stamp = new Date().toLocaleString();
  drawHeaderShared(
    doc,
    "Observations Configuration",
    pathwayName,
    `${totalObservations} observation${totalObservations === 1 ? "" : "s"}  ·  ${stamp}`,
  );
}

function observationTitleBlock(
  doc: jsPDF,
  idx: number,
  total: number,
  obs: ObservationForPdf,
  y: number,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND.primary);
  doc.rect(40, y, 4, 28, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...BRAND.ink);
  doc.text(obs.displayName || obs.name, 52, y + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.muted);
  doc.text(`${obs.name}  ·  Observation ${idx} of ${total}`, 52, y + 24);

  const badgeText = obs.isActive ? "ACTIVE" : "INACTIVE";
  const badgeW = doc.getTextWidth(badgeText) + 12;
  const badgeColor: [number, number, number] = obs.isActive ? BRAND.accent : BRAND.muted;
  doc.setFillColor(...badgeColor);
  doc.roundedRect(pageW - 40 - badgeW, y + 4, badgeW, 16, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(badgeText, pageW - 40 - badgeW / 2, y + 14, { align: "center" });

  return y + 38;
}

export function exportObservationsPdf(
  pathwayName: string,
  observations: ObservationForPdf[],
  generalGuidance: string,
): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  drawHeader(doc, pathwayName, observations.length);
  let y = 64;

  if (observations.length === 0) {
    doc.setTextColor(...BRAND.muted);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.text("No observations have been configured for this pathway.", 40, y);
    drawFooter(doc);
    const safeSlug =
      pathwayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") || "pathway";
    doc.save(`observations-${safeSlug}.pdf`);
    return;
  }

  // General guidance applies to every observation in the pathway
  if (generalGuidance.trim()) {
    y = sectionHeading(doc, "General guidance (applies to all observations)", y);
    y = paragraph(doc, generalGuidance.trim(), y);
    y += 4;
  }

  // Table of contents
  y = sectionHeading(doc, "Observations in this document", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.ink);
  for (let i = 0; i < observations.length; i++) {
    const o = observations[i];
    y = ensureSpace(doc, y, 14);
    doc.text(`${i + 1}.`, 40, y);
    doc.text(o.displayName || o.name, 60, y);
    doc.setTextColor(...BRAND.muted);
    doc.text(o.name, pageW - 40, y, { align: "right" });
    doc.setTextColor(...BRAND.ink);
    y += 14;
  }
  y += 6;

  for (let i = 0; i < observations.length; i++) {
    const obs = observations[i];
    doc.addPage();
    drawHeader(doc, pathwayName, observations.length);
    y = 64;
    y = observationTitleBlock(doc, i + 1, observations.length, obs, y);

    if (obs.description) {
      y = paragraph(doc, obs.description, y);
    }

    // Basics
    y = sectionHeading(doc, "Basics", y);
    y = keyValue(
      doc,
      [
        ["Domain", obs.domain || "general"],
        ["Value type", obs.valueType || "enum"],
        ["Status", obs.isActive ? "Active" : "Inactive"],
      ],
      y,
    );

    // Per-observation prompt guidance
    if (obs.promptGuidance?.trim()) {
      y = ensureSpace(doc, y, 30);
      y = sectionHeading(doc, "Prompt guidance", y);
      y = paragraph(doc, obs.promptGuidance.trim(), y);
    }

    // Enum values + per-value prompt hints
    if (obs.valueType === "enum") {
      y = ensureSpace(doc, y, 60);
      y = sectionHeading(doc, "Allowed values", y);
      if (obs.value.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(...BRAND.muted);
        doc.text("No enum values defined.", 40, y);
        y += 14;
      } else {
        autoTable(doc, {
          startY: y,
          margin: { left: 40, right: 40 },
          head: [["#", "Value", "Sentiment", "Prompt hint"]],
          body: obs.value.map((v, idx) => [
            String(idx + 1),
            v.label,
            COLOR_LABELS[v.color || "GRAY"] || v.color || "—",
            v.promptHint?.trim() || "—",
          ]),
          columnStyles: {
            0: { cellWidth: 24 },
            1: { cellWidth: 120 },
            2: { cellWidth: 90 },
            3: { cellWidth: "auto" },
          },
          styles: {
            fontSize: 8.5,
            cellPadding: 4,
            textColor: BRAND.ink,
            lineColor: BRAND.border,
            lineWidth: 0.5,
            valign: "top",
          },
          headStyles: {
            fillColor: BRAND.primary,
            textColor: [255, 255, 255],
            fontStyle: "bold",
          },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }
    } else {
      y = ensureSpace(doc, y, 30);
      y = sectionHeading(doc, "Allowed values", y);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(...BRAND.muted);
      const note =
        obs.valueType === "boolean"
          ? "Boolean — true / false / null"
          : obs.valueType === "number"
            ? "Numeric — any number, or null if not discussed"
            : "Free-text string, or null if not discussed";
      doc.text(note, 40, y);
      y += 14;
    }
  }

  drawFooter(doc);
  const safeSlug =
    pathwayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") || "pathway";
  doc.save(`observations-${safeSlug}.pdf`);
}

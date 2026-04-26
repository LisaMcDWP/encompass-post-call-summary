import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Stage {
  id: string;
  name: string;
  displayName: string;
  description: string;
  order: number;
}

interface Threshold {
  bandLabel: string;
  bandDisplayName: string;
  daysRemainingMin: number | null;
  daysRemainingMax: number | null;
  onTrackStageIds: string[];
  satisfiedLabel: string;
  unsatisfiedLabel: string;
}

interface StageMapping {
  extractedValue: string;
  stageId: string;
}

interface EnumValue {
  label: string;
  color?: string;
}

interface InclusionRules {
  requirePcpAssigned: boolean;
  requireCompletedWithPatientOrCaregiver: boolean;
  customRules: string[];
}

interface ObjectiveInteractionConfig {
  interactionId: number;
  isDefault: boolean;
  canResolveObjective: boolean;
  inclusionRules: InclusionRules;
  promptGuidance: string;
  observationTopicIds: number[];
}

interface Interaction {
  id: number;
  key: string;
  name: string;
}

interface ObservationTopic {
  id: number;
  name: string;
  displayName: string;
}

export interface ObjectiveForPdf {
  id: number;
  name: string;
  displayName: string;
  description: string;
  anchorEventType: string;
  anchorContextKey: string;
  interactionContextKey: string;
  windowDays: number;
  stages: Stage[];
  achievedStageId: string;
  thresholds: Threshold[];
  observationName: string;
  extractedEnumValues: EnumValue[];
  stageMappings: StageMapping[];
  knownContextExtractedValues: string[];
  excludedExtractedValues: string[];
  interactions: ObjectiveInteractionConfig[];
  isActive: boolean;
  promptGuidance: string;
  observationTopicIds: number[];
}

const BRAND = {
  primary: [0, 152, 219] as [number, number, number],
  ink: [23, 41, 56] as [number, number, number],
  accent: [150, 212, 16] as [number, number, number],
  muted: [110, 120, 130] as [number, number, number],
  border: [220, 224, 230] as [number, number, number],
  unresolved: [180, 80, 80] as [number, number, number],
};

const ANCHOR_LABELS: Record<string, string> = {
  discharge: "Discharge date",
  enrollment: "Enrollment date",
  procedure: "Procedure date",
  custom: "Custom anchor",
};

function fmtDays(t: Threshold): string {
  const { daysRemainingMin: lo, daysRemainingMax: hi } = t;
  if (lo === null && hi === null) return "Any time";
  if (lo !== null && hi === null) return `≥ ${lo} days remaining`;
  if (lo === null && hi !== null) return `≤ ${hi} days remaining`;
  if (lo === hi) return `${lo} days remaining`;
  return `${lo}–${hi} days remaining`;
}

function ensureSpace(doc: jsPDF, y: number, needed: number, marginBottom = 40): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - marginBottom) {
    doc.addPage();
    return 56;
  }
  return y;
}

function drawHeader(doc: jsPDF, pathwayName: string, totalObjectives: number) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND.ink);
  doc.rect(0, 0, pageW, 44, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Activation Objectives Configuration", 40, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(pathwayName, 40, 36);

  const stamp = new Date().toLocaleString();
  doc.setFontSize(9);
  doc.text(`${totalObjectives} objective${totalObjectives === 1 ? "" : "s"}  ·  ${stamp}`, pageW - 40, 36, { align: "right" });
}

function drawFooter(doc: jsPDF) {
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

function sectionHeading(doc: jsPDF, label: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.primary);
  doc.text(label.toUpperCase(), 40, y);
  doc.setDrawColor(...BRAND.border);
  doc.setLineWidth(0.5);
  doc.line(40, y + 3, doc.internal.pageSize.getWidth() - 40, y + 3);
  return y + 14;
}

function keyValue(doc: jsPDF, items: Array<[string, string]>, y: number): number {
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

function paragraph(doc: jsPDF, text: string, y: number): number {
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

function chipList(doc: jsPDF, label: string, values: string[], y: number, opts?: { dashed?: boolean }): number {
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

function objectiveTitleBlock(doc: jsPDF, idx: number, total: number, obj: ObjectiveForPdf, y: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  // Accent bar
  doc.setFillColor(...BRAND.primary);
  doc.rect(40, y, 4, 28, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...BRAND.ink);
  doc.text(obj.displayName || obj.name, 52, y + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.muted);
  doc.text(`${obj.name}  ·  Objective ${idx} of ${total}`, 52, y + 24);

  // Active badge
  const badgeText = obj.isActive ? "ACTIVE" : "INACTIVE";
  const badgeW = doc.getTextWidth(badgeText) + 12;
  const badgeColor: [number, number, number] = obj.isActive ? BRAND.accent : BRAND.muted;
  doc.setFillColor(...badgeColor);
  doc.roundedRect(pageW - 40 - badgeW, y + 4, badgeW, 16, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(badgeText, pageW - 40 - badgeW / 2, y + 14, { align: "center" });

  return y + 38;
}

export function exportObjectivesPdf(
  pathwayName: string,
  objectives: ObjectiveForPdf[],
  interactionsList: Interaction[],
  topicsList: ObservationTopic[]
): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const interactionById = new Map(interactionsList.map(i => [i.id, i]));
  const topicById = new Map(topicsList.map(t => [t.id, t]));

  drawHeader(doc, pathwayName, objectives.length);
  let y = 64;

  if (objectives.length === 0) {
    doc.setTextColor(...BRAND.muted);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.text("No activation objectives have been configured for this pathway.", 40, y);
    drawFooter(doc);
    doc.save(`activation-objectives-${pathwayName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    return;
  }

  // Table of contents
  y = sectionHeading(doc, "Objectives in this document", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.ink);
  for (let i = 0; i < objectives.length; i++) {
    const o = objectives[i];
    y = ensureSpace(doc, y, 14);
    doc.text(`${i + 1}.`, 40, y);
    doc.text(o.displayName || o.name, 60, y);
    doc.setTextColor(...BRAND.muted);
    doc.text(o.name, pageW - 40, y, { align: "right" });
    doc.setTextColor(...BRAND.ink);
    y += 14;
  }
  y += 6;

  for (let i = 0; i < objectives.length; i++) {
    const obj = objectives[i];
    doc.addPage();
    drawHeader(doc, pathwayName, objectives.length);
    y = 64;
    y = objectiveTitleBlock(doc, i + 1, objectives.length, obj, y);

    if (obj.description) {
      y = paragraph(doc, obj.description, y);
    }

    // Anchor & window
    y = sectionHeading(doc, "Anchor & window", y);
    y = keyValue(doc, [
      ["Anchor event", ANCHOR_LABELS[obj.anchorEventType] || obj.anchorEventType || "—"],
      ["Anchor context key", obj.anchorContextKey || "—"],
      ["Window", `${obj.windowDays} days`],
      ["Interaction context key", obj.interactionContextKey || "—"],
    ], y);

    // Stages
    y = ensureSpace(doc, y, 60);
    y = sectionHeading(doc, "Stages", y);
    const sorted = [...obj.stages].sort((a, b) => a.order - b.order);
    const achieved = obj.stages.find(s => s.id === obj.achievedStageId);
    autoTable(doc, {
      startY: y,
      margin: { left: 40, right: 40 },
      head: [["#", "Display name", "Snake_case name", "Sublabel", "Mapped values", "Role"]],
      body: sorted.map(s => {
        const mapped = obj.stageMappings.filter(m => m.stageId === s.id).map(m => m.extractedValue);
        const role = s.order === 0 ? "Unresolved" : s.id === obj.achievedStageId ? "Achieved" : "Progress";
        return [
          String(s.order),
          s.displayName,
          s.name,
          s.description || "—",
          mapped.length ? mapped.join(", ") : "—",
          role,
        ];
      }),
      styles: { fontSize: 8.5, cellPadding: 4, textColor: BRAND.ink, lineColor: BRAND.border, lineWidth: 0.5 },
      headStyles: { fillColor: BRAND.primary, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 5) {
          const val = data.cell.raw as string;
          if (val === "Unresolved") {
            data.cell.styles.textColor = BRAND.unresolved;
            data.cell.styles.fontStyle = "bold";
          } else if (val === "Achieved") {
            data.cell.styles.textColor = BRAND.accent;
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
    if (achieved) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...BRAND.muted);
      doc.text(`Objective achieved when stage = "${achieved.displayName}"`, 40, y);
      y += 14;
    }

    // Non-stage value bins
    if (obj.knownContextExtractedValues.length || obj.excludedExtractedValues.length) {
      y = ensureSpace(doc, y, 40);
      y = sectionHeading(doc, "Non-stage values", y);
      if (obj.knownContextExtractedValues.length) {
        y = chipList(doc, "Known Context  (captured but not used for staging)", obj.knownContextExtractedValues, y + 4, { dashed: true });
      }
      if (obj.excludedExtractedValues.length) {
        y = chipList(doc, "Excluded  (dropped — not in denominator)", obj.excludedExtractedValues, y + 4, { dashed: true });
      }
    }

    // Observation
    if (obj.observationName || obj.extractedEnumValues.length || obj.observationTopicIds.length) {
      y = ensureSpace(doc, y, 50);
      y = sectionHeading(doc, "Observation", y);
      const topicNames = obj.observationTopicIds.map(id => topicById.get(id)?.displayName || `#${id}`);
      y = keyValue(doc, [
        ["Observation name", obj.observationName || "—"],
        ["Topics", topicNames.length ? topicNames.join(", ") : "—"],
      ], y);
      if (obj.extractedEnumValues.length) {
        y = chipList(doc, "All extracted values", obj.extractedEnumValues.map(v => v.label), y);
      }
    }

    // Thresholds
    if (obj.thresholds.length) {
      y = ensureSpace(doc, y, 60);
      y = sectionHeading(doc, "On-track thresholds", y);
      const stageById = new Map(obj.stages.map(s => [s.id, s]));
      autoTable(doc, {
        startY: y,
        margin: { left: 40, right: 40 },
        head: [["Band", "Window position", "Stages on track", "Satisfied label", "Unsatisfied label"]],
        body: obj.thresholds.map(t => [
          t.bandDisplayName || t.bandLabel,
          fmtDays(t),
          t.onTrackStageIds.map(id => stageById.get(id)?.displayName || id).join(", ") || "—",
          t.satisfiedLabel || "—",
          t.unsatisfiedLabel || "—",
        ]),
        styles: { fontSize: 8.5, cellPadding: 4, textColor: BRAND.ink, lineColor: BRAND.border, lineWidth: 0.5 },
        headStyles: { fillColor: BRAND.primary, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Interactions
    if (obj.interactions.length) {
      y = ensureSpace(doc, y, 60);
      y = sectionHeading(doc, "Interactions", y);
      autoTable(doc, {
        startY: y,
        margin: { left: 40, right: 40 },
        head: [["Interaction", "Default", "Resolves", "Required", "Custom rules", "Topics"]],
        body: obj.interactions.map(cfg => {
          const intx = interactionById.get(cfg.interactionId);
          const required: string[] = [];
          if (cfg.inclusionRules?.requirePcpAssigned) required.push("PCP assigned");
          if (cfg.inclusionRules?.requireCompletedWithPatientOrCaregiver) required.push("Completed w/ patient or caregiver");
          const topicNames = cfg.observationTopicIds.map(id => topicById.get(id)?.displayName || `#${id}`);
          return [
            intx ? `${intx.name}\n${intx.key}` : `#${cfg.interactionId}`,
            cfg.isDefault ? "Yes" : "—",
            cfg.canResolveObjective ? "Yes" : "—",
            required.length ? required.join("; ") : "—",
            cfg.inclusionRules?.customRules?.length ? cfg.inclusionRules.customRules.join("; ") : "—",
            topicNames.length ? topicNames.join(", ") : "—",
          ];
        }),
        styles: { fontSize: 8.5, cellPadding: 4, textColor: BRAND.ink, lineColor: BRAND.border, lineWidth: 0.5, valign: "middle" },
        headStyles: { fillColor: BRAND.primary, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // Per-interaction prompt guidance
      for (const cfg of obj.interactions) {
        if (!cfg.promptGuidance?.trim()) continue;
        const intx = interactionById.get(cfg.interactionId);
        y = ensureSpace(doc, y, 30);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...BRAND.muted);
        doc.text(`Prompt guidance — ${intx ? intx.name : `#${cfg.interactionId}`}`.toUpperCase(), 40, y);
        y += 10;
        y = paragraph(doc, cfg.promptGuidance, y);
      }
    }

    // Objective-level prompt guidance
    if (obj.promptGuidance?.trim()) {
      y = ensureSpace(doc, y, 40);
      y = sectionHeading(doc, "Prompt guidance", y);
      y = paragraph(doc, obj.promptGuidance, y);
    }
  }

  drawFooter(doc);
  const safeSlug = pathwayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "") || "pathway";
  doc.save(`activation-objectives-${safeSlug}.pdf`);
}

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BRAND,
  TOP_AFTER_HEADER,
  ensureSpace,
  drawHeader as drawHeaderShared,
  drawFooter,
  sectionHeading,
  keyValue,
  paragraph,
  chipList,
  slugify,
} from "./pdfHelpers";

interface Stage {
  id: string;
  name: string;
  displayName: string;
  description: string;
  order: number;
}

type Outcome = "achieved" | "on_track" | "not_achieved" | "na" | "not_discussed";

interface StageOutcome {
  stageId: string;
  outcome: Outcome;
}

interface Threshold {
  bandLabel: string;
  bandDisplayName: string;
  daysRemainingMin: number | null;
  daysRemainingMax: number | null;
  stageOutcomes: StageOutcome[];
}

const OUTCOME_LABEL_PDF: Record<Outcome, string> = {
  achieved: "Achieved",
  on_track: "On track",
  not_achieved: "Not achieved",
  na: "N/A",
  not_discussed: "Not discussed",
};

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
  thresholds: Threshold[];
  observationName: string;
  stageMappings: StageMapping[];
  interactions: ObjectiveInteractionConfig[];
  isActive: boolean;
  observationTopicIds: number[];
}

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

function drawHeader(doc: jsPDF, pathwayName: string, totalObjectives: number) {
  const stamp = new Date().toLocaleString();
  drawHeaderShared(
    doc,
    "Activation Objectives Configuration",
    pathwayName,
    `${totalObjectives} objective${totalObjectives === 1 ? "" : "s"}  ·  ${stamp}`,
  );
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
    const progressStages = sorted.filter(s => s.order > 0);
    const lastProgressId = progressStages[progressStages.length - 1]?.id || "";
    autoTable(doc, {
      startY: y,
      margin: { left: 40, right: 40 },
      head: [["#", "Display name", "Snake_case name", "Sublabel", "Mapped values", "Role"]],
      body: sorted.map(s => {
        const mapped = obj.stageMappings.filter(m => m.stageId === s.id).map(m => m.extractedValue);
        const role = s.order === 0 ? "Unresolved" : s.id === lastProgressId ? "Final" : "Progress";
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
          } else if (val === "Final") {
            data.cell.styles.textColor = BRAND.accent;
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Observation
    if (obj.observationName || obj.observationTopicIds.length) {
      y = ensureSpace(doc, y, 50);
      y = sectionHeading(doc, "Observation", y);
      const topicNames = obj.observationTopicIds.map(id => topicById.get(id)?.displayName || `#${id}`);
      y = keyValue(doc, [
        ["Linked observation", obj.observationName || "—"],
        ["Topics", topicNames.length ? topicNames.join(", ") : "—"],
      ], y);
    }

    // Outcome mapping (band × stage)
    if (obj.thresholds.length && progressStages.length) {
      y = ensureSpace(doc, y, 60);
      y = sectionHeading(doc, "Outcome mapping (band × stage)", y);
      const head = [["Band", "Window position", ...progressStages.map(s => s.displayName)]];
      const body = obj.thresholds.map(t => {
        const cells = progressStages.map(s => {
          const o = (t.stageOutcomes || []).find(m => m.stageId === s.id)?.outcome || "na";
          return OUTCOME_LABEL_PDF[o];
        });
        return [t.bandDisplayName || t.bandLabel, fmtDays(t), ...cells];
      });
      autoTable(doc, {
        startY: y,
        margin: { left: 40, right: 40 },
        head,
        body,
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

  }

  drawFooter(doc);
  const safeSlug = pathwayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "") || "pathway";
  doc.save(`activation-objectives-${safeSlug}.pdf`);
}

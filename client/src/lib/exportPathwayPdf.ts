import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BRAND,
  TOP_AFTER_HEADER,
  ensureSpace,
  drawHeader,
  drawFooter,
  sectionHeading,
  bigSectionTitle,
  keyValue,
  paragraph,
  preBlock,
  chipList,
  slugify,
} from "./pdfHelpers";
import type { ObjectiveForPdf } from "./exportObjectivesPdf";

interface ContextParameter {
  id: number;
  name: string;
  displayName: string;
  description: string;
  dataType: string;
  enumValues: string[];
  isActive: boolean;
  displayOrder: number;
  awellDataPointKey: string;
  awellMappingType: string;
  awellPatientProfileField: string;
}

interface EnumValue {
  label: string;
  color?: string;
  promptHint?: string;
}

interface Observation {
  id: number;
  name: string;
  displayName: string;
  description: string;
  domain: string;
  displayOrder: number;
  valueType: string;
  value: EnumValue[];
  isActive: boolean;
  promptGuidance: string;
}

interface ActivationInteraction {
  id: number;
  key: string;
  name: string;
  description: string;
  expectedDayOffset: number | null;
  isActive: boolean;
  displayOrder: number;
}

interface DispositionCategory {
  id: number;
  name: string;
  displayName: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  isGlobal: boolean;
}

interface DispositionDetail {
  id: number;
  categoryId: number;
  name: string;
  displayName: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  isGlobal: boolean;
}

interface CallReviewItem {
  id: number;
  name: string;
  displayName: string;
  description: string;
  category: string;
  displayOrder: number;
  isActive: boolean;
}

interface CallQAPrompt {
  id: number;
  name: string;
  displayName: string;
  promptText: string;
  responseType: string;
  responseOptions: string[];
  isActive: boolean;
  displayOrder: number;
}

interface ObjectiveTopicLite {
  id: number;
  name: string;
  displayName: string;
}

const PATHWAY_HEADER_TITLE = "Pathway Configuration";

function pathwayHeader(doc: jsPDF, pathwayLabel: string) {
  const stamp = new Date().toLocaleString();
  drawHeader(doc, PATHWAY_HEADER_TITLE, pathwayLabel, `Full configuration  ·  ${stamp}`);
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed: ${url}`);
  return res.json();
}

function sortByOrder<T extends { displayOrder: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.displayOrder - b.displayOrder);
}

function coverPage(
  doc: jsPDF,
  pathwayLabel: string,
  counts: { observations: number; objectives: number; interactions: number; contextParams: number; reviewItems: number; dispositions: number; callQA: number },
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFillColor(...BRAND.ink);
  doc.rect(0, 0, pageW, pageH, "F");

  doc.setFillColor(...BRAND.primary);
  doc.rect(40, 120, 6, 60, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("Pathway Configuration", 60, 150);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(200, 220, 235);
  doc.text(pathwayLabel, 60, 178);

  doc.setFontSize(11);
  doc.setTextColor(150, 170, 185);
  doc.text(`Generated ${new Date().toLocaleString()}`, 60, 200);

  // Stats grid
  const stats: Array<[string, number]> = [
    ["Observations", counts.observations],
    ["Activation objectives", counts.objectives],
    ["Activation interactions", counts.interactions],
    ["Context parameters", counts.contextParams],
    ["Review items", counts.reviewItems],
    ["Dispositions", counts.dispositions],
    ["Call QA prompts", counts.callQA],
  ];

  let gy = 270;
  const gx = 60;
  const cardW = (pageW - 120 - 16) / 2;
  for (let i = 0; i < stats.length; i++) {
    const [label, n] = stats[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = gx + col * (cardW + 16);
    const y = gy + row * 64;

    doc.setFillColor(35, 55, 75);
    doc.setDrawColor(...BRAND.primary);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, cardW, 52, 4, 4, "FD");

    doc.setTextColor(...BRAND.accent);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(String(n), x + 14, y + 28);

    doc.setTextColor(200, 220, 235);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(label, x + 14, y + 44);
  }

  // Footer brand line on cover
  doc.setDrawColor(...BRAND.primary);
  doc.setLineWidth(2);
  doc.line(40, pageH - 50, 100, pageH - 50);
  doc.setTextColor(180, 200, 215);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("GUIDEWAY CARE", 40, pageH - 30);
}

function tocPage(doc: jsPDF, sections: string[]) {
  doc.addPage();
  let y = TOP_AFTER_HEADER;
  y = bigSectionTitle(doc, "Contents", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.ink);
  for (let i = 0; i < sections.length; i++) {
    y = ensureSpace(doc, y, 18);
    doc.setTextColor(...BRAND.muted);
    doc.text(`${String(i + 1).padStart(2, "0")}`, 40, y);
    doc.setTextColor(...BRAND.ink);
    doc.text(sections[i], 70, y);
    y += 18;
  }
}

function renderItemTitle(doc: jsPDF, displayName: string, meta: string, isActive: boolean, y: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...(isActive ? BRAND.primary : BRAND.muted));
  doc.rect(40, y, 3, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BRAND.ink);
  doc.text(displayName, 50, y + 13);
  // Inactive badge on the right (before meta)
  let metaX = pageW - 40;
  if (!isActive) {
    const tag = "INACTIVE";
    const w = doc.getTextWidth(tag) + 10;
    doc.setFillColor(...BRAND.muted);
    doc.roundedRect(metaX - w, y + 2, w, 14, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(tag, metaX - w / 2, y + 12, { align: "center" });
    metaX -= w + 6;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.muted);
  doc.text(meta, metaX, y + 13, { align: "right" });
  return y + 22;
}

function renderObservation(doc: jsPDF, o: Observation, y: number): number {
  y = ensureSpace(doc, y, 50);
  y = renderItemTitle(doc, o.displayName, `${o.name}  ·  ${o.domain}  ·  ${o.valueType}`, o.isActive, y);

  if (o.description) {
    y = paragraph(doc, o.description, y);
  }
  if (o.value && o.value.length) {
    y = chipList(doc, "Enum values", o.value.map(v => v.color ? `${v.label}  (${v.color})` : v.label), y);
  }
  if (o.promptGuidance && o.promptGuidance.trim()) {
    y = ensureSpace(doc, y, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND.muted);
    doc.text("PROMPT GUIDANCE", 40, y);
    y += 10;
    y = preBlock(doc, o.promptGuidance, y);
  }
  return y + 6;
}

function renderTextSetting(doc: jsPDF, label: string, text: string, y: number): number {
  y = bigSectionTitle(doc, label, y);
  if (!text || !text.trim()) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text("No instruction configured.", 40, y);
    return y + 16;
  }
  return preBlock(doc, text, y);
}

export async function exportPathwayPdf(
  clientPathwayId: number,
  pathwayLabel: string,
): Promise<void> {
  const cpParam = `clientPathwayId=${clientPathwayId}`;

  const [
    summarySetting,
    barriersSetting,
    obsGuidanceSetting,
    contextParams,
    observations,
    interactions,
    objectives,
    dispCategories,
    dispDetails,
    reviewItems,
    callQAPrompts,
    promptData,
  ] = await Promise.all([
    fetchJSON<{ instruction: string; defaultInstruction: string; isCustom: boolean }>(`/api/settings/summary-instruction?${cpParam}`),
    fetchJSON<{ guidance: string; defaultGuidance?: string; isCustom: boolean }>(`/api/settings/barriers-guidance?${cpParam}`),
    fetchJSON<{ guidance: string; defaultGuidance?: string; isCustom: boolean }>(`/api/settings/observations-guidance?${cpParam}`),
    fetchJSON<ContextParameter[]>(`/api/context-parameters?${cpParam}`),
    fetchJSON<Observation[]>(`/api/observations?${cpParam}`),
    fetchJSON<ActivationInteraction[]>(`/api/activation-interactions?${cpParam}`),
    fetchJSON<ObjectiveForPdf[]>(`/api/activation-objectives?${cpParam}`),
    fetchJSON<DispositionCategory[]>(`/api/disposition-categories?${cpParam}`),
    fetchJSON<DispositionDetail[]>(`/api/disposition-details?${cpParam}`),
    fetchJSON<CallReviewItem[]>(`/api/call-review-items?${cpParam}`),
    fetchJSON<CallQAPrompt[]>(`/api/call-qa-prompts?${cpParam}`),
    fetchJSON<{ prompt: string; promptVersion?: number }>(`/api/prompt?${cpParam}`),
  ]);

  // Include all configured records (active + inactive); inactive ones get a marker.
  const allContextParams = sortByOrder(contextParams);
  const allObservations = sortByOrder(observations);
  const allInteractions = sortByOrder(interactions);
  const allObjectives = objectives;
  const allCategories = sortByOrder(dispCategories);
  const allDetails = sortByOrder(dispDetails);
  const allReviewItems = sortByOrder(reviewItems);
  const allCallQA = sortByOrder(callQAPrompts);

  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // ---- Cover (page 1) ----
  coverPage(doc, pathwayLabel, {
    observations: allObservations.length,
    objectives: allObjectives.length,
    interactions: allInteractions.length,
    contextParams: allContextParams.length,
    reviewItems: allReviewItems.length,
    dispositions: allCategories.length + allDetails.length,
    callQA: allCallQA.length,
  });

  // ---- TOC (page 2) ----
  const sections = [
    "Summary prompt instruction",
    "Barriers extraction guidance",
    "Observations extraction guidance",
    "Context parameters",
    "Observations",
    "Activation interactions",
    "Activation objectives",
    "Dispositions",
    "Call review items",
    "Call QA prompts",
    "Generated prompt (assembled)",
  ];
  tocPage(doc, sections);

  // Helper to start a fresh section page; header is painted globally at the end.
  const startPage = () => {
    doc.addPage();
    return TOP_AFTER_HEADER;
  };

  // ---- Summary instruction ----
  let y = startPage();
  y = renderTextSetting(doc, "Summary prompt instruction", summarySetting.instruction || summarySetting.defaultInstruction, y);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.muted);
  doc.text(summarySetting.isCustom ? "Customised for this pathway." : "Using platform default.", 40, y + 4);

  // ---- Barriers guidance ----
  y = startPage();
  y = renderTextSetting(doc, "Barriers extraction guidance", barriersSetting.guidance || barriersSetting.defaultGuidance || "", y);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.muted);
  doc.text(barriersSetting.isCustom ? "Customised for this pathway." : "Using platform default.", 40, y + 4);

  // ---- Observations guidance ----
  y = startPage();
  y = renderTextSetting(doc, "Observations extraction guidance", obsGuidanceSetting.guidance || obsGuidanceSetting.defaultGuidance || "", y);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.muted);
  doc.text(obsGuidanceSetting.isCustom ? "Customised for this pathway." : "Using platform default.", 40, y + 4);

  // ---- Context parameters ----
  y = startPage();
  y = bigSectionTitle(doc, "Context parameters", y);
  if (allContextParams.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text("No context parameters configured.", 40, y);
  } else {
    autoTable(doc, {
      startY: y,
      margin: { top: TOP_AFTER_HEADER, left: 40, right: 40 },
      head: [["Display name", "Key", "Type", "Allowed values", "Awell mapping", "Active"]],
      body: allContextParams.map(c => {
        const enumStr = c.dataType === "enum" && c.enumValues?.length ? c.enumValues.join(" | ") : "—";
        const mapping =
          c.awellMappingType === "data_point" ? `data_point: ${c.awellDataPointKey || "—"}` :
          c.awellMappingType === "patient_profile" ? `patient_profile: ${c.awellPatientProfileField || "—"}` :
          c.awellMappingType || "—";
        return [c.displayName, c.name, c.dataType, enumStr, mapping, c.isActive ? "Yes" : "No"];
      }),
      styles: { fontSize: 8.5, cellPadding: 4, textColor: BRAND.ink, lineColor: BRAND.border, lineWidth: 0.5 },
      headStyles: { fillColor: BRAND.primary, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
  }

  // ---- Observations ----
  y = startPage();
  y = bigSectionTitle(doc, "Observations", y);
  if (allObservations.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text("No observations configured.", 40, y);
  } else {
    for (const o of allObservations) {
      y = renderObservation(doc, o, y);
    }
  }

  // ---- Activation interactions ----
  y = startPage();
  y = bigSectionTitle(doc, "Activation interactions", y);
  if (allInteractions.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text("No interactions configured.", 40, y);
  } else {
    autoTable(doc, {
      startY: y,
      margin: { top: TOP_AFTER_HEADER, left: 40, right: 40 },
      head: [["Name", "Key", "Day offset", "Description", "Active"]],
      body: allInteractions.map(i => [
        i.name,
        i.key,
        i.expectedDayOffset === null ? "—" : `Day ${i.expectedDayOffset}`,
        i.description || "—",
        i.isActive ? "Yes" : "No",
      ]),
      styles: { fontSize: 9, cellPadding: 4, textColor: BRAND.ink, lineColor: BRAND.border, lineWidth: 0.5 },
      headStyles: { fillColor: BRAND.primary, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
  }

  // ---- Activation objectives ----
  y = startPage();
  y = bigSectionTitle(doc, "Activation objectives", y);
  if (allObjectives.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text("No activation objectives configured.", 40, y);
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...BRAND.muted);
    doc.text(
      `${allObjectives.length} objective${allObjectives.length === 1 ? "" : "s"}. Use the dedicated Activation Objectives PDF for full per-objective stage mappings, thresholds, and prompt guidance.`,
      40, y, { maxWidth: doc.internal.pageSize.getWidth() - 80 },
    );
    y += 22;
    for (let i = 0; i < allObjectives.length; i++) {
      const o = allObjectives[i];
      y = ensureSpace(doc, y, 80);
      const meta = `${o.name}  ·  ${o.windowDays}d window  ·  anchor: ${o.anchorContextKey || o.anchorEventType || "—"}`;
      y = renderItemTitle(doc, `${i + 1}. ${o.displayName || o.name}`, meta, o.isActive, y);
      if (o.description) {
        y = paragraph(doc, o.description, y);
      }
      const stages = [...(o.stages || [])].sort((a: any, b: any) => a.order - b.order);
      if (stages.length) {
        autoTable(doc, {
          startY: y,
          margin: { top: TOP_AFTER_HEADER, left: 50, right: 40 },
          head: [["#", "Stage", "Role", "Mapped values"]],
          body: (() => {
            const progress = stages.filter((s: any) => s.order > 0);
            const lastId = progress[progress.length - 1]?.id || "";
            return stages.map((s: any) => {
              const mapped = (o.stageMappings || []).filter((m: any) => m.stageId === s.id).map((m: any) => m.extractedValue);
              const role = s.order === 0 ? "Unresolved" : s.id === lastId ? "Final" : "Progress";
              return [String(s.order), s.displayName, role, mapped.length ? mapped.join(", ") : "—"];
            });
          })(),
          styles: { fontSize: 8.5, cellPadding: 3, textColor: BRAND.ink, lineColor: BRAND.border, lineWidth: 0.5 },
          headStyles: { fillColor: [240, 244, 248], textColor: BRAND.ink, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }
      if (o.observationName) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...BRAND.muted);
        doc.text(`Observation: ${o.observationName}`, 50, y);
        y += 12;
      }
      y += 8;
    }
  }

  // ---- Dispositions ----
  y = startPage();
  y = bigSectionTitle(doc, "Dispositions", y);
  if (allCategories.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text("No dispositions configured.", 40, y);
  } else {
    for (const cat of allCategories) {
      const details = allDetails.filter(d => d.categoryId === cat.id);
      y = ensureSpace(doc, y, 36 + details.length * 14);
      const catMeta = `${cat.name}${cat.isGlobal ? "  ·  global" : ""}`;
      y = renderItemTitle(doc, cat.displayName, catMeta, cat.isActive, y);
      if (cat.description) {
        y = paragraph(doc, cat.description, y);
      }
      if (details.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...BRAND.muted);
        doc.text("No detail values defined.", 50, y);
        y += 14;
      } else {
        autoTable(doc, {
          startY: y,
          margin: { top: TOP_AFTER_HEADER, left: 50, right: 40 },
          head: [["Display name", "Name", "Description", "Active"]],
          body: details.map(d => [d.displayName, d.name, d.description || "—", d.isActive ? "Yes" : "No"]),
          styles: { fontSize: 8.5, cellPadding: 3, textColor: BRAND.ink, lineColor: BRAND.border, lineWidth: 0.5 },
          headStyles: { fillColor: [240, 244, 248], textColor: BRAND.ink, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });
        y = (doc as any).lastAutoTable.finalY + 12;
      }
    }
  }

  // ---- Call review items ----
  y = startPage();
  y = bigSectionTitle(doc, "Call review items", y);
  if (allReviewItems.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text("No review items configured.", 40, y);
  } else {
    autoTable(doc, {
      startY: y,
      margin: { top: TOP_AFTER_HEADER, left: 40, right: 40 },
      head: [["Category", "Display name", "Name", "Description", "Active"]],
      body: allReviewItems.map(r => [r.category, r.displayName, r.name, r.description || "—", r.isActive ? "Yes" : "No"]),
      styles: { fontSize: 9, cellPadding: 4, textColor: BRAND.ink, lineColor: BRAND.border, lineWidth: 0.5 },
      headStyles: { fillColor: BRAND.primary, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
  }

  // ---- Call QA prompts ----
  y = startPage();
  y = bigSectionTitle(doc, "Call QA prompts", y);
  if (allCallQA.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text("No call QA prompts configured.", 40, y);
  } else {
    for (const q of allCallQA) {
      y = ensureSpace(doc, y, 60);
      y = renderItemTitle(doc, q.displayName, `${q.name}  ·  ${q.responseType}`, q.isActive, y);
      if (q.responseType === "enum" && q.responseOptions?.length) {
        y = chipList(doc, "Response options", q.responseOptions, y);
      }
      y = preBlock(doc, q.promptText || "—", y);
      y += 4;
    }
  }

  // ---- Generated prompt ----
  y = startPage();
  y = bigSectionTitle(doc, "Generated prompt (assembled)", y);
  if (promptData.promptVersion) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.muted);
    doc.text(`Prompt version v${promptData.promptVersion}`, 40, y);
    y += 14;
  }
  if (promptData.prompt) {
    y = preBlock(doc, promptData.prompt, y);
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text("Generated prompt unavailable.", 40, y);
  }

  // Header on every page from page 2 onward (cover is page 1)
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    pathwayHeader(doc, pathwayLabel);
  }

  drawFooter(doc);
  doc.save(`pathway-configuration-${slugify(pathwayLabel)}.pdf`);
}

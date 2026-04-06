import { jsPDF } from "jspdf";

interface CallInfo {
  call_id: string;
  care_flow_id: string | null;
  processed_datetime: string | null;
  source_type: string | null;
  source_id: string | null;
  processed_at: string;
  processing_time_ms: number;
  prompt_version: number | null;
  transcript_length: number | null;
  summary: string | null;
  follow_up_areas: string | null;
  transition_status: string | null;
  context_values: Record<string, string> | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  estimated_cost: number | null;
  status: string;
  error_message: string | null;
}

interface CallObservation {
  observation_name: string;
  observation_display_name: string | null;
  observation_domain: string | null;
  observation_value: string | null;
  observation_detail: string | null;
  observation_evidence: string | null;
  observation_confidence: string | null;
}

interface QAPair {
  sequence_number: number;
  question: string;
  answer: string;
  asked_by: string | null;
  answered_by: string | null;
  category: string | null;
}

interface CallBarrier {
  barrier: string;
  context: string | null;
  category: string | null;
  severity: string | null;
  evidence: string | null;
}

interface CallQAResultItem {
  name: string;
  display_name: string | null;
  value: string | null;
  detail: string | null;
  evidence: string | null;
}

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export function exportCallDetailPdf(
  info: CallInfo,
  observations: CallObservation[],
  qaPairs: QAPair[],
  barriers: CallBarrier[],
  callQA: CallQAResultItem[],
  transcript?: string | null
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 15;
  const marginRight = 15;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = 15;

  const PRIMARY = [0, 152, 219] as [number, number, number];
  const NAVY = [23, 41, 56] as [number, number, number];
  const GRAY = [107, 114, 128] as [number, number, number];
  const LIGHT_BG = [245, 247, 250] as [number, number, number];

  function checkPageBreak(needed: number) {
    if (y + needed > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = 15;
    }
  }

  function sectionHeader(title: string) {
    checkPageBreak(14);
    y += 4;
    doc.setFillColor(...PRIMARY);
    doc.rect(marginLeft, y, contentWidth, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(title, marginLeft + 3, y + 5.5);
    y += 12;
    doc.setTextColor(0, 0, 0);
  }

  function labelValue(label: string, value: string, indent = 0) {
    checkPageBreak(7);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text(label, marginLeft + indent, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...NAVY);
    const valX = marginLeft + indent + 40;
    const lines = doc.splitTextToSize(value, contentWidth - 40 - indent);
    doc.text(lines, valX, y);
    y += lines.length * 4 + 2;
  }

  function wrappedText(text: string, fontSize = 9, indent = 0) {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...NAVY);
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    for (const line of lines) {
      checkPageBreak(5);
      doc.text(line, marginLeft + indent, y);
      y += 4;
    }
    y += 1;
  }

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Guideway Care", marginLeft, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Call Observation Report", marginLeft, 19);

  doc.setFontSize(7);
  doc.setTextColor(200, 200, 200);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - marginRight, 19, { align: "right" });

  y = 35;

  sectionHeader("Call Information");
  labelValue("Call ID:", info.call_id);
  labelValue("Status:", info.status);
  labelValue("Processed:", formatDate(info.processed_at));
  labelValue("Processing Time:", `${(info.processing_time_ms / 1000).toFixed(1)}s`);
  if (info.care_flow_id) labelValue("Care Flow ID:", info.care_flow_id);
  if (info.source_type) labelValue("Source Type:", info.source_type);
  if (info.source_id) labelValue("Source ID:", info.source_id);
  if (info.transcript_length) labelValue("Transcript Length:", `${info.transcript_length.toLocaleString()} chars`);
  if (info.prompt_version) labelValue("Prompt Version:", `v${info.prompt_version}`);
  if (info.total_tokens) {
    labelValue("Tokens:", `Input: ${info.prompt_tokens?.toLocaleString()} | Output: ${info.completion_tokens?.toLocaleString()} | Total: ${info.total_tokens.toLocaleString()}`);
    labelValue("Estimated Cost:", `$${info.estimated_cost?.toFixed(6)}`);
  }

  if (info.context_values && Object.keys(info.context_values).length > 0) {
    checkPageBreak(10);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text("Known Context:", marginLeft, y);
    y += 5;
    for (const [k, v] of Object.entries(info.context_values)) {
      checkPageBreak(5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...NAVY);
      doc.text(`• ${k.replace(/_/g, " ")}: ${v || "—"}`, marginLeft + 4, y);
      y += 4;
    }
    y += 2;
  }

  if (info.summary) {
    sectionHeader("Summary");
    wrappedText(info.summary);
  }

  if (observations.length > 0) {
    sectionHeader(`Observations (${observations.length} topics)`);
    for (const o of observations) {
      checkPageBreak(18);
      doc.setFillColor(...LIGHT_BG);
      const obsLines = doc.splitTextToSize(o.observation_detail || "", contentWidth - 10);
      const blockHeight = 10 + obsLines.length * 4 + (o.observation_evidence ? 6 : 0) + 2;
      checkPageBreak(blockHeight);
      doc.rect(marginLeft, y - 2, contentWidth, blockHeight, "F");

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...NAVY);
      doc.text(o.observation_display_name || o.observation_name, marginLeft + 3, y + 2);

      const valText = o.observation_value || "Not discussed";
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PRIMARY);
      doc.text(`[${valText}]`, marginLeft + 3 + doc.getTextWidth(o.observation_display_name || o.observation_name) + 3, y + 2);

      if (o.observation_confidence) {
        doc.setTextColor(...GRAY);
        doc.setFontSize(7);
        doc.text(`${o.observation_confidence} confidence`, pageWidth - marginRight - 3, y + 2, { align: "right" });
      }

      y += 7;

      if (o.observation_detail) {
        doc.setFontSize(8);
        doc.setTextColor(...NAVY);
        doc.setFont("helvetica", "normal");
        for (const line of obsLines) {
          doc.text(line, marginLeft + 5, y);
          y += 4;
        }
      }

      if (o.observation_evidence) {
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        doc.setFont("helvetica", "italic");
        const evLines = doc.splitTextToSize(`"${o.observation_evidence}"`, contentWidth - 14);
        for (const line of evLines) {
          checkPageBreak(4);
          doc.text(line, marginLeft + 7, y);
          y += 3.5;
        }
      }

      y += 4;
    }
  }

  if (info.transition_status) {
    sectionHeader("Transition Status");
    wrappedText(stripHtml(info.transition_status));
  }

  if (info.follow_up_areas) {
    sectionHeader("Follow-up Areas");
    wrappedText(stripHtml(info.follow_up_areas));
  }

  if (barriers.length > 0) {
    sectionHeader(`Barriers to Care (${barriers.length} identified)`);
    for (const b of barriers) {
      checkPageBreak(14);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...NAVY);
      const tags = [b.severity, b.category].filter(Boolean).join(" | ");
      doc.text(`• ${b.barrier}`, marginLeft + 3, y);
      if (tags) {
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        doc.text(`[${tags}]`, marginLeft + 5 + doc.getTextWidth(`• ${b.barrier}`) + 2, y);
      }
      y += 5;
      if (b.context) {
        wrappedText(b.context, 8, 5);
      }
      if (b.evidence) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(...GRAY);
        const evLines = doc.splitTextToSize(`"${b.evidence}"`, contentWidth - 12);
        for (const line of evLines) {
          checkPageBreak(4);
          doc.text(line, marginLeft + 7, y);
          y += 3.5;
        }
        y += 2;
      }
    }
  }

  if (callQA.length > 0) {
    sectionHeader(`Call QA (${callQA.length} assessments)`);
    for (const cq of callQA) {
      checkPageBreak(12);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...NAVY);
      doc.text(cq.display_name || cq.name, marginLeft + 3, y);
      if (cq.value) {
        doc.setFontSize(8);
        doc.setTextColor(...PRIMARY);
        doc.setFont("helvetica", "normal");
        doc.text(`[${cq.value}]`, marginLeft + 5 + doc.getTextWidth(cq.display_name || cq.name) + 2, y);
      }
      y += 5;
      if (cq.detail) {
        wrappedText(cq.detail, 8, 5);
      }
    }
  }

  if (qaPairs.length > 0) {
    sectionHeader(`Questions & Answers (${qaPairs.length} exchanges)`);
    for (const qa of qaPairs) {
      checkPageBreak(16);
      doc.setFillColor(...LIGHT_BG);
      const qLines = doc.splitTextToSize(`Q: ${qa.question}`, contentWidth - 14);
      const aLines = doc.splitTextToSize(`A: ${qa.answer}`, contentWidth - 14);
      const blockH = (qLines.length + aLines.length) * 4 + 8;
      checkPageBreak(blockH);

      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      const meta = [`#${qa.sequence_number}`, qa.category].filter(Boolean).join(" • ");
      doc.text(meta, marginLeft + 3, y);
      y += 5;

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...NAVY);
      for (const line of qLines) {
        doc.text(line, marginLeft + 5, y);
        y += 4;
      }

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PRIMARY);
      for (const line of aLines) {
        doc.text(line, marginLeft + 5, y);
        y += 4;
      }
      y += 3;
    }
  }

  if (transcript) {
    sectionHeader("Transcript");
    const lines = transcript.split("\n").filter(l => l.trim());
    const GREEN = [90, 138, 0] as [number, number, number];
    const AGENT_BG = [240, 248, 255] as [number, number, number];
    const PATIENT_BG = [245, 255, 245] as [number, number, number];

    for (const line of lines) {
      const match = line.match(/^(user|assistant|agent|care guide|patient|AI):\s*/i);
      if (match) {
        const speaker = match[1];
        const text = line.slice(match[0].length);
        const isAgent = /^(assistant|agent|care guide|ai)$/i.test(speaker);
        const label = isAgent ? "Care Guide" : "Patient";
        const textLines = doc.splitTextToSize(text, contentWidth - 18);
        const blockH = textLines.length * 3.8 + 8;
        checkPageBreak(blockH);

        doc.setFillColor(...(isAgent ? AGENT_BG : PATIENT_BG));
        doc.roundedRect(marginLeft + (isAgent ? 0 : 8), y - 1, contentWidth - 8, blockH, 2, 2, "F");

        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...(isAgent ? PRIMARY : GREEN));
        doc.text(label, marginLeft + (isAgent ? 3 : 11), y + 3);
        y += 6;

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...NAVY);
        for (const tl of textLines) {
          doc.text(tl, marginLeft + (isAgent ? 5 : 13), y);
          y += 3.8;
        }
        y += 3;
      } else {
        checkPageBreak(6);
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(...GRAY);
        doc.text(line, marginLeft + 5, y);
        y += 4;
      }
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(
      `Guideway Care — Call ${info.call_id} — Page ${i} of ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 7,
      { align: "center" }
    );
  }

  doc.save(`call-report-${info.call_id}.pdf`);
}

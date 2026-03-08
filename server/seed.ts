import { storage } from "./storage";
import type { EnumValue } from "@shared/schema";

const DEFAULT_OBSERVATIONS: {
  name: string;
  displayName: string;
  domain: string;
  displayOrder: number;
  valueType: string;
  value: EnumValue[];
}[] = [
  {
    name: "overall_feeling",
    displayName: "Overall Feeling",
    domain: "clinical",
    displayOrder: 0,
    valueType: "enum",
    value: [
      { label: "Good", color: "GREEN" },
      { label: "Fair", color: "YELLOW" },
      { label: "Poor", color: "RED" },
      { label: "Not Discussed", color: "GRAY" },
    ],
  },
  {
    name: "disposition_change",
    displayName: "Disposition Change",
    domain: "clinical",
    displayOrder: 1,
    valueType: "enum",
    value: [
      { label: "No Readmission", color: "GREEN" },
      { label: "Readmitted", color: "RED" },
      { label: "Not Discussed", color: "GRAY" },
    ],
  },
  {
    name: "prescription_pickup",
    displayName: "Prescription Pickup",
    domain: "medication",
    displayOrder: 2,
    valueType: "enum",
    value: [
      { label: "Picked Up", color: "GREEN" },
      { label: "Partially Picked Up", color: "YELLOW" },
      { label: "Not Picked Up", color: "RED" },
      { label: "Not Asked", color: "GRAY" },
      { label: "Unknown", color: "GRAY" },
    ],
  },
  {
    name: "medication_adherence",
    displayName: "Medication Adherence",
    domain: "medication",
    displayOrder: 3,
    valueType: "enum",
    value: [
      { label: "No Issues", color: "GREEN" },
      { label: "Has Barriers", color: "RED" },
      { label: "Not Discussed", color: "GRAY" },
    ],
  },
  {
    name: "followup_appointment",
    displayName: "Follow-up Appointment",
    domain: "appointment",
    displayOrder: 4,
    valueType: "enum",
    value: [
      { label: "Scheduled", color: "GREEN" },
      { label: "Completed", color: "GREEN" },
      { label: "Not Scheduled", color: "RED" },
      { label: "Cancelled", color: "RED" },
      { label: "Not Discussed", color: "GRAY" },
    ],
  },
  {
    name: "dme_supplies",
    displayName: "DME or Supplies Delivered",
    domain: "equipment",
    displayOrder: 5,
    valueType: "enum",
    value: [
      { label: "Delivered", color: "GREEN" },
      { label: "Partially Delivered", color: "YELLOW" },
      { label: "Not Delivered", color: "RED" },
      { label: "Ordered Not Received", color: "YELLOW" },
      { label: "Not Ordered", color: "GRAY" },
      { label: "Not Discussed", color: "GRAY" },
      { label: "Unknown", color: "GRAY" },
    ],
  },
  {
    name: "home_health_visit",
    displayName: "Home Health Visit",
    domain: "clinical",
    displayOrder: 6,
    valueType: "enum",
    value: [
      { label: "Completed", color: "GREEN" },
      { label: "Scheduled", color: "GREEN" },
      { label: "Missed", color: "RED" },
      { label: "Pending", color: "YELLOW" },
      { label: "Not Discussed", color: "GRAY" },
    ],
  },
  {
    name: "discharge_instructions",
    displayName: "Discharge Instructions",
    domain: "discharge",
    displayOrder: 7,
    valueType: "enum",
    value: [
      { label: "No Questions", color: "GREEN" },
      { label: "Has Questions", color: "BLUE" },
      { label: "Not Discussed", color: "GRAY" },
    ],
  },
  {
    name: "encompass_feedback",
    displayName: "Encompass Feedback",
    domain: "experience",
    displayOrder: 8,
    valueType: "enum",
    value: [
      { label: "Positive", color: "GREEN" },
      { label: "Mixed", color: "YELLOW" },
      { label: "Negative", color: "RED" },
      { label: "Not Discussed", color: "GRAY" },
    ],
  },
  {
    name: "experience_comments",
    displayName: "Experience Comments",
    domain: "experience",
    displayOrder: 9,
    valueType: "enum",
    value: [
      { label: "Positive", color: "GREEN" },
      { label: "Mixed", color: "YELLOW" },
      { label: "Negative", color: "RED" },
      { label: "Not Discussed", color: "GRAY" },
    ],
  },
  {
    name: "other",
    displayName: "Other",
    domain: "general",
    displayOrder: 10,
    valueType: "text",
    value: [],
  },
];

export async function seedObservations() {
  try {
    const existing = await storage.getObservations();
    if (existing.length > 0) {
      console.log(`Observations already seeded (${existing.length} found).`);
      return;
    }

    console.log("Seeding default observations to BigQuery...");
    for (const obs of DEFAULT_OBSERVATIONS) {
      await storage.createObservation(obs);
    }
    console.log(`Seeded ${DEFAULT_OBSERVATIONS.length} default observations.`);
  } catch (error: any) {
    console.error("Failed to seed observations:", error.message);
  }
}

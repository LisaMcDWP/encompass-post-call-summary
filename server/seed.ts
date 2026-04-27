import { storage } from "./storage";
import type { ObservationEnumValueRich, InsertDispositionCategory, InsertDispositionDetail } from "@shared/schema";

const DEFAULT_OBSERVATIONS: {
  name: string;
  displayName: string;
  domain: string;
  displayOrder: number;
  valueType: string;
  value: ObservationEnumValueRich[];
}[] = [
  {
    name: "overall_feeling",
    displayName: "Overall Feeling",
    domain: "clinical",
    displayOrder: 0,
    valueType: "enum",
    value: [
      { label: "Good", color: "GREEN", promptHint: "" },
      { label: "Fair", color: "YELLOW", promptHint: "" },
      { label: "Poor", color: "RED", promptHint: "" },
      { label: "Not Discussed", color: "GRAY", promptHint: "" },
    ],
  },
  {
    name: "disposition_change",
    displayName: "Disposition Change",
    domain: "clinical",
    displayOrder: 1,
    valueType: "enum",
    value: [
      { label: "No Readmission", color: "GREEN", promptHint: "" },
      { label: "Readmitted", color: "RED", promptHint: "" },
      { label: "Not Discussed", color: "GRAY", promptHint: "" },
    ],
  },
  {
    name: "prescription_pickup",
    displayName: "Prescription Pickup",
    domain: "medication",
    displayOrder: 2,
    valueType: "enum",
    value: [
      { label: "Picked Up", color: "GREEN", promptHint: "" },
      { label: "Partially Picked Up", color: "YELLOW", promptHint: "" },
      { label: "Not Picked Up", color: "RED", promptHint: "" },
      { label: "Not Asked", color: "GRAY", promptHint: "" },
      { label: "Unknown", color: "GRAY", promptHint: "" },
    ],
  },
  {
    name: "medication_adherence",
    displayName: "Medication Adherence",
    domain: "medication",
    displayOrder: 3,
    valueType: "enum",
    value: [
      { label: "No Issues", color: "GREEN", promptHint: "" },
      { label: "Has Barriers", color: "RED", promptHint: "" },
      { label: "Not Discussed", color: "GRAY", promptHint: "" },
    ],
  },
  {
    name: "followup_appointment",
    displayName: "Follow-up Appointment",
    domain: "appointment",
    displayOrder: 4,
    valueType: "enum",
    value: [
      { label: "Scheduled", color: "GREEN", promptHint: "" },
      { label: "Completed", color: "GREEN", promptHint: "" },
      { label: "Not Scheduled", color: "RED", promptHint: "" },
      { label: "Cancelled", color: "RED", promptHint: "" },
      { label: "Not Discussed", color: "GRAY", promptHint: "" },
    ],
  },
  {
    name: "dme_supplies",
    displayName: "DME or Supplies Delivered",
    domain: "equipment",
    displayOrder: 5,
    valueType: "enum",
    value: [
      { label: "Delivered", color: "GREEN", promptHint: "" },
      { label: "Partially Delivered", color: "YELLOW", promptHint: "" },
      { label: "Not Delivered", color: "RED", promptHint: "" },
      { label: "Ordered Not Received", color: "YELLOW", promptHint: "" },
      { label: "Not Ordered", color: "GRAY", promptHint: "" },
      { label: "Not Discussed", color: "GRAY", promptHint: "" },
      { label: "Unknown", color: "GRAY", promptHint: "" },
    ],
  },
  {
    name: "home_health_visit",
    displayName: "Home Health Visit",
    domain: "clinical",
    displayOrder: 6,
    valueType: "enum",
    value: [
      { label: "Completed", color: "GREEN", promptHint: "" },
      { label: "Scheduled", color: "GREEN", promptHint: "" },
      { label: "Missed", color: "RED", promptHint: "" },
      { label: "Pending", color: "YELLOW", promptHint: "" },
      { label: "Not Discussed", color: "GRAY", promptHint: "" },
    ],
  },
  {
    name: "discharge_instructions",
    displayName: "Discharge Instructions",
    domain: "discharge",
    displayOrder: 7,
    valueType: "enum",
    value: [
      { label: "No Questions", color: "GREEN", promptHint: "" },
      { label: "Has Questions", color: "BLUE", promptHint: "" },
      { label: "Not Discussed", color: "GRAY", promptHint: "" },
    ],
  },
  {
    name: "encompass_feedback",
    displayName: "Encompass Feedback",
    domain: "experience",
    displayOrder: 8,
    valueType: "enum",
    value: [
      { label: "Positive", color: "GREEN", promptHint: "" },
      { label: "Mixed", color: "YELLOW", promptHint: "" },
      { label: "Negative", color: "RED", promptHint: "" },
      { label: "Not Discussed", color: "GRAY", promptHint: "" },
    ],
  },
  {
    name: "experience_comments",
    displayName: "Experience Comments",
    domain: "experience",
    displayOrder: 9,
    valueType: "enum",
    value: [
      { label: "Positive", color: "GREEN", promptHint: "" },
      { label: "Mixed", color: "YELLOW", promptHint: "" },
      { label: "Negative", color: "RED", promptHint: "" },
      { label: "Not Discussed", color: "GRAY", promptHint: "" },
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

export async function seedObservations(clientPathwayId?: number) {
  try {
    let cpId = clientPathwayId;
    if (!cpId) {
      const allCPs = await storage.getClientPathways();
      if (allCPs.length === 0) {
        console.log("No client/pathway configured. Skipping observation seeding.");
        return;
      }
      cpId = allCPs[0].id;
    }
    const existing = await storage.getObservations(cpId);
    if (existing.length > 0) {
      console.log(`Observations already seeded (${existing.length} found) for client/pathway ${cpId}.`);
      return;
    }

    console.log(`Seeding default observations to BigQuery for client/pathway ${cpId}...`);
    for (const obs of DEFAULT_OBSERVATIONS) {
      await storage.createObservation(cpId, { ...obs, isActive: true, promptGuidance: "", description: "" });
    }
    console.log(`Seeded ${DEFAULT_OBSERVATIONS.length} default observations.`);
  } catch (error: any) {
    console.error("Failed to seed observations:", error.message);
  }
}

const DEFAULT_DISPOSITION_CATEGORIES: { name: string; displayName: string; description: string; displayOrder: number; details: { name: string; displayName: string; description: string; displayOrder: number }[] }[] = [
  {
    name: "connected", displayName: "Connected", description: "Contact was made and meaningful interaction occurred", displayOrder: 0,
    details: [
      { name: "completed_interaction", displayName: "Completed Interaction", description: "Full conversation completed successfully", displayOrder: 0 },
      { name: "transferred_to_agent", displayName: "Transferred to Agent", description: "Call was transferred to a live agent", displayOrder: 1 },
      { name: "callback_requested", displayName: "Callback Requested", description: "Person requested a callback", displayOrder: 2 },
      { name: "not_interested", displayName: "Not Interested / Declined", description: "Person declined or was not interested", displayOrder: 3 },
      { name: "dnc_request", displayName: "Do Not Call (DNC Request)", description: "Person requested to be placed on DNC list", displayOrder: 4 },
    ],
  },
  {
    name: "no_contact", displayName: "No Contact", description: "Unable to reach the person", displayOrder: 1,
    details: [
      { name: "no_answer", displayName: "No Answer", description: "Call rang but was not answered", displayOrder: 0 },
      { name: "voicemail_left", displayName: "Voicemail Left", description: "Voicemail message was left", displayOrder: 1 },
      { name: "voicemail_no_message", displayName: "Voicemail – No Message Left", description: "Reached voicemail but no message was left", displayOrder: 2 },
      { name: "busy_signal", displayName: "Busy Signal", description: "Line was busy", displayOrder: 3 },
      { name: "call_dropped", displayName: "Call Dropped / Disconnected", description: "Call was dropped or disconnected unexpectedly", displayOrder: 4 },
    ],
  },
  {
    name: "invalid_contact", displayName: "Invalid Contact", description: "Contact data issues", displayOrder: 2,
    details: [
      { name: "wrong_number", displayName: "Wrong Number", description: "Reached wrong person/number", displayOrder: 0 },
      { name: "disconnected_number", displayName: "Disconnected Number", description: "Number is no longer in service", displayOrder: 1 },
      { name: "invalid_format", displayName: "Invalid Number Format", description: "Phone number format is invalid", displayOrder: 2 },
      { name: "wrong_person", displayName: "Reached Wrong Person", description: "Connected but reached someone other than the intended recipient", displayOrder: 3 },
    ],
  },
  {
    name: "follow_up", displayName: "Follow-Up / Deferral", description: "Requires follow-up action", displayOrder: 3,
    details: [
      { name: "callback_specific_time", displayName: "Callback Requested (Specific Time)", description: "Callback requested for a specific date/time", displayOrder: 0 },
      { name: "callback_general", displayName: "Callback Requested (General)", description: "Callback requested without specific time", displayOrder: 1 },
      { name: "reschedule_needed", displayName: "Reschedule Needed", description: "Call or appointment needs to be rescheduled", displayOrder: 2 },
      { name: "pending_follow_up", displayName: "Pending Follow-Up", description: "Follow-up action is pending", displayOrder: 3 },
    ],
  },
  {
    name: "compliance", displayName: "Compliance / Suppression", description: "Regulatory or compliance-related outcomes", displayOrder: 4,
    details: [
      { name: "dnc", displayName: "Do Not Call (DNC)", description: "On DNC registry", displayOrder: 0 },
      { name: "opt_out", displayName: "Opt-Out (Channel Specific)", description: "Opted out of specific channel (SMS/Voice)", displayOrder: 1 },
      { name: "deceased", displayName: "Deceased", description: "Patient is deceased", displayOrder: 2 },
      { name: "language_barrier", displayName: "Language Barrier / Unsupported Language", description: "Unable to communicate due to language barrier", displayOrder: 3 },
    ],
  },
  {
    name: "system_failure", displayName: "System / Technical Failure", description: "System or technical issues", displayOrder: 5,
    details: [
      { name: "network_error", displayName: "Failed – Network Error", description: "Call failed due to network issues", displayOrder: 0 },
      { name: "carrier_blocked", displayName: "Failed – Carrier Blocked", description: "Call blocked by carrier", displayOrder: 1 },
      { name: "invalid_route", displayName: "Failed – Invalid Route", description: "Call routing failed", displayOrder: 2 },
      { name: "abandoned_call", displayName: "Abandoned Call", description: "Call was abandoned before connection", displayOrder: 3 },
    ],
  },
];

export async function seedDispositions(clientPathwayId?: number) {
  try {
    let cpId = clientPathwayId;
    if (!cpId) {
      const allCPs = await storage.getClientPathways();
      if (allCPs.length === 0) {
        console.log("No client/pathway configured. Skipping disposition seeding.");
        return;
      }
      cpId = allCPs[0].id;
    }
    const existing = await storage.getDispositionCategories(cpId);
    if (existing.length > 0) {
      console.log(`Dispositions already seeded (${existing.length} categories found) for client/pathway ${cpId}.`);
      return;
    }

    console.log(`Seeding default dispositions to BigQuery for client/pathway ${cpId}...`);
    for (const cat of DEFAULT_DISPOSITION_CATEGORIES) {
      const created = await storage.createDispositionCategory(cpId, {
        name: cat.name,
        displayName: cat.displayName,
        description: cat.description,
        displayOrder: cat.displayOrder,
        isActive: true,
      });
      for (const det of cat.details) {
        await storage.createDispositionDetail(cpId, {
          categoryId: created.id,
          name: det.name,
          displayName: det.displayName,
          description: det.description,
          displayOrder: det.displayOrder,
          isActive: true,
        });
      }
    }
    console.log(`Seeded ${DEFAULT_DISPOSITION_CATEGORIES.length} disposition categories with details.`);
  } catch (error: any) {
    console.error("Failed to seed dispositions:", error.message);
  }
}

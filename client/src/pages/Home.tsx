import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Play, CheckCircle2, AlertCircle, FileText, ListChecks, ClipboardList, Settings2, RotateCcw, FileSearch, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const SAMPLE_TRANSCRIPTS: Record<string, { label: string; transcript: string; context?: Record<string, string> }> = {
  struggling: {
    label: "Struggling Patient",
    transcript: `Care Guide: Hello, this is Maria from Guideway Care. Am I speaking with Mrs. Thompson?
Patient: Yes, this is her daughter, Lisa. Mom is here but she's not feeling well enough to talk much.
Care Guide: I understand, Lisa. Thank you for being there with her. I'm calling to check in on your mother since she was discharged from Encompass Rehabilitation Hospital last week. How has she been feeling overall since coming home?
Patient's Daughter: Honestly, not great. She's been really weak and dizzy. She can barely get out of bed some days. She's also been having a lot of pain in her hip where the surgery was.
Care Guide: I'm sorry to hear that. Has your mother had to visit the ER, hospital, or any care facility since she was discharged?
Patient's Daughter: No, we haven't gone back, but I've been worried we might need to. The pain has been really bad.
Care Guide: I understand your concern. Let's talk about her medications. Were you able to pick up all of her prescriptions from the pharmacy?
Patient's Daughter: We got most of them, but one of them — I think it's the blood thinner — the pharmacy said it needed a prior authorization and it's been four days and we still don't have it. The copay on the pain medication was also really high, $85, so we only got a partial fill.
Care Guide: That's definitely something we need to address. Is your mother having any other concerns or questions about taking her medications?
Patient's Daughter: She says the new pain pill makes her nauseous and she's been skipping doses because of it. She's also confused about when to take the blood pressure medication — morning or night? Nobody explained it clearly.
Care Guide: Thank you for sharing that. Has your mother had her follow-up appointment with her doctor since being discharged?
Patient's Daughter: It was supposed to be this Thursday, but we had to cancel it because we can't get transportation. I don't drive and the bus doesn't go near the doctor's office.
Care Guide: I see. Has a home health nurse visited since your mother came home?
Patient's Daughter: They were supposed to come on Monday but nobody showed up. We called the agency and they said they'd reschedule but we haven't heard back.
Care Guide: Were any medical equipment or supplies supposed to be delivered to your home?
Patient's Daughter: Yes, she was supposed to get a walker and a shower chair. The walker came but the shower chair hasn't arrived yet. We've been using a regular chair which doesn't feel safe.
Care Guide: I understand. Do you or your mother have any questions about the discharge instructions you received?
Patient's Daughter: Yes, actually. The paperwork says she should be doing exercises three times a day, but she's in too much pain. Are those really necessary right now? And it mentions wound care but we're not sure if we're doing it right.
Care Guide: Those are great questions and I'll make sure the care team addresses them. How was your mother's overall experience during her stay at Encompass?
Patient's Daughter: Mom said the nurses were nice but the room was always cold and the food was terrible. She also felt like the physical therapy sessions were too short and she wasn't ready to come home when they discharged her.
Care Guide: Thank you for sharing all of this, Lisa. I'm going to escalate several of these items to make sure your mother gets the support she needs. I'll follow up with you tomorrow.
Patient's Daughter: Thank you, Maria. We really appreciate the help.`,
  },
  positive: {
    label: "Positive Experience",
    transcript: `Care Guide: Hello, this is James from Guideway Care. Am I speaking with Mr. Rodriguez?
Patient: Yes, this is Carlos. How are you?
Care Guide: I'm doing well, thank you! I'm calling to check in on you since you were discharged from Encompass Rehabilitation Hospital about a week ago. How have you been feeling overall since getting home?
Patient: I've been feeling pretty good, actually. Each day I feel a little stronger. The first couple of days were tough, but I've been following the exercise routine they gave me and it's really helping.
Care Guide: That's wonderful to hear. Have you had to visit the ER, hospital, or any care facility since you were discharged?
Patient: No, nothing like that. I've been staying home and resting like they told me to.
Care Guide: Great. Were you able to pick up all of your prescriptions from the pharmacy?
Patient: Yes, my wife picked them all up the day I came home. Everything was ready and the pharmacy was very helpful explaining how to take everything.
Care Guide: That's great. Are you having any issues, concerns, or questions about taking your medications?
Patient: No, everything has been smooth. I set up a pill organizer so I don't miss anything. No side effects that I've noticed.
Care Guide: Excellent. Have you been able to schedule or attend a follow-up appointment with your doctor?
Patient: Yes, I saw Dr. Patel this past Monday and he said everything is healing well. My next appointment is in three weeks.
Care Guide: Perfect. Has a home health nurse come to visit you?
Patient: Yes, she came on Wednesday. Her name was Angela. She checked my vitals, looked at the incision site, and said everything looked great. She'll be coming once a week for the next month.
Care Guide: That's excellent. Were any medical equipment or supplies delivered to your home?
Patient: Yes, we got the walker and the raised toilet seat delivered the day before I came home. Everything was set up and ready.
Care Guide: Do you have any questions about your discharge instructions or anything for the care team?
Patient: No, I think the team at Encompass did a really thorough job explaining everything before I left. The binder they gave me has been super helpful to reference.
Care Guide: That's great to hear. How was your overall experience during your stay at Encompass?
Patient: Honestly, it was excellent. The staff were incredibly kind and professional. My physical therapist, Mike, was amazing — he pushed me just the right amount. The facility was clean, the food was decent, and I felt like they genuinely cared about my recovery. I'd recommend Encompass to anyone.
Care Guide: That's wonderful feedback, Mr. Rodriguez. It sounds like you're doing really well. I'll check back in with you next week. Take care!
Patient: Thank you, James. I appreciate the call.`,
  },
  no_dme_hh: {
    label: "No DME/HH Ordered",
    context: { dme_or_supplies_ordered: "false", home_health_ordered: "false" },
    transcript: `Care Guide: Hi, this is Laura from Guideway Care. Am I speaking with Mrs. Davis?
Patient: Yes, this is Patricia.
Care Guide: Hi Patricia. I'm calling to check in on you since your discharge from Encompass last week. How have you been feeling overall?
Patient: I've been feeling fair. Some good days and some not-so-good days. My energy is still really low.
Care Guide: I'm sorry to hear that. Have you had to go back to the ER, hospital, or any care facility since your discharge?
Patient: No, I've been staying home. Just taking it easy.
Care Guide: Good. Were you able to pick up all of your prescriptions?
Patient: Yes, my son picked everything up the day I got home. All of them were ready.
Care Guide: Great. Are you having any issues or concerns with your medications?
Patient: No, I've been taking everything as prescribed. No problems so far.
Care Guide: Wonderful. Have you had or scheduled your follow-up appointment with your doctor?
Patient: Yes, I have an appointment next Wednesday with Dr. Kim.
Care Guide: Perfect. Do you have any questions about the discharge instructions you received?
Patient: No, everything was pretty clear. The nurses went over it all before I left.
Care Guide: How was your overall experience at Encompass?
Patient: It was good. Everyone was professional and caring. I felt well taken care of.
Care Guide: That's great to hear. Thank you for your time, Patricia. We'll check in again next week.
Patient: Thank you, Laura.`,
  },
  med_issues_no_dme: {
    label: "Med Issues, No DME",
    context: { dme_or_supplies_ordered: "false", home_health_ordered: "false" },
    transcript: `Care Guide: Hello, this is David from Guideway Care. Am I speaking with Mr. Jackson?
Patient: Yes, speaking.
Care Guide: Hi Mr. Jackson. I'm calling to follow up after your discharge from Encompass Rehabilitation. How are you feeling overall?
Patient: Not the best. I've been having some stomach issues and I'm not sleeping well.
Care Guide: I'm sorry to hear that. Have you had to visit the ER or hospital since your discharge?
Patient: No, nothing like that.
Care Guide: Were you able to pick up all of your medications from the pharmacy?
Patient: I got most of them but one of them wasn't covered by my insurance. The pharmacy said they need to contact my doctor for an alternative. That was five days ago and I still haven't heard anything.
Care Guide: That's concerning. Which medication is it?
Patient: The muscle relaxer. I've been having bad spasms without it.
Care Guide: I'll make sure that gets followed up on. Are you having any other issues with your medications?
Patient: Yeah, the new stomach medication gives me terrible headaches. I've been thinking about stopping it but I don't want to do that without asking.
Care Guide: That's wise. Have you scheduled or attended your follow-up appointment?
Patient: I'm supposed to see my doctor next Monday. I plan to ask about the medications then.
Care Guide: Good. Do you have any questions about your discharge instructions?
Patient: Not really. I've been following them as best I can.
Care Guide: How was your experience during your stay at Encompass?
Patient: Mixed. The therapy sessions were really helpful but the communication between staff could have been better. Sometimes I'd get different instructions from different people.
Care Guide: Thank you for that feedback, Mr. Jackson. I'll get the medication issue flagged right away. Take care.
Patient: Thanks, David.`,
  },
  caregiver_no_dme: {
    label: "Caregiver, No DME",
    context: { dme_or_supplies_ordered: "false", home_health_ordered: "false" },
    transcript: `Care Guide: Hi, this is Monica from Guideway Care. I'm calling for Mrs. Chen. Am I speaking with a family member?
Patient's Son: Yes, this is her son, Kevin. Mom doesn't speak much English so I handle these calls.
Care Guide: Thank you, Kevin. I'm checking in on your mother since her discharge from Encompass. How has she been feeling overall?
Patient's Son: She's been doing okay. She says she feels fair — some pain in her knee but it's getting better each day.
Care Guide: That's good to hear. Has she had to go back to the hospital or ER since discharge?
Patient's Son: No, she's been home the whole time. No issues like that.
Care Guide: Were you able to pick up all of her prescriptions?
Patient's Son: Yes, I picked them all up. But she's having trouble with the pain medication. She says it makes her dizzy so she's only taking half the dose.
Care Guide: That's important for the doctor to know. Is she having any other medication concerns?
Patient's Son: Just that one. Everything else she's taking fine.
Care Guide: Has she had her follow-up appointment?
Patient's Son: Not yet. We're trying to schedule it but Dr. Lee's office is booked out for two weeks. We're on a cancellation list.
Care Guide: Okay. Any questions about the discharge instructions?
Patient's Son: No, I translated everything for her and we've been following the guidelines.
Care Guide: How was her experience at Encompass?
Patient's Son: She said it was positive. She really liked her physical therapist and felt safe there. No complaints.
Care Guide: Thank you, Kevin. I'll note the medication concern and follow up. Take care.
Patient's Son: Thank you, Monica.`,
  },
  still_in_hospital: {
    label: "Still in Hospital",
    transcript: `Care Guide: Hello, this is Angela from Guideway Care. Am I speaking with Mrs. Franklin?
Patient's Daughter: No, this is her daughter, Brenda. Mom can't come to the phone right now.
Care Guide: Thank you, Brenda. I'm calling to check in on your mother since she was discharged from Encompass Rehabilitation Hospital about ten days ago. How has she been feeling?
Patient's Daughter: Well, things took a bad turn. She started running a high fever last Thursday and was vomiting. We took her to the ER at St. Luke's and they admitted her. She's still there now.
Care Guide: I'm so sorry to hear that. Can you tell me a little more about what happened?
Patient's Daughter: They said she has a urinary tract infection that got into her bloodstream — sepsis, they called it. She's been on IV antibiotics since Friday. The doctors say she's improving but they want to keep her at least a few more days for monitoring.
Care Guide: I'm glad she's getting the care she needs. So she's currently still at St. Luke's Hospital?
Patient's Daughter: Yes, she's in room 412. She's been here since last Thursday night, so almost a week now.
Care Guide: Before the readmission, had you been able to pick up her prescriptions from after the Encompass discharge?
Patient's Daughter: Yes, we had all of those. She was taking everything as prescribed. No issues with the medications from Encompass.
Care Guide: That's good. Had she been able to attend any follow-up appointments before this happened?
Patient's Daughter: She had one scheduled for this past Monday with her primary care doctor but obviously we had to cancel it since she's in the hospital. We'll need to reschedule once she's out.
Care Guide: Understood. Was home health visiting before the readmission?
Patient's Daughter: Yes, they came twice. The nurse came on Monday and Wednesday of last week. Everything seemed fine at those visits, which is why the fever on Thursday was such a surprise.
Care Guide: Were any equipment or supplies delivered to the home?
Patient's Daughter: Yes, the walker and the bedside commode were both delivered and she was using them. I don't know what will happen with those now — she might need different things when she eventually comes home from St. Luke's.
Care Guide: Do you have any questions about her care or discharge instructions?
Patient's Daughter: I'm confused about what happens next. When she leaves St. Luke's, does she go back to Encompass for more rehab, or does she come home? And will she get new discharge instructions that replace the old ones? It's all very overwhelming.
Care Guide: Those are really important questions and I'll make sure the care team addresses them. How was your mother's experience at Encompass before all of this?
Patient's Daughter: She liked Encompass. The therapists were great and she felt like she was making progress. It's just devastating that this infection set her back so much.
Care Guide: Thank you for sharing all of this, Brenda. I'm going to coordinate with the care team regarding your mother's current hospitalization and make sure we have a plan for when she's ready to transition out of St. Luke's. I'll follow up with you in a couple of days.
Patient's Daughter: Thank you, Angela. That would be very helpful.`,
  },
  readmitted: {
    label: "Readmitted (Back Home)",
    transcript: `Care Guide: Hello, this is Sarah from Guideway Care. Am I speaking with Mr. Williams?
Patient: No, this is his wife, Denise. Harold is here but he's resting.
Care Guide: Thank you, Denise. I'm calling to check in on Harold since he was discharged from Encompass Rehabilitation Hospital two weeks ago. How has he been feeling overall?
Patient's Wife: Well, it's been a rough couple of weeks. He was doing okay for the first few days at home, but then last Tuesday he started having trouble breathing and chest pain.
Care Guide: I'm sorry to hear that. Did Harold have to visit the ER or hospital since being discharged?
Patient's Wife: Yes, we called 911 last Tuesday night and he was taken to Memorial General Hospital. They admitted him right away. They said he had fluid buildup around his lungs and a possible infection. He was in the hospital for five days.
Care Guide: I'm glad he got the care he needed. Where is Harold currently?
Patient's Wife: He's back home now. They discharged him from Memorial on Sunday. He's doing better but still very weak. He's on oxygen at home now, which is new.
Care Guide: Thank you for letting me know. Were you able to pick up Harold's new prescriptions from the pharmacy after his hospital stay?
Patient's Wife: Most of them, yes. But the new antibiotic they prescribed — they said it's a specialty medication and we have to get it from a mail-order pharmacy. It's been three days and it hasn't arrived yet. I'm worried because he's supposed to be taking it already.
Care Guide: That's definitely urgent. Is Harold having any other medication concerns?
Patient's Wife: He's overwhelmed with all the new medications on top of his old ones. He went from taking 4 pills a day to 11. He doesn't understand what half of them are for and he's worried about interactions. He also says the new water pill makes him have to use the bathroom every 30 minutes, which is exhausting.
Care Guide: I understand. Has Harold been able to schedule a follow-up appointment with his doctor since coming home from Memorial?
Patient's Wife: His cardiologist wants to see him this Friday, so that's set up. But his primary care doctor can't get him in for three weeks, which seems too long given everything that happened.
Care Guide: Has a home health nurse visited since Harold came back from Memorial?
Patient's Wife: The home health agency from before said they need a new referral since he was readmitted. Nobody has come yet. We're still waiting on that to be processed.
Care Guide: Were any new medical equipment or supplies delivered after his hospital stay?
Patient's Wife: The oxygen equipment was delivered by the hospital's supplier, but we were also told he'd be getting a hospital bed and a pulse oximeter. The pulse oximeter came but the hospital bed hasn't arrived and it's been four days. He's been sleeping in the recliner because he can't breathe well lying flat.
Care Guide: Do you have any questions about Harold's discharge instructions from either Encompass or Memorial?
Patient's Wife: Yes, the instructions from Memorial say to limit fluids to 1.5 liters a day, but the Encompass instructions say to drink plenty of fluids. Which one do we follow? Also, should he still be doing the physical therapy exercises from Encompass or wait until he's stronger?
Care Guide: Those are important questions and I'll make sure the care team clarifies both. How was Harold's experience during his stay at Encompass before the readmission?
Patient's Wife: Harold thought the care at Encompass was good overall. He liked his therapists and the nursing staff. His only complaint was that he felt rushed out too soon. He told me he didn't feel ready to go home and now with the readmission, he feels like maybe he was right. But the people there were good — no complaints about the staff.
Care Guide: Thank you for sharing all of this, Denise. I'm going to flag several items for immediate follow-up, especially the missing antibiotic and the hospital bed delivery. I'll call you back tomorrow with updates.
Patient's Wife: Thank you so much, Sarah. We really need the help right now.`,
  },
};


interface ContextParam {
  id: number;
  name: string;
  displayName: string;
  description: string;
  dataType: string;
  enumValues?: string[];
  isActive: boolean;
}

export default function Home() {
  const [careFlowId, setCareFlowId] = useState("");
  const [interactionDatetime, setInteractionDatetime] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [contextParams, setContextParams] = useState<ContextParam[]>([]);
  const [contextValues, setContextValues] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/prompt")
      .then((r) => r.json())
      .then((data) => {
        setDefaultPrompt(data.prompt);
        setCustomPrompt(data.prompt);
      })
      .catch(() => {});

    fetch("/api/context-parameters")
      .then((r) => r.json())
      .then((data) => {
        const active = data.filter((p: ContextParam) => p.isActive);
        setContextParams(active);
      })
      .catch(() => {});
  }, []);

  const handleTestApi = async () => {
    if (!sourceText.trim()) {
      toast({
        title: "Missing Source Text",
        description: "Please provide source text to analyze.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setResult(null);
    
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          care_flow_id: careFlowId.trim() || undefined,
          processed_datetime: interactionDatetime.trim() || undefined,
          source_type: sourceType.trim() || undefined,
          source_id: sourceId.trim() || undefined,
          source_text: sourceText.trim(),
          context: Object.keys(contextValues).length > 0
            ? Object.fromEntries(
                Object.entries(contextValues).filter(([_, v]) => v.trim() !== "")
              )
            : undefined,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || "Failed to analyze transcript");
      }
      
      setResult(data);
      toast({
        title: "Analysis Complete",
        description: `Processed in ${data.data.processingTimeMs}ms · ${data.data.tokenUsage?.totalTokens?.toLocaleString() || 0} tokens · $${data.data.tokenUsage?.estimatedCost?.toFixed(6) || '0.000000'}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process transcript.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full bg-background text-foreground font-sans">
      <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">
        
        <div className="flex flex-col space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            API Playground
          </h1>
          <p className="text-muted-foreground text-sm">
            Test the Gemini-powered analysis pipeline with sample or custom source text.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Input Section */}
          <Card className="border-border/60 bg-card shadow-lg shadow-black/5 flex flex-col h-full">
            <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
              <CardTitle className="flex items-center gap-2 text-primary">
                <FileText className="h-5 w-5" />
                API Request Payload
              </CardTitle>
              <CardDescription className="text-sm">
                Configure the input parameters for the Gemini analysis endpoint.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-6 flex-grow">

              <div className="space-y-3">
                <Label className="text-sm font-semibold text-foreground">Load Sample Transcript</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(SAMPLE_TRANSCRIPTS).map(([key, sample]) => (
                    <Button
                      key={key}
                      variant="outline"
                      size="sm"
                      className={`h-8 text-xs justify-start transition-colors ${
                        sample.context
                          ? "border-amber-300/60 text-amber-700 bg-amber-50/50 hover:bg-amber-100 hover:text-amber-800"
                          : "border-primary/20 text-primary hover:bg-primary hover:text-white"
                      }`}
                      onClick={() => {
                        setSourceText(sample.transcript);
                        if (sample.context) {
                          setContextValues({ ...sample.context });
                        } else {
                          setContextValues({});
                        }
                      }}
                      data-testid={`button-load-sample-${key}`}
                    >
                      {sample.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {contextParams.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-foreground">Known Context</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {contextParams.map((cp) => (
                      <div key={cp.id} className="space-y-1">
                        <Label htmlFor={`ctx-${cp.name}`} className="text-xs text-muted-foreground">
                          {cp.displayName}
                        </Label>
                        {cp.dataType === "enum" && cp.enumValues && cp.enumValues.length > 0 ? (
                          <select
                            id={`ctx-${cp.name}`}
                            value={contextValues[cp.name] || ""}
                            onChange={(e) => setContextValues({ ...contextValues, [cp.name]: e.target.value })}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-inner font-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                            data-testid={`input-context-${cp.name}`}
                          >
                            <option value="">-- Select --</option>
                            {cp.enumValues.map((val) => (
                              <option key={val} value={val}>{val}</option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            id={`ctx-${cp.name}`}
                            type={cp.dataType === "number" ? "number" : cp.dataType === "date" ? "date" : "text"}
                            placeholder={cp.description || `Enter ${cp.displayName.toLowerCase()}`}
                            value={contextValues[cp.name] || ""}
                            onChange={(e) => setContextValues({ ...contextValues, [cp.name]: e.target.value })}
                            className="font-mono text-sm shadow-inner bg-background h-9"
                            data-testid={`input-context-${cp.name}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-2 flex-grow flex flex-col">
                <Label htmlFor="sourceText" className="text-sm font-semibold text-foreground">Source Text <span className="text-destructive">*</span></Label>
                <Textarea 
                  id="sourceText" 
                  placeholder="Paste call transcript or source text here..." 
                  className="min-h-[300px] flex-grow font-mono text-sm leading-relaxed bg-background shadow-inner resize-y border-border/60 focus-visible:ring-primary"
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  data-testid="input-source-text"
                />
              </div>

              <Collapsible open={showPromptEditor} onOpenChange={setShowPromptEditor}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between h-9 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border/60 rounded-md"
                    data-testid="button-toggle-prompt"
                  >
                    <span className="flex items-center gap-2">
                      <Settings2 className="h-3.5 w-3.5" />
                      Gemini Prompt Template
                      {customPrompt && defaultPrompt && customPrompt.trim() !== defaultPrompt.trim() && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-400 text-orange-500">Modified</Badge>
                      )}
                    </span>
                    <span>{showPromptEditor ? "Collapse" : "Expand"}</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prompt Template</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setCustomPrompt(defaultPrompt);
                        toast({ title: "Prompt Reset", description: "Restored to default prompt template." });
                      }}
                      data-testid="button-reset-prompt"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset
                    </Button>
                  </div>
                  <Textarea
                    className="min-h-[250px] font-mono text-xs leading-relaxed bg-background shadow-inner resize-y border-border/60 focus-visible:ring-primary"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    data-testid="input-prompt"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Use <code className="bg-muted px-1 rounded text-[10px]">{"{{CALL_ID}}"}</code> and <code className="bg-muted px-1 rounded text-[10px]">{"{{TRANSCRIPT}}"}</code> as placeholders. They will be replaced with the actual values before sending to Gemini.
                  </p>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between h-9 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border/60 rounded-md"
                    data-testid="button-toggle-metadata"
                  >
                    <span className="flex items-center gap-2">
                      <Settings2 className="h-3.5 w-3.5" />
                      Request Metadata
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </span>
                    <span>Expand</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="careFlowId" className="text-xs text-muted-foreground">Care Flow ID</Label>
                    <Input 
                      id="careFlowId" 
                      placeholder="e.g. cf_abc123" 
                      value={careFlowId}
                      onChange={(e) => setCareFlowId(e.target.value)}
                      className="font-mono text-sm shadow-inner bg-background h-9"
                      data-testid="input-care-flow-id"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="interactionDatetime" className="text-xs text-muted-foreground">Interaction Datetime</Label>
                      <Input 
                        id="interactionDatetime" 
                        type="datetime-local"
                        value={interactionDatetime}
                        onChange={(e) => setInteractionDatetime(e.target.value)}
                        className="font-mono text-sm shadow-inner bg-background h-9"
                        data-testid="input-interaction-datetime"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sourceType" className="text-xs text-muted-foreground">Source Type</Label>
                      <Input 
                        id="sourceType" 
                        placeholder="e.g. phone_call, chat" 
                        value={sourceType}
                        onChange={(e) => setSourceType(e.target.value)}
                        className="font-mono text-sm shadow-inner bg-background h-9"
                        data-testid="input-source-type"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sourceId" className="text-xs text-muted-foreground">Source ID</Label>
                      <Input 
                        id="sourceId" 
                        placeholder="e.g. call_987654321" 
                        value={sourceId}
                        onChange={(e) => setSourceId(e.target.value)}
                        className="font-mono text-sm shadow-inner bg-background h-9"
                        data-testid="input-source-id"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t border-border/40 pt-6">
              <Button 
                onClick={handleTestApi} 
                disabled={isProcessing}
                className="w-full font-semibold text-base shadow-md bg-primary hover:bg-secondary text-white transition-all"
                size="lg"
                data-testid="button-test-api"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing via Gemini AI...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" />
                    Execute API Request
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Output Section */}
          <div className="space-y-6">
            {!result && !isProcessing && (
              <Card className="h-full border-dashed border-2 border-border/60 bg-muted/10 flex flex-col items-center justify-center p-12 text-center text-muted-foreground min-h-[500px]">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <FileSearch className="h-8 w-8 text-primary/50" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-foreground">Awaiting Execution</h3>
                <p className="max-w-md text-sm">
                  Click "Execute API Request" to send the transcript to your GCP Gemini model and view the structured output. Results are also logged to BigQuery.
                </p>
              </Card>
            )}

            {isProcessing && (
              <Card className="h-full border-border/60 bg-card flex flex-col items-center justify-center p-12 text-center shadow-lg shadow-black/5 min-h-[500px]">
                <div className="relative mb-6">
                  <div className="absolute inset-0 rounded-full blur-xl bg-primary/20 animate-pulse"></div>
                  <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-foreground">Analyzing Transcript</h3>
                <div className="space-y-3 text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg border border-border/50 w-full max-w-xs text-left">
                  <p className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-accent" /> <span className="font-mono text-xs">Authenticating GCP...</span></p>
                  <p className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-accent" /> <span className="font-mono text-xs">Invoking Gemini Model...</span></p>
                  <p className="flex items-center gap-3"><Loader2 className="h-4 w-4 animate-spin text-primary" /> <span className="font-mono text-xs text-foreground font-medium">Extracting MPG insights...</span></p>
                </div>
              </Card>
            )}

            {result && !isProcessing && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border-accent/30 bg-accent/5 shadow-md">
                  <CardHeader className="pb-3 bg-white/50 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-mono text-[#4d6d08] flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                      HTTP 200 OK — Response Processed
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-3 font-mono text-muted-foreground hover:text-foreground"
                      onClick={() => setShowRawJson(!showRawJson)}
                      data-testid="button-toggle-json"
                    >
                      {showRawJson ? "Hide" : "Show"} Full JSON
                    </Button>
                  </CardHeader>
                  {showRawJson ? (
                    <CardContent className="font-mono text-xs overflow-auto bg-[#172938] p-4 rounded-b-lg text-green-400 max-h-[600px]">
                      <pre>{JSON.stringify(result, null, 2)}</pre>
                    </CardContent>
                  ) : (
                    <CardContent className="font-mono text-xs overflow-auto bg-[#172938] p-4 rounded-b-lg text-green-400">
                      <pre>{JSON.stringify({ 
                        care_flow_id: result.data.care_flow_id,
                        source_type: result.data.source_type,
                        source_id: result.data.source_id,
                        processedAt: result.data.processedAt,
                        processingTimeMs: result.data.processingTimeMs,
                        status: "success",
                        model: "gemini-2.0-flash",
                        tokenUsage: result.data.tokenUsage
                      }, null, 2)}</pre>
                    </CardContent>
                  )}
                </Card>

                {/* Summary */}
                {result.data.tokenUsage && (
                  <div className="flex flex-wrap gap-3 text-xs" data-testid="metrics-bar">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/40 border border-border/40">
                      <span className="text-muted-foreground">Processing:</span>
                      <span className="font-semibold text-foreground" data-testid="metric-processing-time">{(result.data.processingTimeMs / 1000).toFixed(1)}s</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/40 border border-border/40">
                      <span className="text-muted-foreground">Input:</span>
                      <span className="font-semibold text-foreground" data-testid="metric-prompt-tokens">{result.data.tokenUsage.promptTokens?.toLocaleString()}</span>
                      <span className="text-muted-foreground">tokens</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/40 border border-border/40">
                      <span className="text-muted-foreground">Output:</span>
                      <span className="font-semibold text-foreground" data-testid="metric-completion-tokens">{result.data.tokenUsage.completionTokens?.toLocaleString()}</span>
                      <span className="text-muted-foreground">tokens</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/40 border border-border/40">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-semibold text-foreground" data-testid="metric-total-tokens">{result.data.tokenUsage.totalTokens?.toLocaleString()}</span>
                      <span className="text-muted-foreground">tokens</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
                      <span className="text-muted-foreground">Est. Cost:</span>
                      <span className="font-semibold text-primary" data-testid="metric-cost">${result.data.tokenUsage.estimatedCost?.toFixed(6)}</span>
                    </div>
                  </div>
                )}

                <Card className="border-border/60 bg-card shadow-md">
                  <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                    <CardTitle className="text-lg flex items-center gap-2 text-secondary">
                      <FileText className="h-5 w-5 text-primary" />
                      Interaction Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm leading-relaxed text-foreground">
                      {result.data.analysis.summary}
                    </p>
                  </CardContent>
                </Card>

                {/* Observations */}
                {result.data.analysis.observations && result.data.analysis.observations.length > 0 && (
                  <Card className="border-border/60 bg-card shadow-md" data-testid="card-observations">
                    <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                      <CardTitle className="text-lg flex items-center gap-2 text-secondary">
                        <Activity className="h-5 w-5 text-primary" />
                        Observations
                        <Badge variant="outline" className="text-xs ml-2" data-testid="badge-observations-count">
                          {result.data.analysis.observations.length} topics
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-3" data-testid="list-observations">
                        {result.data.analysis.observations.map((obs: any, index: number) => (
                          <div
                            key={obs.name || index}
                            className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/20"
                            data-testid={`observation-item-${obs.name || index}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-sm text-foreground" data-testid={`observation-name-${obs.name}`}>
                                  {obs.display_name}
                                </span>
                                {obs.domain && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                                    {obs.domain}
                                  </Badge>
                                )}
                                {obs.value !== null && obs.value !== undefined && (
                                  <Badge
                                    className="text-xs"
                                    variant={
                                      typeof obs.value === "string" &&
                                      ["good", "green", "yes", "true", "no concerns", "no issues"].includes(obs.value.toLowerCase())
                                        ? "default"
                                        : typeof obs.value === "string" &&
                                          ["concerning", "red", "issues", "problems"].includes(obs.value.toLowerCase())
                                          ? "destructive"
                                          : "secondary"
                                    }
                                    data-testid={`observation-value-${obs.name}`}
                                  >
                                    {String(obs.value)}
                                  </Badge>
                                )}
                                {(obs.value === null || obs.value === undefined) && (
                                  <Badge variant="outline" className="text-xs text-muted-foreground" data-testid={`observation-value-${obs.name}`}>
                                    Not discussed
                                  </Badge>
                                )}
                              </div>
                              {obs.detail && (
                                <p className="text-sm text-muted-foreground leading-relaxed" data-testid={`observation-detail-${obs.name}`}>
                                  {obs.detail}
                                </p>
                              )}
                              {obs.evidence && (
                                <p className="text-xs text-muted-foreground/70 mt-1 italic" data-testid={`observation-evidence-${obs.name}`}>
                                  Evidence: "{obs.evidence}"
                                </p>
                              )}
                              {obs.confidence && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] mt-1 ${
                                    obs.confidence === "high" ? "border-green-300 text-green-700" :
                                    obs.confidence === "medium" ? "border-amber-300 text-amber-700" :
                                    "border-red-300 text-red-700"
                                  }`}
                                  data-testid={`observation-confidence-${obs.name}`}
                                >
                                  {obs.confidence} confidence
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Follow Up Areas */}
                {result.data.analysis.follow_up_areas && (
                  <Card className="border-border/60 bg-card shadow-md" data-testid="card-follow-up-areas">
                    <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                      <CardTitle className="text-lg flex items-center gap-2 text-secondary">
                        <ListChecks className="h-5 w-5 text-accent" />
                        Follow-up Areas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="bg-muted/30 p-4 rounded-lg border border-border/50 text-sm leading-relaxed" data-testid="text-follow-up-areas"
                        dangerouslySetInnerHTML={{
                          __html: result.data.analysis.follow_up_areas
                        }}
                      />
                    </CardContent>
                  </Card>
                )}

                {/* Transition Status */}
                {result.data.analysis.transition_status && (
                  <Card className="border-border/60 bg-card shadow-md" data-testid="card-transition-status">
                    <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                      <CardTitle className="text-lg flex items-center gap-2 text-secondary">
                        <ClipboardList className="h-5 w-5 text-primary" />
                        Transition Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="bg-muted/30 p-4 rounded-lg border border-border/50 text-sm leading-relaxed" data-testid="text-transition-status"
                        dangerouslySetInnerHTML={{
                          __html: result.data.analysis.transition_status
                        }}
                      />
                    </CardContent>
                  </Card>
                )}


              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
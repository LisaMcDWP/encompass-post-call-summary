import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Play, CheckCircle2, AlertCircle, FileText, ListChecks, ClipboardList, Settings2, RotateCcw, AlertTriangle, FileSearch } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const SAMPLE_TRANSCRIPTS: Record<string, { label: string; transcript: string }> = {
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
  readmitted: {
    label: "Readmitted Patient",
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


export default function Home() {
  const [callId, setCallId] = useState("");
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/prompt")
      .then((r) => r.json())
      .then((data) => {
        setDefaultPrompt(data.prompt);
        setCustomPrompt(data.prompt);
      })
      .catch(() => {});
  }, []);

  const handleTestApi = async () => {
    if (!transcript.trim()) {
      toast({
        title: "Missing Transcript",
        description: "Please provide a transcript to analyze.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setResult(null);
    
    try {
      const isCustom = customPrompt.trim() !== defaultPrompt.trim();
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: callId.trim() || undefined,
          transcript: transcript.trim(),
          customPrompt: isCustom ? customPrompt.trim() : undefined,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || "Failed to analyze transcript");
      }
      
      setResult(data);
      toast({
        title: "Analysis Complete",
        description: `Processed in ${data.data.processingTimeMs}ms via Gemini.`,
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
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Guideway Branded Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/images/guideway-logo.svg" alt="Guideway Care Logo" className="h-8" />
            <span className="ml-4 text-sm font-medium text-muted-foreground border-l border-border pl-4 hidden sm:inline-block">
              Activation Intelligence
            </span>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="font-medium text-xs py-1 px-2 border-primary/20 text-primary bg-primary/5">
              Environment: Testing
            </Badge>
            <Badge variant="secondary" className="font-medium text-xs py-1 px-2 bg-[#96d410]/20 text-[#4d6d08] border border-[#96d410]/30 hover:bg-[#96d410]/30 hidden sm:inline-flex">
              GCP Ready
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-10 space-y-8">
        
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Transcript Analysis API
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Evaluate the Gemini-powered pipeline for extracting structured clinical and operational insights from patient interaction transcripts.
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
            <CardContent className="space-y-6 pt-6 flex-grow">
              <div className="space-y-2">
                <Label htmlFor="callId" className="text-sm font-semibold text-foreground">Call ID (Optional)</Label>
                <Input 
                  id="callId" 
                  placeholder="e.g. gdw_call_987654321" 
                  value={callId}
                  onChange={(e) => setCallId(e.target.value)}
                  className="font-mono text-sm shadow-inner bg-background"
                  data-testid="input-call-id"
                />
              </div>
              
              <div className="space-y-2 flex-grow flex flex-col">
                <div className="flex justify-between items-center">
                  <Label htmlFor="transcript" className="text-sm font-semibold text-foreground">Patient Interaction Transcript</Label>
                  <div className="flex gap-1.5">
                    {Object.entries(SAMPLE_TRANSCRIPTS).map(([key, sample]) => (
                      <Button
                        key={key}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-3 border-primary/20 text-primary hover:bg-primary hover:text-white transition-colors"
                        onClick={() => setTranscript(sample.transcript)}
                        data-testid={`button-load-sample-${key}`}
                      >
                        {sample.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <Textarea 
                  id="transcript" 
                  placeholder="Paste call transcript here..." 
                  className="min-h-[300px] flex-grow font-mono text-sm leading-relaxed bg-background shadow-inner resize-y border-border/60 focus-visible:ring-primary"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  data-testid="input-transcript"
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
                      {customPrompt.trim() !== defaultPrompt.trim() && (
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
                        callId: result.data.callId,
                        processedAt: result.data.processedAt,
                        processingTimeMs: result.data.processingTimeMs,
                        status: "success",
                        model: "gemini-2.0-flash"
                      }, null, 2)}</pre>
                    </CardContent>
                  )}
                </Card>

                {/* Summary */}
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

                {/* Disposition Change */}
                <Card className={`border-border/60 bg-card shadow-md ${result.data.analysis.disposition_change ? 'border-red-400/60' : ''}`} data-testid="card-disposition-change">
                  <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                    <CardTitle className="text-lg flex items-center gap-2 text-secondary">
                      <AlertTriangle className={`h-5 w-5 ${result.data.analysis.disposition_change ? 'text-red-500' : 'text-muted-foreground'}`} />
                      Disposition Change
                      <Badge
                        variant={result.data.analysis.disposition_change ? "destructive" : "outline"}
                        className="text-xs ml-2"
                        data-testid="badge-disposition-change"
                      >
                        {result.data.analysis.disposition_change ? "Readmitted" : "No Readmission"}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {result.data.analysis.disposition_change && result.data.analysis.disposition_change_note ? (
                      <p className="text-sm leading-relaxed text-foreground" data-testid="text-disposition-note">
                        <span className="font-semibold">Current Location:</span> {result.data.analysis.disposition_change_note}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground" data-testid="text-disposition-note">
                        {result.data.analysis.disposition_change ? "Readmission detected but current location not provided." : "Patient reports no readmission since discharge."}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Follow Up Areas */}
                <Card className="border-border/60 bg-card shadow-md">
                  <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                    <CardTitle className="text-lg flex items-center gap-2 text-secondary">
                      <ListChecks className="h-5 w-5 text-accent" />
                      Care Guide Follow-up Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ul className="space-y-4">
                      {result.data.analysis.areasForFollowUp.map((item: string, i: number) => (
                        <li key={i} className="flex gap-3 text-sm group items-start" data-testid={`text-followup-${i}`}>
                          <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-[#4d6d08] text-xs font-bold border border-accent/40 shadow-sm">
                            {i + 1}
                          </span>
                          <span className="text-foreground leading-relaxed pt-0.5">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

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
                      <div className="bg-muted/30 p-4 rounded-lg border border-border/50" data-testid="text-transition-status"
                        dangerouslySetInnerHTML={{
                          __html: result.data.analysis.transition_status
                            .split(/\n/)
                            .map((line: string) => line.trim())
                            .filter((line: string) => line.length > 0)
                            .map((line: string) => {
                              const stripped = line.replace(/^[•\-\*]\s*/, "").replace(/\*\*/g, "");
                              const boldMatch = stripped.match(/^([^:]+):\s*(.*)/);
                              if (boldMatch) {
                                return `<li style="margin-bottom:6px;"><strong>${boldMatch[1]}:</strong> ${boldMatch[2]}</li>`;
                              }
                              return `<li style="margin-bottom:6px;">${stripped}</li>`;
                            })
                            .join("")
                            .replace(/^(.*)$/, '<ul style="list-style-type:disc; padding-left:1.25rem; margin:0; font-size:0.875rem; line-height:1.7; color:inherit;">$1</ul>')
                        }}
                      />
                    </CardContent>
                  </Card>
                )}


              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
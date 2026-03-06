import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Play, CheckCircle2, AlertCircle, FileText, ListChecks, MessageSquareText, Activity, HeartPulse, Pill, ClipboardList, CalendarCheck, Home as HomeIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const SAMPLE_TRANSCRIPT = `Care Guide: Hello, this is Sarah from Guideway Care. Am I speaking with Mr. Davis?
Patient: Yes, this is him.
Care Guide: Hi Mr. Davis. I'm calling to check in before your oncology appointment next Tuesday at 10:30 AM. How are you feeling about getting there?
Patient: To be honest, I'm not sure I can make it. My daughter usually drives me, but she had to pick up an extra shift at work.
Care Guide: I completely understand, and it's great that you shared that with me. It's very important we keep that appointment to stay on track with your treatment. What if I could arrange a medical transport to pick you up and bring you back home at no cost to you?
Patient: Really? That would be a huge relief. I was stressing over it.
Care Guide: Absolutely. Let's get that set up right now. I'll schedule them to arrive at your house by 9:30 AM. What if the driver doesn't show up?
Patient: I don't know, what should I do?
Care Guide: I've set up a direct line for you. If they aren't there by 9:45 AM, call me immediately and I will arrange an alternative. Do I need to pay for this ride?
Patient: No, you said it was covered, right?
Care Guide: Exactly, this service is fully covered as part of your care program. 
Patient: Thank you, Sarah. What should I bring to the appointment?
Care Guide: Please bring your ID, your updated medication list, and the forms we mailed to you last week.
Patient: Got it. I'll have them ready.
Care Guide: Wonderful. I'll call you Monday to confirm the transport details. Have a good weekend, Mr. Davis!`;

export default function Home() {
  const [callId, setCallId] = useState("");
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

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
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: callId.trim() || undefined, transcript: transcript.trim() }),
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-xs px-3 border-primary/20 text-primary hover:bg-primary hover:text-white transition-colors"
                    onClick={() => setTranscript(SAMPLE_TRANSCRIPT)}
                    data-testid="button-load-sample"
                  >
                    Load MPG Sample
                  </Button>
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
                  <MessageSquareText className="h-8 w-8 text-primary/50" />
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
                  <CardHeader className="pb-3 bg-white/50">
                    <CardTitle className="text-sm font-mono text-[#4d6d08] flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                      HTTP 200 OK — Response Processed
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="font-mono text-xs overflow-auto bg-[#172938] p-4 rounded-b-lg text-green-400">
                    <pre>{JSON.stringify({ 
                      callId: result.data.callId,
                      processedAt: result.data.processedAt,
                      processingTimeMs: result.data.processingTimeMs,
                      status: "success",
                      model: "gemini-2.0-flash"
                    }, null, 2)}</pre>
                  </CardContent>
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

                {/* Clinical Assessment Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Disposition Change */}
                  {result.data.analysis.dispositionChange && (
                    <Card className="border-border/60 bg-card shadow-md" data-testid="card-disposition">
                      <CardHeader className="pb-2 border-b border-border/40 bg-muted/20">
                        <CardTitle className="text-base flex items-center gap-2 text-secondary">
                          <HeartPulse className="h-4 w-4 text-red-500" />
                          Disposition Change
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={result.data.analysis.dispositionChange.changed ? "destructive" : "outline"} className="text-xs" data-testid="badge-disposition-status">
                            {result.data.analysis.dispositionChange.changed ? "Change Detected" : "No Change"}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{result.data.analysis.dispositionChange.details}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Prescription Pickup Status */}
                  {result.data.analysis.prescriptionPickupStatus && (
                    <Card className="border-border/60 bg-card shadow-md" data-testid="card-prescription">
                      <CardHeader className="pb-2 border-b border-border/40 bg-muted/20">
                        <CardTitle className="text-base flex items-center gap-2 text-secondary">
                          <Pill className="h-4 w-4 text-blue-500" />
                          Prescription Pickup
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs capitalize" data-testid="badge-prescription-status">
                            {result.data.analysis.prescriptionPickupStatus.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{result.data.analysis.prescriptionPickupStatus.details}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Follow-up Scheduled Status */}
                  {result.data.analysis.followUpScheduledStatus && (
                    <Card className="border-border/60 bg-card shadow-md" data-testid="card-followup-scheduled">
                      <CardHeader className="pb-2 border-b border-border/40 bg-muted/20">
                        <CardTitle className="text-base flex items-center gap-2 text-secondary">
                          <CalendarCheck className="h-4 w-4 text-green-600" />
                          Follow-up Scheduled
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={result.data.analysis.followUpScheduledStatus.scheduled ? "default" : "outline"} className="text-xs" data-testid="badge-followup-status">
                            {result.data.analysis.followUpScheduledStatus.scheduled ? "Scheduled" : "Not Scheduled"}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{result.data.analysis.followUpScheduledStatus.details}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Medication Notes */}
                  {result.data.analysis.medicationNotes && (
                    <Card className="border-border/60 bg-card shadow-md" data-testid="card-medication-notes">
                      <CardHeader className="pb-2 border-b border-border/40 bg-muted/20">
                        <CardTitle className="text-base flex items-center gap-2 text-secondary">
                          <ClipboardList className="h-4 w-4 text-orange-500" />
                          Medication Notes
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-3 space-y-3">
                        <p className="text-sm text-foreground leading-relaxed">{result.data.analysis.medicationNotes.notes}</p>
                        {result.data.analysis.medicationNotes.questions?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Questions</p>
                            <ul className="space-y-1">
                              {result.data.analysis.medicationNotes.questions.map((q: string, i: number) => (
                                <li key={i} className="text-sm text-foreground flex items-start gap-2" data-testid={`text-med-question-${i}`}>
                                  <span className="text-primary mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0"></span>
                                  {q}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.data.analysis.medicationNotes.barriers?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Barriers</p>
                            <ul className="space-y-1">
                              {result.data.analysis.medicationNotes.barriers.map((b: string, i: number) => (
                                <li key={i} className="text-sm text-foreground flex items-start gap-2" data-testid={`text-med-barrier-${i}`}>
                                  <span className="text-red-500 mt-1.5 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"></span>
                                  {b}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                  {/* Home Health Visit */}
                  {result.data.analysis.homeHealthVisit && (
                    <Card className="border-border/60 bg-card shadow-md md:col-span-2" data-testid="card-home-health">
                      <CardHeader className="pb-2 border-b border-border/40 bg-muted/20">
                        <CardTitle className="text-base flex items-center gap-2 text-secondary">
                          <HomeIcon className="h-4 w-4 text-teal-600" />
                          Home Health Visit
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={result.data.analysis.homeHealthVisit.status === "completed" ? "default" : "outline"} className="text-xs capitalize" data-testid="badge-home-health-status">
                            {result.data.analysis.homeHealthVisit.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{result.data.analysis.homeHealthVisit.details}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Q&A */}
                <Card className="border-border/60 bg-card shadow-md">
                  <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                    <CardTitle className="text-lg flex items-center gap-2 text-secondary">
                      <MessageSquareText className="h-5 w-5 text-primary" />
                      Extracted Q&A
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-4">
                      {result.data.analysis.questionsAndResponses.map((item: any, i: number) => (
                        <div key={i} className="rounded-lg border border-border/60 bg-background overflow-hidden shadow-sm" data-testid={`card-qa-${i}`}>
                          <div className="bg-muted/50 px-4 py-2.5 border-b border-border/60">
                            <p className="text-sm font-semibold text-secondary flex items-start gap-2">
                              <span className="text-primary font-bold">Q:</span> 
                              {item.question}
                            </p>
                          </div>
                          <div className="px-4 py-3 bg-card">
                            <p className="text-sm text-foreground flex items-start gap-2">
                              <span className="text-accent font-bold">A:</span> 
                              {item.response}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
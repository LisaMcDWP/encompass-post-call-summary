import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Play, CheckCircle2, AlertCircle, FileText, ListChecks, MessageSquareText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

// Mock response generation to simulate the API
const generateMockResponse = (callId: string) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        status: "success",
        data: {
          callId: callId || "call_mock_12345",
          processedAt: new Date().toISOString(),
          analysis: {
            summary: "The customer called regarding an issue with their recent billing statement. They were charged twice for the monthly subscription. The agent apologized, verified the duplicate charge, and initiated a refund process which will take 3-5 business days. The customer was satisfied with the resolution.",
            areasForFollowUp: [
              "Verify the refund of $49.99 has been successfully processed to the customer's credit card ending in 4455.",
              "Investigate the root cause of the duplicate billing system error to prevent future occurrences.",
              "Send a confirmation email to the customer once the refund clears."
            ],
            questionsAndResponses: [
              {
                question: "Why was I charged twice this month?",
                response: "I see the duplicate charge here. It looks like a system error on our end during the billing cycle. I apologize for the inconvenience."
              },
              {
                question: "How long will it take to get my money back?",
                response: "I've initiated the refund right now. It typically takes 3 to 5 business days for the funds to appear back on your card."
              },
              {
                question: "Do I need to do anything else?",
                response: "No, you're all set. I've handled everything on my end and you'll receive an email confirmation shortly."
              }
            ]
          }
        }
      });
    }, 2500); // 2.5s delay to simulate Gemini processing
  });
};

const SAMPLE_TRANSCRIPT = `Agent: Thank you for calling Customer Support, my name is Alex. How can I help you today?
Customer: Hi Alex, I'm calling because I just looked at my bank statement and I was charged twice for my monthly subscription.
Agent: I completely understand your concern, and I apologize for that. Let me pull up your account. Could you verify your name and the last four digits of your card?
Customer: John Smith, and the card ends in 4455.
Agent: Thank you, John. Yes, I see the duplicate charge here. It looks like a system error on our end during the billing cycle. Why was I charged twice this month? It was definitely a glitch in our automated system. I apologize for the inconvenience.
Customer: Okay. How long will it take to get my money back?
Agent: I've initiated the refund right now. It typically takes 3 to 5 business days for the funds to appear back on your card.
Customer: Alright, that works. Do I need to do anything else?
Agent: No, you're all set. I've handled everything on my end and you'll receive an email confirmation shortly.
Customer: Great, thanks for your help Alex.
Agent: You're very welcome. Have a wonderful rest of your day!`;

export default function Home() {
  const [callId, setCallId] = useState("");
  const [transcript, setTranscript] = useState(SAMPLE_TRANSCRIPT);
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
      // Simulate API call
      const response = await generateMockResponse(callId);
      setResult(response);
      toast({
        title: "Analysis Complete",
        description: "Successfully processed transcript using Gemini.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process transcript.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gemini Transcript Analyzer</h1>
            <p className="text-muted-foreground mt-2">
              Test interface for the GCP-deployed Gemini processing API.
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="font-mono text-xs py-1 px-2">
              Status: Mock UI
            </Badge>
            <Badge variant="secondary" className="font-mono text-xs py-1 px-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">
              GCP Deployment Pending
            </Badge>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Input Section */}
          <Card className="border-border bg-card/50 backdrop-blur-sm shadow-xl shadow-black/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                API Request Payload
              </CardTitle>
              <CardDescription>
                Configure the input parameters for the Gemini analysis endpoint.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="callId" className="text-sm font-medium">Call ID (Optional)</Label>
                <Input 
                  id="callId" 
                  placeholder="e.g. call_987654321" 
                  value={callId}
                  onChange={(e) => setCallId(e.target.value)}
                  className="font-mono text-sm bg-background/50"
                  data-testid="input-call-id"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="transcript" className="text-sm font-medium">Transcript</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs px-2 text-muted-foreground"
                    onClick={() => setTranscript(SAMPLE_TRANSCRIPT)}
                  >
                    Load Sample
                  </Button>
                </div>
                <Textarea 
                  id="transcript" 
                  placeholder="Paste call transcript here..." 
                  className="min-h-[300px] font-mono text-sm leading-relaxed bg-background/50 resize-y"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  data-testid="input-transcript"
                />
              </div>
            </CardContent>
            <CardFooter className="bg-muted/20 border-t border-border/50 pt-6">
              <Button 
                onClick={handleTestApi} 
                disabled={isProcessing}
                className="w-full font-medium"
                data-testid="button-test-api"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing via Gemini...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Execute API Request
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Output Section */}
          <div className="space-y-6">
            {!result && !isProcessing && (
              <Card className="h-full border-dashed border-2 border-border/60 bg-transparent flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <MessageSquareText className="h-12 w-12 mb-4 opacity-20" />
                <h3 className="text-lg font-medium mb-2 text-foreground">Awaiting Execution</h3>
                <p className="max-w-sm text-sm">
                  Click "Execute API Request" to simulate sending the transcript to the Gemini model and viewing the structured output.
                </p>
              </Card>
            )}

            {isProcessing && (
              <Card className="h-full border-border bg-card/50 flex flex-col items-center justify-center p-12 text-center shadow-xl shadow-black/10">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <h3 className="text-lg font-medium mb-2">Analyzing Transcript</h3>
                <div className="space-y-2 text-sm text-muted-foreground max-w-sm">
                  <p className="flex items-center justify-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Connecting to GCP...</p>
                  <p className="flex items-center justify-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Invoking Gemini Model...</p>
                  <p className="flex items-center justify-center gap-2 animate-pulse"><Loader2 className="h-4 w-4 animate-spin" /> Extracting insights...</p>
                </div>
              </Card>
            )}

            {result && !isProcessing && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border-green-500/20 bg-green-500/5 shadow-xl shadow-black/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-mono text-green-500 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      HTTP 200 OK
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="font-mono text-xs overflow-auto bg-black/40 p-4 rounded-md mx-6 mb-6 text-green-400/90">
                    <pre>{JSON.stringify({ 
                      callId: result.data.callId,
                      processedAt: result.data.processedAt,
                      status: "success"
                    }, null, 2)}</pre>
                  </CardContent>
                </Card>

                {/* Summary */}
                <Card className="border-border bg-card/50 shadow-xl shadow-black/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-500" />
                      Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-card-foreground/90">
                      {result.data.analysis.summary}
                    </p>
                  </CardContent>
                </Card>

                {/* Follow Up Areas */}
                <Card className="border-border bg-card/50 shadow-xl shadow-black/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ListChecks className="h-5 w-5 text-orange-500" />
                      Areas for Follow-up
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {result.data.analysis.areasForFollowUp.map((item: string, i: number) => (
                        <li key={i} className="flex gap-3 text-sm group">
                          <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-orange-500/10 text-orange-500 text-xs font-medium border border-orange-500/20">
                            {i + 1}
                          </span>
                          <span className="text-card-foreground/90 leading-relaxed pt-0.5">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Q&A */}
                <Card className="border-border bg-card/50 shadow-xl shadow-black/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquareText className="h-5 w-5 text-purple-500" />
                      Questions & Responses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {result.data.analysis.questionsAndResponses.map((item: any, i: number) => (
                        <div key={i} className="rounded-lg border border-border bg-background/50 overflow-hidden">
                          <div className="bg-purple-500/10 px-4 py-2 border-b border-border/50">
                            <p className="text-sm font-medium text-purple-400">Q: {item.question}</p>
                          </div>
                          <div className="px-4 py-3">
                            <p className="text-sm text-muted-foreground">A: {item.response}</p>
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
      </div>
    </div>
  );
}
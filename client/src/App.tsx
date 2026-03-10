import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Reference from "@/pages/Reference";
import Observations from "@/pages/Observations";
import SummaryPrompt from "@/pages/SummaryPrompt";
import ContextParameters from "@/pages/ContextParameters";
import GeneratedPrompt from "@/pages/GeneratedPrompt";
import CallHistory from "@/pages/CallHistory";
import ProjectOverview from "@/pages/ProjectOverview";
import ApiReference from "@/pages/ApiReference";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/calls" component={CallHistory} />
        <Route path="/overview" component={ProjectOverview} />
        <Route path="/observations" component={Observations} />
        <Route path="/summary-prompt" component={SummaryPrompt} />
        <Route path="/context-parameters" component={ContextParameters} />
        <Route path="/generated-prompt" component={GeneratedPrompt} />
        <Route path="/api-reference" component={ApiReference} />
        <Route path="/reference" component={Reference} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

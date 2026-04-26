import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClientPathwayProvider } from "@/contexts/ClientPathwayContext";
import AppLayout from "@/components/AppLayout";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Reference from "@/pages/Reference";
import Observations from "@/pages/Observations";
import ActivationObjectives from "@/pages/ActivationObjectives";
import SummaryPrompt from "@/pages/SummaryPrompt";
import ContextParameters from "@/pages/ContextParameters";
import GeneratedPrompt from "@/pages/GeneratedPrompt";
import CallHistory from "@/pages/CallHistory";
import ProjectOverview from "@/pages/ProjectOverview";
import ApiReference from "@/pages/ApiReference";
import ProductReference from "@/pages/ProductReference";
import BatchProcessing from "@/pages/BatchProcessing";
import BarriersPrompt from "@/pages/BarriersPrompt";
import CallQA from "@/pages/CallQA";
import ClientPathway from "@/pages/ClientPathway";
import CallStats from "@/pages/CallStats";
import Dispositions from "@/pages/Dispositions";
import ReviewItems from "@/pages/ReviewItems";
import CallReviews from "@/pages/CallReviews";
import Reference2 from "@/pages/Reference2";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/calls" component={CallHistory} />
        <Route path="/overview" component={ProjectOverview} />
        <Route path="/observations" component={Observations} />
        <Route path="/activation-objectives" component={ActivationObjectives} />
        <Route path="/dispositions" component={Dispositions} />
        <Route path="/review-items" component={ReviewItems} />
        <Route path="/summary-prompt" component={SummaryPrompt} />
        <Route path="/barriers-prompt" component={BarriersPrompt} />
        <Route path="/call-qa" component={CallQA} />
        <Route path="/context-parameters" component={ContextParameters} />
        <Route path="/client-pathway" component={ClientPathway} />
        <Route path="/generated-prompt" component={GeneratedPrompt} />
        <Route path="/api-reference" component={ApiReference} />
        <Route path="/call-reviews" component={CallReviews} />
        <Route path="/call-stats" component={CallStats} />
        <Route path="/batch" component={BatchProcessing} />
        <Route path="/product" component={ProductReference} />
        <Route path="/reference" component={Reference} />
        <Route path="/reference2" component={Reference2} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ClientPathwayProvider>
          <Toaster />
          <Router />
        </ClientPathwayProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

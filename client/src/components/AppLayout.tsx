import { Link, useLocation } from "wouter";
import { Settings, FlaskConical, LayoutDashboard, BookOpen, ChevronRight, FileText, Variable, Eye, Phone, Box, Code2, Layers, Package, ShieldAlert, ClipboardCheck, Building2, ChevronDown, BarChart3, Plus, ChevronUp, ListTree } from "lucide-react";
import { useClientPathway } from "@/contexts/ClientPathwayContext";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  section: string;
}

const SETUP_ITEMS: NavItem[] = [
  { label: "Summary Prompt", href: "/summary-prompt", icon: <FileText className="h-4 w-4" />, section: "setup" },
  { label: "Barriers Prompt", href: "/barriers-prompt", icon: <ShieldAlert className="h-4 w-4" />, section: "setup" },
  { label: "Call QA", href: "/call-qa", icon: <ClipboardCheck className="h-4 w-4" />, section: "setup" },
  { label: "Context Parameters", href: "/context-parameters", icon: <Variable className="h-4 w-4" />, section: "setup" },
  { label: "Observations", href: "/observations", icon: <Settings className="h-4 w-4" />, section: "setup" },
  { label: "Dispositions", href: "/dispositions", icon: <ListTree className="h-4 w-4" />, section: "setup" },
  { label: "Generated Prompt", href: "/generated-prompt", icon: <Eye className="h-4 w-4" />, section: "setup" },
];

const ANALYTICS_ITEMS: NavItem[] = [
  { label: "Processed Calls", href: "/calls", icon: <Phone className="h-4 w-4" />, section: "analytics" },
  { label: "Call Volume", href: "/call-stats", icon: <BarChart3 className="h-4 w-4" />, section: "analytics" },
  { label: "Batch Processing", href: "/batch", icon: <Package className="h-4 w-4" />, section: "analytics" },
];

const TOOLS_ITEMS: NavItem[] = [
  { label: "API Playground", href: "/", icon: <FlaskConical className="h-4 w-4" />, section: "tools" },
];

const OVERVIEW_ITEMS: NavItem[] = [
  { label: "Product Reference", href: "/product", icon: <Layers className="h-4 w-4" />, section: "overview" },
  { label: "Project Overview", href: "/overview", icon: <Box className="h-4 w-4" />, section: "overview" },
  { label: "API Reference", href: "/api-reference", icon: <Code2 className="h-4 w-4" />, section: "overview" },
  { label: "Full Reference", href: "/reference", icon: <BookOpen className="h-4 w-4" />, section: "overview" },
];

function NavSection({ label, items, location }: { label: string; items: NavItem[]; location: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-1.5">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                data-testid={`nav-${item.href.replace("/", "") || "home"}`}
              >
                {item.icon}
                <span>{item.label}</span>
                {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ClientPathwayPicker() {
  const { clientPathways, selectedCPId, selectedCP, setSelectedCPId, loading } = useClientPathway();
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="px-4 py-5">
        <div className="h-14 rounded-lg bg-muted/30 animate-pulse" />
      </div>
    );
  }

  if (clientPathways.length === 0) {
    return (
      <div className="px-4 py-4">
        <Link href="/client-pathway">
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-lg cursor-pointer bg-amber-50 border-2 border-dashed border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors" data-testid="link-add-client-pathway">
            <Plus className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">Add Client & Pathway</p>
              <p className="text-[11px] opacity-70">Set up your first configuration</p>
            </div>
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div className="px-3 py-3">
      <div
        className="rounded-lg border-2 border-primary/20 bg-primary/[0.03] overflow-hidden transition-all"
      >
        <button
          className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-primary/[0.05] transition-colors"
          onClick={() => setExpanded(!expanded)}
          data-testid="btn-toggle-cp-picker"
        >
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{selectedCP?.client}</p>
            <p className="text-[11px] text-muted-foreground truncate">{selectedCP?.pathway}</p>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {expanded && (
          <div className="border-t border-primary/10">
            {clientPathways.map(cp => {
              const isSelected = cp.id === selectedCPId;
              return (
                <button
                  key={cp.id}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                    isSelected
                      ? "bg-primary/10"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => { setSelectedCPId(cp.id); setExpanded(false); }}
                  data-testid={`cp-option-${cp.id}`}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? "bg-primary" : "bg-muted-foreground/20"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${isSelected ? "font-semibold text-primary" : "text-foreground"}`}>{cp.client}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{cp.pathway}</p>
                  </div>
                  {isSelected && <ChevronRight className="h-3 w-3 text-primary shrink-0" />}
                </button>
              );
            })}
            <Link href="/client-pathway">
              <div
                className="flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-muted/50 transition-colors border-t border-border/50 cursor-pointer"
                onClick={() => setExpanded(false)}
                data-testid="link-manage-cp"
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Manage clients & pathways</span>
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { selectedCP, clientPathways, loading } = useClientPathway();

  const hasCP = clientPathways.length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <header className="bg-white border-b border-border sticky top-0 z-20 shadow-sm">
        <div className="px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/guideway-logo.svg" alt="Guideway Care Logo" className="h-7" />
            <span className="text-sm font-medium text-muted-foreground border-l border-border pl-3 hidden sm:inline-block">
              Call Observation Extraction
            </span>
          </div>
          <div className="flex gap-2 items-center">
            {selectedCP && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-primary/20 text-primary bg-primary/5 hidden md:inline-flex">
                {selectedCP.client} — {selectedCP.pathway}
              </span>
            )}
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-[#96d410]/30 text-[#4d6d08] bg-[#96d410]/10 hidden sm:inline-flex">
              GCP Ready
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 bg-white border-r border-border flex flex-col shrink-0 overflow-y-auto">
          <ClientPathwayPicker />

          <nav className="flex-1 py-1 px-3 space-y-4 overflow-y-auto">
            {hasCP && (
              <NavSection
                label={`${selectedCP?.client || "Client"} Setup`}
                items={SETUP_ITEMS}
                location={location}
              />
            )}

            <NavSection label="Tools" items={TOOLS_ITEMS} location={location} />
            <NavSection label="Analytics" items={ANALYTICS_ITEMS} location={location} />
            <NavSection label="Overview" items={OVERVIEW_ITEMS} location={location} />
          </nav>

          <div className="px-3 py-3 border-t border-border">
            <p className="text-[10px] text-muted-foreground/50 text-center">Guideway Care API v1</p>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

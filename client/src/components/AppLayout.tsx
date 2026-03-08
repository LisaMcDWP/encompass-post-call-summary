import { Link, useLocation } from "wouter";
import { Settings, FlaskConical, LayoutDashboard, BookOpen, ChevronRight, FileText, Variable } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  section: string;
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Setup",
    items: [
      { label: "Observations", href: "/observations", icon: <Settings className="h-4 w-4" />, section: "setup" },
      { label: "Summary Prompt", href: "/summary-prompt", icon: <FileText className="h-4 w-4" />, section: "setup" },
      { label: "Context Parameters", href: "/context-parameters", icon: <Variable className="h-4 w-4" />, section: "setup" },
    ],
  },
  {
    title: "Test",
    items: [
      { label: "API Playground", href: "/", icon: <FlaskConical className="h-4 w-4" />, section: "test" },
    ],
  },
  {
    title: "Overview",
    items: [
      { label: "API Reference", href: "/reference", icon: <BookOpen className="h-4 w-4" />, section: "overview" },
    ],
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <header className="bg-white border-b border-border sticky top-0 z-20 shadow-sm">
        <div className="px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/guideway-logo.svg" alt="Guideway Care Logo" className="h-7" />
            <span className="text-sm font-medium text-muted-foreground border-l border-border pl-3 hidden sm:inline-block">
              Activation Intelligence
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-primary/20 text-primary bg-primary/5">
              Testing
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-[#96d410]/30 text-[#4d6d08] bg-[#96d410]/10 hidden sm:inline-flex">
              GCP Ready
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 bg-[#172938] border-r border-[#0098db]/10 flex flex-col shrink-0 overflow-y-auto">
          <nav className="flex-1 py-4 px-3 space-y-5">
            {NAV_SECTIONS.map((section) => (
              <div key={section.title}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 px-3 mb-1.5">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = location === item.href;
                    return (
                      <Link key={item.href} href={item.href}>
                        <div
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                            isActive
                              ? "bg-[#0098db]/15 text-[#0098db] font-medium"
                              : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
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
            ))}
          </nav>
          <div className="px-3 py-3 border-t border-white/5">
            <p className="text-[10px] text-gray-600 text-center">Guideway Care API v1</p>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

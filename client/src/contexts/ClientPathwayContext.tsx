import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface ClientPathway {
  id: number;
  client: string;
  pathway: string;
  description?: string;
  gcp_project_id?: string;
}

interface ClientPathwayContextType {
  clientPathways: ClientPathway[];
  selectedCPId: number | null;
  selectedCP: ClientPathway | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setSelectedCPId: (id: number | null) => void;
}

const ClientPathwayContext = createContext<ClientPathwayContextType>({
  clientPathways: [],
  selectedCPId: null,
  selectedCP: null,
  loading: true,
  refresh: async () => {},
  setSelectedCPId: () => {},
});

export function ClientPathwayProvider({ children }: { children: ReactNode }) {
  const [clientPathways, setClientPathways] = useState<ClientPathway[]>([]);
  const [selectedCPId, setSelectedCPId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/client-pathways");
      if (res.ok) {
        const data: ClientPathway[] = await res.json();
        setClientPathways(data);
        if (data.length > 0) {
          const stored = localStorage.getItem("selectedCPId");
          const storedId = stored ? parseInt(stored, 10) : null;
          if (storedId && data.some(cp => cp.id === storedId)) {
            setSelectedCPId(storedId);
          } else {
            setSelectedCPId(data[0].id);
          }
        } else {
          setSelectedCPId(null);
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (selectedCPId !== null) {
      localStorage.setItem("selectedCPId", String(selectedCPId));
    }
  }, [selectedCPId]);

  const selectedCP = clientPathways.find(cp => cp.id === selectedCPId) || null;

  return (
    <ClientPathwayContext.Provider value={{ clientPathways, selectedCPId, selectedCP, loading, refresh, setSelectedCPId }}>
      {children}
    </ClientPathwayContext.Provider>
  );
}

export function useClientPathway() {
  return useContext(ClientPathwayContext);
}

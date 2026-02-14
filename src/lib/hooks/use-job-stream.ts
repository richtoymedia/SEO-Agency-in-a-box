"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface JobStreamState {
  job: Record<string, unknown> | null;
  isConnected: boolean;
  error: string | null;
}

export function useJobStream(jobId: string | null) {
  const [state, setState] = useState<JobStreamState>({
    job: null,
    isConnected: false,
    error: null,
  });
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const startPolling = useCallback((id: string) => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/sse/jobs/${id}`);
        if (!res.ok) return;
        const reader = res.body?.getReader();
        if (!reader) return;
        const { value } = await reader.read();
        reader.cancel();
        if (value) {
          const text = new TextDecoder().decode(value);
          const lines = text.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.job) {
                  setState((prev) => ({ ...prev, job: data.job }));
                }
              } catch {}
            }
          }
        }
      } catch {}
    }, 2000);
  }, []);

  useEffect(() => {
    if (!jobId) return;

    try {
      const es = new EventSource(`/api/sse/jobs/${jobId}`);
      eventSourceRef.current = es;

      es.onopen = () => {
        setState((prev) => ({ ...prev, isConnected: true, error: null }));
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.job) {
            setState((prev) => ({ ...prev, job: data.job }));
          }
          if (data.type === "done") {
            es.close();
            setState((prev) => ({ ...prev, isConnected: false }));
          }
        } catch {}
      };

      es.onerror = () => {
        es.close();
        setState((prev) => ({ ...prev, isConnected: false, error: "SSE failed, polling..." }));
        startPolling(jobId);
      };
    } catch {
      startPolling(jobId);
    }

    return () => {
      eventSourceRef.current?.close();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [jobId, startPolling]);

  return state;
}

import { useCallback, useRef, useState } from "react";

interface StreamEvent {
  event: string;
  data: string;
}

export function useStream() {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  const connect = useCallback((es: EventSource) => {
    sourceRef.current = es;
    setIsStreaming(true);
    setEvents([]);

    es.onmessage = (e) => {
      setEvents((prev) => [...prev, { event: "message", data: e.data }]);
    };

    es.onerror = () => {
      es.close();
      setIsStreaming(false);
    };

    es.addEventListener("done", () => {
      es.close();
      setIsStreaming(false);
    });
  }, []);

  const disconnect = useCallback(() => {
    sourceRef.current?.close();
    setIsStreaming(false);
  }, []);

  return { events, isStreaming, connect, disconnect };
}

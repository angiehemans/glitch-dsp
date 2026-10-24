// JUCE 8 native integration object, injected by WebBrowserComponent before the page loads.
interface JuceBackend {
  emitEvent(eventId: string, payload: unknown): void;
  addEventListener(eventId: string, fn: (payload: any) => void): [string, number];
  removeEventListener(token: [string, number]): void;
}

interface Window {
  __JUCE__?: { backend: JuceBackend };
}

// Scamp components type slots as React.ReactNode (its documented convention); map it to Preact.
declare namespace React {
  type ReactNode = import("preact").ComponentChildren;
}

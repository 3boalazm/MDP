// A shared shape that every separation engine's hook conforms to — the
// "swappable provider" abstraction, realized in a way that fits this
// codebase's existing conventions instead of fighting them.
//
// This is deliberately NOT a class hierarchy with runtime provider
// selection (e.g. `getProvider(engineId).start()`), because React's Rules of
// Hooks make that awkward: a hook used internally by a dynamically-chosen
// provider object would need to be called unconditionally at the top of a
// component regardless, so the indirection buys nothing. Instead, every
// engine gets its own top-level hook call (useSeparation, useFallback, and
// useHuggingFaceSeparation below), each conforming to this shape, and
// page.tsx's `mode` state is the actual discriminant selecting which one's
// state/actions get rendered/invoked. Adding a future engine (RunPod, Modal
// again, etc.) means writing one more hook against this same shape and one
// more `mode` branch — not rewriting the UI.
import type { SeparationOptions, SeparationResult } from "./useSeparation";

export interface SeparationProviderState {
  elapsedMs: number;
  error: string | null;
  errorKind: string | null;
  result: SeparationResult | null;
}

export interface SeparationProviderHook<TState extends SeparationProviderState> {
  state: TState;
  start: (file: File, options?: SeparationOptions) => void | Promise<void>;
  cancel: () => void;
  reset: () => void;
}

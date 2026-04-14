"use client";

import { createContext, useContext } from "react";

export type ViewMode = "summary" | "clean";

export const ViewModeContext = createContext<ViewMode>("summary");

export function useViewMode(): ViewMode {
  return useContext(ViewModeContext);
}

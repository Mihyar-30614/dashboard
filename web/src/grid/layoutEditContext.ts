import { createContext } from "react";

/** When false, boards are scan-first: no drag/resize/remove/settings chrome. */
export const LayoutEditContext = createContext<{ editing: boolean }>({
  editing: true,
});

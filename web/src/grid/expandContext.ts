import { createContext } from "react";

// Provided per grid item by useLayoutPage so WidgetFrame can offer a
// drill-down view without widget components plumbing props through.
export const ExpandContext = createContext<{ onExpand: () => void } | null>(null);

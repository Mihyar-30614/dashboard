import type React from "react";
import UsersTotal from "./UsersTotal";
import DauCard from "./DauCard";
import HealthCard from "./HealthCard";

export type WidgetComponentProps = {
  app?: string;
  editing: boolean;
  onRemove?: () => void;
  params?: Record<string, unknown>;
};

export const WIDGETS: Record<
  string,
  {
    label: string;
    defaultSize: { w: number; h: number };
    scope: "app" | "overview" | "both";
    Component: React.FC<WidgetComponentProps>;
  }
> = {
  users_total: {
    label: "Users (total)",
    defaultSize: { w: 2, h: 2 },
    scope: "app",
    Component: UsersTotal as any,
  },
  dau: {
    label: "DAU",
    defaultSize: { w: 2, h: 2 },
    scope: "app",
    Component: DauCard as any,
  },
  health: {
    label: "Health",
    defaultSize: { w: 2, h: 2 },
    scope: "both",
    Component: HealthCard as any,
  },
};

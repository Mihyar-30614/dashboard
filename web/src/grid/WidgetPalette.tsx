import {
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { WIDGETS } from "../widgets/registry";

export type DynamicPaletteItem = {
  key: string;
  label: string;
  description: string;
  defaultSize: { w: number; h: number };
  scope: "app" | "overview";
  appSlug?: string;
  onPick: () => void;
};

/** Overview first-add recommendations — glance-before-drill starters. */
const OVERVIEW_STARTERS = ["app_status", "uptime", "sp_admin_todos"] as const;

const PALETTE_GROUPS: {
  label: string;
  kinds: string[];
  /** Collapsed by default on overview (secondary catalog). */
  overviewCollapsed?: boolean;
}[] = [
  { label: "Status", kinds: ["app_status", "health", "pm2", "uptime", "traffic"] },
  {
    label: "Debt & budget",
    kinds: [
      "dm_payoff",
      "dm_interest",
      "dm_balance_trend",
      "dm_paid_vs_charged",
      "dm_utilization",
      "dm_cashflow",
      "dm_category_movers",
      "dm_bills_due",
    ],
  },
  { label: "Money", kinds: ["sp_wallet_money", "sp_money_flow", "sp_games", "sp_admin_todos"] },
  { label: "Players", kinds: ["sp_funnel", "sp_growth", "sp_retention", "sp_invites"] },
  { label: "Household", kinds: ["hd_spend", "hd_price_creep", "hd_todo_flow"] },
];

function PaletteButton({
  label,
  description,
  sizeLabel,
  kindLabel,
  onClick,
  recommended,
}: {
  label: string;
  description: string;
  sizeLabel: string;
  kindLabel: string;
  onClick: () => void;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "12px 14px",
        background: recommended
          ? "color-mix(in srgb, var(--accent) 8%, transparent)"
          : "transparent",
        color: "var(--text)",
        borderColor: recommended
          ? "color-mix(in srgb, var(--accent) 35%, var(--border))"
          : "var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          {label}
          {recommended && (
            <span
              style={{
                marginLeft: 8,
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--accent)",
                fontWeight: 500,
              }}
            >
              starter
            </span>
          )}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.14em",
            color: "var(--muted)",
            flexShrink: 0,
          }}
        >
          {sizeLabel}
        </span>
      </div>
      {description && (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.45,
            color: "var(--muted)",
            fontWeight: 400,
            whiteSpace: "normal",
          }}
        >
          {description}
        </div>
      )}
      <div
        style={{
          marginTop: 2,
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--muted)",
          opacity: 0.7,
        }}
      >
        {kindLabel}
      </div>
    </button>
  );
}

function GroupLabel({
  children,
  collapsed,
  onToggle,
  count,
}: {
  children: string;
  collapsed?: boolean;
  onToggle?: () => void;
  count?: number;
}) {
  if (!onToggle) {
    return (
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--muted)",
          padding: "8px 2px 2px",
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        padding: "8px 2px 2px",
        background: "transparent",
        border: "none",
        color: "var(--muted)",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {collapsed ? (
        <ChevronRight size={12} strokeWidth={1.8} />
      ) : (
        <ChevronDown size={12} strokeWidth={1.8} />
      )}
      {children}
      {typeof count === "number" && (
        <span style={{ opacity: 0.7 }}>({count})</span>
      )}
    </button>
  );
}

export default function WidgetPalette({
  open,
  scope,
  appSlug,
  dynamic = [],
  onPick,
  onClose,
  returnFocusRef,
}: {
  open: boolean;
  scope: "app" | "overview";
  appSlug?: string;
  dynamic?: DynamicPaletteItem[];
  onPick: (kind: string) => void;
  onClose: () => void;
  /** Focus restored here when the palette closes. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of PALETTE_GROUPS) {
      if (scope === "overview" && g.overviewCollapsed) init[g.label] = true;
    }
    if (scope === "overview") init["Custom SQL"] = true;
    return init;
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const target = returnFocusRef?.current ?? prev;
      if (target && typeof target.focus === "function") {
        window.setTimeout(() => target.focus(), 0);
      }
    };
  }, [open, onClose, returnFocusRef]);

  if (!open) return null;

  const staticItems = Object.entries(WIDGETS).filter(
    ([kind, w]) =>
      kind !== "sql" &&
      (w.scope === scope || w.scope === "both") &&
      (scope === "overview" || !w.apps || (!!appSlug && w.apps.includes(appSlug))),
  );
  const staticMap = new Map(staticItems);
  const groupedKinds = new Set(PALETTE_GROUPS.flatMap((g) => g.kinds));
  const otherItems = staticItems.filter(([kind]) => !groupedKinds.has(kind));
  const starterSet = new Set<string>(
    scope === "overview" ? OVERVIEW_STARTERS : [],
  );

  const dynamicItems = dynamic.filter(
    (d) => d.scope === scope && (scope === "overview" || d.appSlug === appSlug),
  );

  const starterItems =
    scope === "overview"
      ? OVERVIEW_STARTERS.map((kind) => {
          const def = staticMap.get(kind);
          return def ? ([kind, def] as const) : null;
        }).filter(Boolean) as [string, (typeof WIDGETS)[string]][]
      : [];

  function toggleGroup(label: string) {
    setCollapsed((c) => ({ ...c, [label]: !c[label] }));
  }

  function pick(kind: string) {
    onPick(kind);
    onClose();
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "color-mix(in srgb, var(--ink) 30%, transparent)",
          zIndex: 19,
          animation: "fadeUp 200ms ease-out both",
        }}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 340,
          background: "var(--panel)",
          borderLeft: "1px solid var(--border)",
          padding: 24,
          zIndex: 20,
          overflowY: "auto",
          boxShadow: "var(--shadow-md)",
          animation: "fadeUp 240ms ease-out both",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <div>
            <div className="eyebrow">palette · {scope}</div>
            <h3 id={titleId} style={{ marginTop: 4, marginBottom: 0 }}>
              Add widget
            </h3>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close palette"
            title="Close (Esc)"
            style={{
              width: 30,
              height: 30,
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>

        {starterItems.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <GroupLabel>Recommended starters</GroupLabel>
            <p
              style={{
                margin: "0 2px 4px",
                fontSize: 12,
                color: "var(--muted)",
                lineHeight: 1.45,
              }}
            >
              Fleet glance pack — health, process, and uptime first.
            </p>
            {starterItems.map(([kind, def]) => (
              <PaletteButton
                key={`starter-${kind}`}
                label={def.label}
                description={def.description}
                sizeLabel={`${def.defaultSize.w}×${def.defaultSize.h}`}
                kindLabel={kind}
                recommended
                onClick={() => pick(kind)}
              />
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PALETTE_GROUPS.map((group) => {
            const items = group.kinds
              .map((kind) => {
                const def = staticMap.get(kind);
                return def ? ([kind, def] as const) : null;
              })
              .filter(Boolean) as [string, (typeof WIDGETS)[string]][];
            if (items.length === 0) return null;
            // On overview, Status kinds already listed as starters — skip duplicate full Status list
            if (
              scope === "overview" &&
              group.label === "Status" &&
              starterItems.length > 0
            ) {
              return null;
            }
            const isCollapsed = !!collapsed[group.label];
            const collapsible =
              scope === "overview" && !!group.overviewCollapsed;
            return (
              <div
                key={group.label}
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <GroupLabel
                  collapsed={collapsible ? isCollapsed : undefined}
                  onToggle={
                    collapsible ? () => toggleGroup(group.label) : undefined
                  }
                  count={collapsible ? items.length : undefined}
                >
                  {group.label}
                </GroupLabel>
                {(!collapsible || !isCollapsed) &&
                  items.map(([kind, def]) => (
                    <PaletteButton
                      key={kind}
                      label={def.label}
                      description={def.description}
                      sizeLabel={`${def.defaultSize.w}×${def.defaultSize.h}`}
                      kindLabel={kind}
                      recommended={starterSet.has(kind)}
                      onClick={() => pick(kind)}
                    />
                  ))}
              </div>
            );
          })}
          {otherItems.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <GroupLabel>Other</GroupLabel>
              {otherItems.map(([kind, def]) => (
                <PaletteButton
                  key={kind}
                  label={def.label}
                  description={def.description}
                  sizeLabel={`${def.defaultSize.w}×${def.defaultSize.h}`}
                  kindLabel={kind}
                  onClick={() => pick(kind)}
                />
              ))}
            </div>
          )}
          {dynamicItems.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <GroupLabel
                collapsed={
                  scope === "overview" ? !!collapsed["Custom SQL"] : undefined
                }
                onToggle={
                  scope === "overview"
                    ? () => toggleGroup("Custom SQL")
                    : undefined
                }
                count={
                  scope === "overview" ? dynamicItems.length : undefined
                }
              >
                Custom SQL
              </GroupLabel>
              {(scope !== "overview" || !collapsed["Custom SQL"]) &&
                dynamicItems.map((item) => (
                  <PaletteButton
                    key={item.key}
                    label={item.label}
                    description={item.description}
                    sizeLabel={`${item.defaultSize.w}×${item.defaultSize.h}`}
                    kindLabel={`sql · ${item.key}`}
                    onClick={() => {
                      item.onPick();
                      onClose();
                    }}
                  />
                ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

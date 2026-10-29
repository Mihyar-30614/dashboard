import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import { fleetSummary, useFleet } from "./fleet";
import "./shell.css";

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function sinceLabel(from: number | null, now: Date): string {
  if (!from) return "not checked yet";
  const s = Math.max(0, Math.round((now.getTime() - from) / 1000));
  if (s < 60) return `checked ${s}s ago`;
  return `checked ${Math.round(s / 60)}m ago`;
}

export default function Shell() {
  const now = useNow();
  const fleet = useFleet();
  const loc = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // A drawer link changes the route; close the drawer behind it.
  useEffect(() => setDrawerOpen(false), [loc.pathname]);

  const utc = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
  const local = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const offsetH = -now.getTimezoneOffset() / 60;
  const offset = offsetH === 0 ? "" : `UTC${offsetH > 0 ? "+" : ""}${offsetH}`;

  return (
    <div className="shell">
      <Sidebar drawerOpen={drawerOpen} onCloseDrawer={() => setDrawerOpen(false)} />
      <div className="shell-body">
        <header className="shell-header">
          <button
            type="button"
            className="shell-header__menu"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} strokeWidth={1.8} />
          </button>

          <div className="shell-fleet" role="status" aria-live="polite">
            <span className={`shell-fleet__beacon is-${fleet.worst}`} aria-hidden />
            <span className="shell-fleet__summary">{fleetSummary(fleet)}</span>
            <ul className="shell-fleet__apps" aria-label="App status">
              {fleet.apps.map((a) => (
                <li key={a.slug}>
                  <Link
                    to={`/app/${a.slug}`}
                    className={`shell-chip is-${a.state}`}
                    title={`${a.label}: ${a.detail}`}
                  >
                    <span className="shell-chip__led" aria-hidden />
                    <span className="shell-chip__name">{a.label}</span>
                    <span className="shell-chip__ms">
                      {a.latencyMs == null ? "down" : `${a.latencyMs}ms`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="shell-clock">
            <span className="shell-clock__checked">{sinceLabel(fleet.updatedAt, now)}</span>
            <time
              className="shell-clock__utc"
              dateTime={now.toISOString()}
              title={now.toISOString().slice(0, 10) + " UTC"}
            >
              {utc}
              <span className="shell-clock__sec">:{pad(now.getUTCSeconds())}</span>
              <span className="shell-clock__zone">UTC</span>
            </time>
            {offset && (
              <span className="shell-clock__local" title={`Local time (${offset})`}>
                {local} <span className="shell-clock__zone">local</span>
              </span>
            )}
          </div>
        </header>
        <main className="shell-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

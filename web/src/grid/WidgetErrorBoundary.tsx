import { Component, type ErrorInfo, type ReactNode } from "react";
import WidgetFrame from "./WidgetFrame";

type Props = {
  kind: string;
  onRemove?: () => void;
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export default class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (typeof console !== "undefined") {
      console.error("[widget]", this.props.kind, error, info);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <WidgetFrame
          title={this.props.kind}
          onRemove={this.props.onRemove}
          error={this.state.error.message || "render error"}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: 4,
              color: "var(--muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <div style={{ color: "var(--bad, #d54a4a)" }}>
              widget crashed
            </div>
            <div style={{ wordBreak: "break-word" }}>
              {this.state.error.message || String(this.state.error)}
            </div>
            <button
              type="button"
              onClick={this.reset}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                alignSelf: "flex-start",
                padding: "4px 10px",
                fontSize: 11,
              }}
            >
              retry
            </button>
          </div>
        </WidgetFrame>
      );
    }
    return this.props.children;
  }
}

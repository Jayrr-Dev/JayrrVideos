import * as Sentry from "@sentry/browser";
import React from "react";

const GITHUB_NEW_ISSUE_URL =
  "https://github.com/Jayrr-Dev/JayrrVideos/issues/new";

interface TopErrorBoundaryProps {
  children: React.ReactNode;
  compact?: boolean;
}

interface TopErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  stack: string;
  componentStack: string;
  sentryEventId: string;
  localStorage: string;
  copyStatus: "idle" | "copied" | "failed";
  issuePrompt: "idle" | "confirming";
}

const buildErrorReport = (state: TopErrorBoundaryState) => {
  const gitSha =
    typeof window !== "undefined" ? window.__EXCALIDRAW_SHA__ ?? "" : "";
  return [
    `Error: ${state.errorMessage}`,
    state.stack ? `Stack:\n${state.stack}` : "",
    state.componentStack ? `Component stack:\n${state.componentStack}` : "",
    `URL: ${typeof window !== "undefined" ? window.location.href : ""}`,
    `User agent: ${
      typeof navigator !== "undefined" ? navigator.userAgent : ""
    }`,
    `Git SHA: ${gitSha || "unknown"}`,
    `Sentry: ${state.sentryEventId || "none"}`,
  ]
    .filter((part) => part.length > 0)
    .join("\n\n");
};

export class TopErrorBoundary extends React.Component<
  TopErrorBoundaryProps,
  TopErrorBoundaryState
> {
  state: TopErrorBoundaryState = {
    hasError: false,
    errorMessage: "",
    stack: "",
    componentStack: "",
    sentryEventId: "",
    localStorage: "",
    copyStatus: "idle",
    issuePrompt: "idle",
  };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack ?? "" : "",
      copyStatus: "idle" as const,
      issuePrompt: "idle" as const,
    };
  }

  render() {
    if (this.state.hasError) {
      return this.errorSplash();
    }
    return this.props.children;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(error, errorInfo);
    const snapshot: Record<string, unknown> = {};
    try {
      // Widget failures must not copy the entire saved canvas into memory.
      for (const [key, value] of Object.entries(
        this.props.compact ? {} : { ...localStorage },
      )) {
        try {
          snapshot[key] = JSON.parse(value);
        } catch {
          snapshot[key] = value;
        }
      }
    } catch {
      // private mode / blocked storage
    }

    Sentry.withScope((scope) => {
      scope.setExtras({ componentStack: errorInfo.componentStack });
      const eventId = Sentry.captureException(error);

      this.setState({
        hasError: true,
        errorMessage: error.message,
        stack: error.stack ?? "",
        componentStack: errorInfo.componentStack ?? "",
        sentryEventId: eventId,
        localStorage: JSON.stringify(snapshot),
        issuePrompt: "idle",
      });
    });
  }

  private selectTextArea(event: React.MouseEvent<HTMLTextAreaElement>) {
    if (event.target !== document.activeElement) {
      event.preventDefault();
      (event.target as HTMLTextAreaElement).select();
    }
  }

  private async copyReport() {
    const report = buildErrorReport(this.state);
    try {
      await navigator.clipboard.writeText(report);
      this.setState({ copyStatus: "copied" });
    } catch {
      this.setState({ copyStatus: "failed" });
    }
  }

  private async createGithubIssue() {
    let body = "";
    try {
      const templateStrFn = (
        await import(
          /* webpackChunkName: "bug-issue-template" */ "../bug-issue-template"
        )
      ).default;
      body = encodeURIComponent(
        templateStrFn({
          sentryErrorId: this.state.sentryEventId,
          errorMessage: this.state.errorMessage,
          stack: this.state.stack,
          componentStack: this.state.componentStack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          gitSha: window.__EXCALIDRAW_SHA__ ?? "",
        }),
      );
    } catch (error) {
      console.error(error);
    }

    const title = encodeURIComponent(
      this.state.errorMessage
        ? `Crash: ${this.state.errorMessage.slice(0, 80)}`
        : "Crash: unexpected error",
    );

    window.open(
      `${GITHUB_NEW_ISSUE_URL}?title=${title}&body=${body}`,
      "_blank",
      "noopener noreferrer",
    );
    this.setState({ issuePrompt: "idle" });
  }

  private copyLabel() {
    if (this.state.copyStatus === "copied") {
      return "Copied";
    }
    if (this.state.copyStatus === "failed") {
      return "Copy failed";
    }
    return "Copy error";
  }

  private errorSplash() {
    const compact = Boolean(this.props.compact);

    return (
      <div className={`ErrorSplash excalidraw${compact ? " is-compact" : ""}`}>
        <div className="ErrorSplash-messageContainer">
          <div className="ErrorSplash-paragraph bigger align-center">
            {this.state.errorMessage || "Encountered an error."} Try{" "}
            <button type="button" onClick={() => window.location.reload()}>
              reloading the page
            </button>
            .
          </div>
          {compact ? null : (
            <div className="ErrorSplash-paragraph align-center">
              If reloading doesn't work, try{" "}
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.clear();
                    window.location.reload();
                  } catch (error) {
                    console.error(error);
                  }
                }}
              >
                clearing the canvas
              </button>
              .
              <br />
              <div className="smaller">
                This will track a local-only scene. Your work will not be saved.
              </div>
            </div>
          )}
          <div className="ErrorSplash-paragraph align-center">
            <button type="button" onClick={() => void this.copyReport()}>
              {this.copyLabel()}
            </button>{" "}
            {this.state.issuePrompt === "confirming" ? (
              <>
                Open a GitHub issue with this error?
                <br />
                <button
                  type="button"
                  onClick={() => void this.createGithubIssue()}
                >
                  Confirm
                </button>{" "}
                <button
                  type="button"
                  onClick={() => this.setState({ issuePrompt: "idle" })}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => this.setState({ issuePrompt: "confirming" })}
              >
                Send to GitHub
              </button>
            )}
          </div>
          <div>
            {this.state.sentryEventId ? (
              <div className="ErrorSplash-paragraph">
                Error tracked. Event id: {this.state.sentryEventId}
              </div>
            ) : null}
            {compact ? null : (
              <div className="ErrorSplash-paragraph">
                <div className="ErrorSplash-details">
                  <label>Scene content</label>
                  <textarea
                    rows={5}
                    onPointerDown={this.selectTextArea}
                    readOnly={true}
                    value={this.state.localStorage}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

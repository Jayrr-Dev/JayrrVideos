import * as Sentry from "@sentry/browser";
import React from "react";

interface TopErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  sentryEventId: string;
  localStorage: string;
}

export class TopErrorBoundary extends React.Component<
  any,
  TopErrorBoundaryState
> {
  state: TopErrorBoundaryState = {
    hasError: false,
    errorMessage: "",
    sentryEventId: "",
    localStorage: "",
  };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  render() {
    return this.state.hasError ? this.errorSplash() : this.props.children;
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error(error, errorInfo);
    const _localStorage: any = {};
    for (const [key, value] of Object.entries({ ...localStorage })) {
      try {
        _localStorage[key] = JSON.parse(value);
      } catch (parseError: any) {
        _localStorage[key] = value;
      }
    }

    Sentry.withScope((scope) => {
      scope.setExtras(errorInfo);
      const eventId = Sentry.captureException(error);

      this.setState((state) => ({
        hasError: true,
        errorMessage: error.message,
        sentryEventId: eventId,
        localStorage: JSON.stringify(_localStorage),
      }));
    });
  }

  private selectTextArea(event: React.MouseEvent<HTMLTextAreaElement>) {
    if (event.target !== document.activeElement) {
      event.preventDefault();
      (event.target as HTMLTextAreaElement).select();
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
      body = encodeURIComponent(templateStrFn(this.state.sentryEventId));
    } catch (error: any) {
      console.error(error);
    }

    window.open(
      `https://github.com/excalidraw/excalidraw/issues/new?body=${body}`,
      "_blank",
      "noopener noreferrer",
    );
  }

  private errorSplash() {
    return (
      <div className="ErrorSplash excalidraw">
        <div className="ErrorSplash-messageContainer">
          <div className="ErrorSplash-paragraph bigger align-center">
            {this.state.errorMessage || "Encountered an error."} Try{" "}
            <button onClick={() => window.location.reload()}>
              reloading the page
            </button>
            .
          </div>
          <div className="ErrorSplash-paragraph align-center">
            If reloading doesn't work, try{" "}
            <button
              onClick={() => {
                try {
                  localStorage.clear();
                  window.location.reload();
                } catch (error: any) {
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
          <div>
            <div className="ErrorSplash-paragraph">
              Error tracked. Event id: {this.state.sentryEventId}
            </div>
            <div className="ErrorSplash-paragraph">
              Please open an issue on{" "}
              <button onClick={() => this.createGithubIssue()}>GitHub</button>.
            </div>
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
          </div>
        </div>
      </div>
    );
  }
}

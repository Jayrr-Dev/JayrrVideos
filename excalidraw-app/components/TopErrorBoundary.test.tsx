import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TopErrorBoundary } from "./TopErrorBoundary";

vi.mock("@sentry/browser", () => ({
  withScope: (run: (scope: { setExtras: () => void }) => void) =>
    run({ setExtras: () => {} }),
  captureException: () => "test-event",
}));

const BrokenWidget = () => {
  throw new Error("Cannot read properties of undefined (reading 'emotion')");
};

afterEach(() => vi.restoreAllMocks());

describe("compact widget error boundary", () => {
  it("keeps the rest of the canvas mounted without reading saved scene storage", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const storage = vi.spyOn(window, "localStorage", "get");
    render(
      <>
        <div>Working canvas</div>
        <TopErrorBoundary compact>
          <BrokenWidget />
        </TopErrorBoundary>
      </>,
    );
    expect(screen.getByText("Working canvas")).toBeTruthy();
    expect(
      screen.getByText(/Cannot read properties of undefined/),
    ).toBeTruthy();
    expect(storage).not.toHaveBeenCalled();
    expect(screen.queryByText("clearing the canvas")).toBeNull();
  });
});

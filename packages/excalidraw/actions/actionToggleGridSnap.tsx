import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

export const actionToggleGridSnap = register({
  name: "gridSnap",
  label: "labels.gridSnap",
  viewMode: false,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.gridSnapEnabled,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        gridSnapEnabled: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.gridSnapEnabled,
  predicate: (elements, appState, appProps) => {
    return (
      typeof appProps.gridModeEnabled === "undefined" &&
      appState.gridModeEnabled
    );
  },
});

import { CODES, KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { gridIcon } from "../components/icons";

import { register } from "./register";

export const actionToggleGridMode = register({
  name: "gridMode",
  icon: gridIcon,
  keywords: ["snap"],
  label: "labels.toggleGrid",
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => appState.gridModeEnabled,
  },
  perform(elements, appState) {
    const gridModeEnabled = !this.checked!(appState);
    return {
      appState: {
        ...appState,
        gridModeEnabled,
        // Turning the grid on defaults snap-to-grid on; turning off keeps preference.
        ...(gridModeEnabled ? { gridSnapEnabled: true } : {}),
        objectsSnapModeEnabled: false,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.gridModeEnabled,
  predicate: (element, appState, props) => {
    return props.gridModeEnabled === undefined;
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.code === CODES.QUOTE,
});

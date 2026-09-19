import { Footer } from "@excalidraw/excalidraw/index";
import React from "react";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";

export const AppFooter = React.memo(
  ({ onChange }: { onChange: () => void }) => {
    if (!isVisualDebuggerEnabled()) {
      return null;
    }

    return (
      <Footer>
        <DebugFooter onChange={onChange} />
      </Footer>
    );
  },
);

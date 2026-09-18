import { Footer, Sidebar } from "@excalidraw/excalidraw/index";
import { presentationIcon } from "@excalidraw/excalidraw/components/icons";
import React from "react";

import { JAYRR_PRESENT_SIDEBAR } from "../present/buildPresentDeck";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";

export const AppFooter = React.memo(
  ({ onChange }: { onChange: () => void }) => {
    return (
      <Footer>
        <div
          style={{
            display: "flex",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          {isVisualDebuggerEnabled() ? (
            <DebugFooter onChange={onChange} />
          ) : null}
          <Sidebar.Trigger
            name={JAYRR_PRESENT_SIDEBAR}
            icon={presentationIcon}
            title="Present"
          >
            Present
          </Sidebar.Trigger>
        </div>
      </Footer>
    );
  },
);

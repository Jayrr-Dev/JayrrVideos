import { useConvexAuth } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import "../excalidraw-app/sentry";

import ExcalidrawApp from "./App";
import { JayrrAuthenticatedApp } from "./components/JayrrAuthenticatedApp";
import { JayrrAuthPage } from "./components/ui";
import { JayrrConvexProvider, convexClient } from "./convexClient";

import "./components/ui/JayrrAuthPage.scss";

const JayrrRoot = () => {
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isLoading) {
    return <div className="jayrr-auth">Loading…</div>;
  }
  if (!isAuthenticated) {
    return <JayrrAuthPage />;
  }
  return <JayrrAuthenticatedApp />;
};

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
registerSW();
root.render(
  <StrictMode>
    <JayrrConvexProvider>
      {convexClient ? <JayrrRoot /> : <ExcalidrawApp />}
    </JayrrConvexProvider>
  </StrictMode>,
);

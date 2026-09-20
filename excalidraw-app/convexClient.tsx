import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";

import { api } from "../convex/_generated/api";

import type { ReactNode } from "react";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
export const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

export { api };

export const isConvexLinked = Boolean(convexClient);

export const convexSiteUrl = convexUrl
  ? convexUrl.replace(/\.convex\.cloud$/, ".convex.site")
  : null;

export const JayrrConvexProvider = ({ children }: { children: ReactNode }) => {
  if (!convexClient) {
    return children;
  }

  return (
    <ConvexAuthProvider client={convexClient}>{children}</ConvexAuthProvider>
  );
};

import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";

import ExcalidrawApp from "../App";
import { api } from "../convexClient";

export const JayrrAuthenticatedApp = () => {
  const claimLegacyItems = useMutation(api.users.claimLegacyItems);
  const claimed = useRef(false);

  useEffect(() => {
    if (claimed.current) {
      return;
    }
    claimed.current = true;
    void claimLegacyItems();
  }, [claimLegacyItems]);

  return <ExcalidrawApp />;
};

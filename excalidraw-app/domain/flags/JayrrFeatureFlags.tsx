import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect } from "react";

import {
  checkIcon,
  emptyIcon,
  settingsIcon,
} from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";

import { useSetAtom } from "../../app-jotai";
import { api, isConvexLinked } from "../../convexClient";

import {
  CAMERA_CUTOUT_FLAG,
  CAMERA_CUTOUT_OPTIONS,
  cameraCutoutAtom,
  isCameraCutout,
  type CameraCutout,
} from "./cameraCutoutFlag";

const readCutout = (flags: { key: string; value: string }[] | undefined) => {
  const row = flags?.find((flag) => flag.key === CAMERA_CUTOUT_FLAG);
  if (!row) {
    return "off";
  }
  if (!isCameraCutout(row.value)) {
    return "off";
  }
  return row.value;
};

export const JayrrFeatureFlags = () => {
  const { isAuthenticated } = useConvexAuth();
  const setCutout = useSetAtom(cameraCutoutAtom);
  const flagArgs = isAuthenticated ? {} : "skip";
  const flags = useQuery(api.featureFlags.list, flagArgs);
  const setFlag = useMutation(api.featureFlags.set);
  const cutout = readCutout(flags);

  useEffect(() => {
    setCutout(cutout);
  }, [cutout, setCutout]);

  if (!isConvexLinked) {
    return null;
  }
  if (!isAuthenticated) {
    return null;
  }

  const onPick = (value: CameraCutout) => {
    setCutout(value);
    void setFlag({ key: CAMERA_CUTOUT_FLAG, value });
  };

  return (
    <MainMenu.Sub>
      <MainMenu.Sub.Trigger icon={settingsIcon}>
        Feature flag
      </MainMenu.Sub.Trigger>
      <MainMenu.Sub.Content>
        {CAMERA_CUTOUT_OPTIONS.map((option) => (
          <MainMenu.Item
            key={option.id}
            icon={option.id === cutout ? checkIcon : emptyIcon}
            aria-checked={option.id === cutout}
            onSelect={(event) => {
              event.preventDefault();
              onPick(option.id);
            }}
          >
            {option.label}
          </MainMenu.Item>
        ))}
      </MainMenu.Sub.Content>
    </MainMenu.Sub>
  );
};

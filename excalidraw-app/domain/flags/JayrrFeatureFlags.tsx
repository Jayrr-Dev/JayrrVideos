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
import {
  STT_PROVIDER_FLAG,
  STT_PROVIDER_OPTIONS,
  isSttProvider,
  sttProviderAtom,
  type SttProvider,
} from "./sttProviderFlag";

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

const readStt = (flags: { key: string; value: string }[] | undefined) => {
  const row = flags?.find((flag) => flag.key === STT_PROVIDER_FLAG);
  if (!row) {
    return "inworld";
  }
  if (!isSttProvider(row.value)) {
    return "inworld";
  }
  return row.value;
};

export const JayrrFeatureFlags = () => {
  const { isAuthenticated } = useConvexAuth();
  const setCutout = useSetAtom(cameraCutoutAtom);
  const setStt = useSetAtom(sttProviderAtom);
  const flagArgs = isAuthenticated ? {} : "skip";
  const flags = useQuery(api.featureFlags.list, flagArgs);
  const setFlag = useMutation(api.featureFlags.set);
  const cutout = readCutout(flags);
  const stt = readStt(flags);

  useEffect(() => {
    setCutout(cutout);
  }, [cutout, setCutout]);

  useEffect(() => {
    setStt(stt);
  }, [setStt, stt]);

  if (!isConvexLinked) {
    return null;
  }
  if (!isAuthenticated) {
    return null;
  }

  const onPickCutout = (value: CameraCutout) => {
    setCutout(value);
    void setFlag({ key: CAMERA_CUTOUT_FLAG, value });
  };

  const onPickStt = (value: SttProvider) => {
    setStt(value);
    void setFlag({ key: STT_PROVIDER_FLAG, value });
  };

  return (
    <MainMenu.Sub>
      <MainMenu.Sub.Trigger icon={settingsIcon}>
        Feature flag
      </MainMenu.Sub.Trigger>
      <MainMenu.Sub.Content>
        <MainMenu.Group title="Camera cutout">
          {CAMERA_CUTOUT_OPTIONS.map((option) => (
            <MainMenu.Item
              key={option.id}
              icon={option.id === cutout ? checkIcon : emptyIcon}
              aria-checked={option.id === cutout}
              onSelect={(event) => {
                event.preventDefault();
                onPickCutout(option.id);
              }}
            >
              {option.label}
            </MainMenu.Item>
          ))}
        </MainMenu.Group>
        <MainMenu.Separator />
        <MainMenu.Group title="Speech">
          {STT_PROVIDER_OPTIONS.map((option) => (
            <MainMenu.Item
              key={option.id}
              icon={option.id === stt ? checkIcon : emptyIcon}
              aria-checked={option.id === stt}
              onSelect={(event) => {
                event.preventDefault();
                onPickStt(option.id);
              }}
            >
              {option.label}
            </MainMenu.Item>
          ))}
        </MainMenu.Group>
      </MainMenu.Sub.Content>
    </MainMenu.Sub>
  );
};

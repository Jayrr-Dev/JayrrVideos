import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect } from "react";

import { MainMenu } from "@excalidraw/excalidraw/index";

import { useSetAtom } from "../../app-jotai";
import { api, isConvexLinked } from "../../convexClient";

import {
  CAMERA_CUTOUT_FLAG,
  CAMERA_CUTOUT_OPTIONS,
  cameraCutoutAtom,
  isCameraCutout,
  type CameraCutout,
} from "./jayrrFeatureFlags";

import "./JayrrFeatureFlags.scss";

const readCutout = (flags: { key: string; value: string }[] | undefined) => {
  const row = flags?.find((flag) => flag.key === CAMERA_CUTOUT_FLAG);
  if (!row || !isCameraCutout(row.value)) {
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

  if (!isConvexLinked || !isAuthenticated) {
    return null;
  }

  const onPick = (value: CameraCutout) => {
    setCutout(value);
    void setFlag({ key: CAMERA_CUTOUT_FLAG, value });
  };

  return (
    <MainMenu.ItemCustom className="jayrr-feature-flags">
      <div className="jayrr-feature-flags__row">
        <span className="jayrr-feature-flags__label">Cutout</span>
        <div className="jayrr-feature-flags__pills" role="group" aria-label="Camera cutout">
          {CAMERA_CUTOUT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={
                option.id === cutout
                  ? "jayrr-feature-flags__pill is-active"
                  : "jayrr-feature-flags__pill"
              }
              aria-pressed={option.id === cutout}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onPick(option.id);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </MainMenu.ItemCustom>
  );
};

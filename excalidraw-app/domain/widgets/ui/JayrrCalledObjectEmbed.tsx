import { TranscribeWidget } from "../objects/TranscribeWidget";

import "./JayrrCalledObjectEmbed.scss";

import type { CalledObjectKind } from "../model";

export const JayrrCalledObjectEmbed = (_props: { kind: CalledObjectKind }) => {
  return <TranscribeWidget />;
};

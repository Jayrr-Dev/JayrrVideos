import clsx from "clsx";

import { IconButton } from "./IconButton";
import { timelineIcon } from "./icons";

type TimelineButtonProps = {
  title?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
  disabled?: boolean;
};

export const TimelineButton = (props: TimelineButtonProps) => {
  return (
    <IconButton
      className={clsx("ToolIcon__timeline", { "is-mobile": props.isMobile })}
      type="toggle"
      icon={timelineIcon}
      checked={props.checked}
      disabled={props.disabled}
      title={props.title}
      aria-label={`${props.title}`}
      data-testid="toolbar-timeline"
      onSelect={() => props.onChange?.()}
    />
  );
};

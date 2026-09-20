import clsx from "clsx";

import { IconButton } from "./IconButton";
import { searchIcon } from "./icons";

type SearchButtonProps = {
  title?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
  disabled?: boolean;
};

export const SearchButton = (props: SearchButtonProps) => {
  return (
    <IconButton
      className={clsx("ToolIcon__search", { "is-mobile": props.isMobile })}
      type="toggle"
      icon={searchIcon}
      checked={props.checked}
      disabled={props.disabled}
      title={props.title}
      aria-label={`${props.title}`}
      data-testid="toolbar-search"
      onSelect={() => props.onChange?.()}
    />
  );
};

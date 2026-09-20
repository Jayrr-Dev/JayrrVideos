import { Tabs as RadixTabs } from "radix-ui";

import type { SidebarTabName } from "../../types";

export const SidebarTab = ({
  tab,
  children,
  forceMount,
  ...rest
}: {
  tab: SidebarTabName;
  children: React.ReactNode;
  forceMount?: true;
} & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <RadixTabs.Content
      {...rest}
      value={tab}
      forceMount={forceMount}
      data-testid={tab}
    >
      {children}
    </RadixTabs.Content>
  );
};
SidebarTab.displayName = "SidebarTab";

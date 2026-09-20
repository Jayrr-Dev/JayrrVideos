import clsx from "clsx";
import { useEffect } from "react";

import {
  CANVAS_SEARCH_TAB,
  DEFAULT_SIDEBAR,
  LIBRARY_SIDEBAR_TAB,
  SCENE_SIDEBAR_TAB,
  composeEventHandlers,
} from "@excalidraw/common";

import type { MarkOptional, Merge } from "@excalidraw/common/utility-types";

import { useTunnels } from "../context/tunnels";
import { useUIAppState } from "../context/ui-appState";
import { t } from "../i18n";

import "../components/dropdownMenu/DropdownMenu.scss";

import { useAppProps, useExcalidrawSetAppState } from "./App";
import { LibraryMenu } from "./LibraryMenu";
import { SceneMenu } from "./SceneMenu";
import { SearchMenu } from "./SearchMenu";
import { Sidebar } from "./Sidebar/Sidebar";
import { withInternalFallback } from "./hoc/withInternalFallback";
import { LibraryIcon, SceneIcon } from "./icons";

import type { SidebarProps, SidebarTriggerProps } from "./Sidebar/common";

const DefaultSidebarTrigger = withInternalFallback(
  "DefaultSidebarTrigger",
  (
    props: Omit<SidebarTriggerProps, "name"> &
      React.HTMLAttributes<HTMLDivElement>,
  ) => {
    const { DefaultSidebarTriggerTunnel } = useTunnels();
    const appState = useUIAppState();
    return (
      <DefaultSidebarTriggerTunnel.In>
        <Sidebar.Trigger
          {...props}
          className="default-sidebar-trigger"
          name={DEFAULT_SIDEBAR.name}
          tab={appState.defaultSidebarTabPreference || props.tab}
        />
      </DefaultSidebarTriggerTunnel.In>
    );
  },
);
DefaultSidebarTrigger.displayName = "DefaultSidebarTrigger";

const DefaultTabTriggers = ({ children }: { children: React.ReactNode }) => {
  const { DefaultSidebarTabTriggersTunnel } = useTunnels();
  return (
    <DefaultSidebarTabTriggersTunnel.In>
      {children}
    </DefaultSidebarTabTriggersTunnel.In>
  );
};
DefaultTabTriggers.displayName = "DefaultTabTriggers";

const DefaultTrailingTabTriggers = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { DefaultSidebarTrailingTabTriggersTunnel } = useTunnels();
  return (
    <DefaultSidebarTrailingTabTriggersTunnel.In>
      {children}
    </DefaultSidebarTrailingTabTriggersTunnel.In>
  );
};
DefaultTrailingTabTriggers.displayName = "DefaultTrailingTabTriggers";

export const DefaultSidebar = Object.assign(
  withInternalFallback(
    "DefaultSidebar",
    ({
      children,
      className,
      onDock,
      docked,
      ...rest
    }: Merge<
      MarkOptional<Omit<SidebarProps, "name">, "children">,
      {
        /** pass `false` to disable docking */
        onDock?: SidebarProps["onDock"] | false;
      }
    >) => {
      const appState = useUIAppState();
      const setAppState = useExcalidrawSetAppState();
      const { renderLibraryMenu, renderSceneMenu } = useAppProps();

      const {
        DefaultSidebarTabTriggersTunnel,
        DefaultSidebarTrailingTabTriggersTunnel,
      } = useTunnels();

      const isForceDocked = appState.openSidebar?.tab === CANVAS_SEARCH_TAB;
      const openTab = appState.openSidebar?.tab;

      useEffect(() => {
        if (appState.openSidebar?.name !== DEFAULT_SIDEBAR.name) {
          return;
        }
        if (!openTab || openTab === CANVAS_SEARCH_TAB) {
          return;
        }
        if (openTab === appState.defaultSidebarTabPreference) {
          return;
        }
        setAppState({ defaultSidebarTabPreference: openTab });
      }, [
        appState.openSidebar?.name,
        openTab,
        appState.defaultSidebarTabPreference,
        setAppState,
      ]);

      return (
        <Sidebar
          {...rest}
          name="default"
          key="default"
          className={clsx("default-sidebar", className)}
          docked={
            isForceDocked || (docked ?? appState.defaultSidebarDockedPreference)
          }
          onDock={
            // `onDock=false` disables docking.
            // if `docked` passed, but no onDock passed, disable manual docking.
            isForceDocked || onDock === false || (!onDock && docked != null)
              ? undefined
              : // compose to allow the host app to listen on default behavior
                composeEventHandlers(onDock, (docked) => {
                  setAppState({ defaultSidebarDockedPreference: docked });
                })
          }
        >
          <Sidebar.Tabs>
            <Sidebar.Header>
              <Sidebar.TabTriggers>
                <DefaultSidebarTabTriggersTunnel.Out />
                <Sidebar.TabTrigger tab={LIBRARY_SIDEBAR_TAB}>
                  {LibraryIcon}
                </Sidebar.TabTrigger>
                <Sidebar.TabTrigger
                  tab={SCENE_SIDEBAR_TAB}
                  title={t("toolBar.scene")}
                  aria-label={t("toolBar.scene")}
                >
                  {SceneIcon}
                </Sidebar.TabTrigger>
                <DefaultSidebarTrailingTabTriggersTunnel.Out />
              </Sidebar.TabTriggers>
            </Sidebar.Header>
            <Sidebar.Tab tab={LIBRARY_SIDEBAR_TAB}>
              {renderLibraryMenu ? renderLibraryMenu() : <LibraryMenu />}
            </Sidebar.Tab>
            <Sidebar.Tab tab={SCENE_SIDEBAR_TAB}>
              {renderSceneMenu ? renderSceneMenu() : <SceneMenu />}
            </Sidebar.Tab>
            <Sidebar.Tab tab={CANVAS_SEARCH_TAB}>
              <SearchMenu />
            </Sidebar.Tab>
            {children}
          </Sidebar.Tabs>
        </Sidebar>
      );
    },
  ),
  {
    Trigger: DefaultSidebarTrigger,
    TabTriggers: DefaultTabTriggers,
    TrailingTabTriggers: DefaultTrailingTabTriggers,
  },
);

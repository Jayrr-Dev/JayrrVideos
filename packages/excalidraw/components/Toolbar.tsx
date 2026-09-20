import clsx from "clsx";
import { useState } from "react";

import { CANVAS_SEARCH_TAB, DEFAULT_SIDEBAR, KEYS } from "@excalidraw/common";

import { actionToggleSearchMenu } from "../actions";
import { t } from "../i18n";

import {
  useEditorInterface,
  useExcalidrawActionManager,
  useStylesPanelMode,
} from "./App";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import { HintViewer } from "./HintViewer";
import {
  bucketFillIcon,
  DotsIcon,
  drawShapeToolIcon,
  EmbedIcon,
  ImageIcon,
  laserPointerToolIcon,
  LassoIcon,
} from "./icons";
import { Island } from "./Island";
import { LockButton } from "./LockButton";
import { PenModeButton } from "./PenModeButton";
import { SearchButton } from "./SearchButton";
import Stack from "./Stack";
import {
  ArrowToolButton,
  DiamondToolButton,
  EllipseToolButton,
  EraserToolButton,
  FrameToolButton,
  FreedrawToolButton,
  FreedrawToolPopover,
  getToolShortcut,
  HandToolButton,
  isToolButtonDisabled,
  LassoToolButton,
  LineToolButton,
  RectangleToolButton,
  SelectionToolButton,
  SelectionToolPopover,
  StickyNoteToolButton,
  TextToolButton,
} from "./Tools";

import type {
  AppClassProperties,
  AppProps,
  AppState,
  UIAppState,
} from "../types";

const ExtraToolsDropdown = ({
  app,
  activeTool,
  setAppState,
  UIOptions,
}: {
  app: AppClassProperties;
  activeTool: UIAppState["activeTool"];
  setAppState: React.Component<any, AppState>["setState"];
  UIOptions: AppProps["UIOptions"];
}) => {
  const [isExtraToolsMenuOpen, setIsExtraToolsMenuOpen] = useState(false);
  const isFullStylesPanel = useStylesPanelMode() === "full";
  const imageToolSelected = activeTool.type === "image";
  const drawShapeToolSelected = activeTool.type === "autoshape";
  const laserToolSelected = activeTool.type === "laser";
  const bucketFillToolSelected = activeTool.type === "bucketfill";
  const lassoToolSelected =
    isFullStylesPanel &&
    activeTool.type === "lasso" &&
    app.state.preferredSelectionTool.type !== "lasso";
  const embeddableToolSelected = activeTool.type === "embeddable";

  return (
    <DropdownMenu open={isExtraToolsMenuOpen}>
      <DropdownMenu.Trigger
        className={clsx("App-toolbar__extra-tools-trigger", {
          "App-toolbar__extra-tools-trigger--selected":
            imageToolSelected ||
            embeddableToolSelected ||
            (isFullStylesPanel && drawShapeToolSelected) ||
            lassoToolSelected ||
            bucketFillToolSelected ||
            // in collab we're already highlighting the laser button
            // outside toolbar, so let's not highlight extra-tools button
            // on top of it
            (laserToolSelected && !app.props.isCollaborating),
        })}
        onToggle={() => {
          setIsExtraToolsMenuOpen(!isExtraToolsMenuOpen);
          setAppState({ openMenu: null, openPopup: null });
        }}
        title={t("toolBar.extraTools")}
      >
        {imageToolSelected
          ? ImageIcon
          : embeddableToolSelected
          ? EmbedIcon
          : isFullStylesPanel && drawShapeToolSelected
          ? drawShapeToolIcon
          : laserToolSelected && !app.props.isCollaborating
          ? laserPointerToolIcon
          : lassoToolSelected
          ? LassoIcon
          : bucketFillToolSelected
          ? bucketFillIcon
          : DotsIcon}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        onClickOutside={() => setIsExtraToolsMenuOpen(false)}
        onSelect={() => setIsExtraToolsMenuOpen(false)}
        className="App-toolbar__extra-tools-dropdown"
      >
        {UIOptions.tools?.image !== false && (
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "image" })}
            icon={ImageIcon}
            shortcut={KEYS["9"]}
            data-testid="toolbar-image"
            selected={imageToolSelected}
            disabled={isToolButtonDisabled(app, "image")}
          >
            {t("toolBar.image")}
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Item
          onSelect={() => app.setActiveTool({ type: "embeddable" })}
          icon={EmbedIcon}
          data-testid="toolbar-embeddable"
          selected={embeddableToolSelected}
          disabled={isToolButtonDisabled(app, "embeddable")}
        >
          {t("toolBar.embeddable")}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={() => app.setActiveTool({ type: "autoshape" })}
          icon={drawShapeToolIcon}
          shortcut={getToolShortcut("autoshape")}
          data-testid="toolbar-autoshape"
          selected={drawShapeToolSelected}
          disabled={isToolButtonDisabled(app, "autoshape")}
        >
          {t("toolBar.autoshape")}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={() => app.setActiveTool({ type: "laser" })}
          icon={laserPointerToolIcon}
          data-testid="toolbar-laser"
          selected={laserToolSelected}
          shortcut={KEYS.K.toLocaleUpperCase()}
          disabled={isToolButtonDisabled(app, "laser")}
        >
          {t("toolBar.laser")}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={() => app.setActiveTool({ type: "bucketfill" })}
          icon={bucketFillIcon}
          data-testid="toolbar-bucketfill"
          selected={bucketFillToolSelected}
          shortcut={KEYS.B.toLocaleUpperCase()}
          disabled={isToolButtonDisabled(app, "bucketfill")}
        >
          {t("toolBar.bucketfill")}
        </DropdownMenu.Item>
        {isFullStylesPanel && (
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "lasso" })}
            icon={LassoIcon}
            data-testid="toolbar-lasso"
            selected={lassoToolSelected}
            disabled={isToolButtonDisabled(app, "lasso")}
          >
            {t("toolBar.lasso")}
          </DropdownMenu.Item>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};

/** the main (desktop/tablet) toolbar island */
export const Toolbar = ({
  app,
  appState,
  setAppState,
  UIOptions,
  onPenModeToggle,
  onLockToggle,
  heading,
}: {
  app: AppClassProperties;
  appState: UIAppState;
  setAppState: React.Component<any, AppState>["setState"];
  UIOptions: AppProps["UIOptions"];
  onPenModeToggle: AppClassProperties["togglePenMode"];
  onLockToggle: () => void;
  heading: React.ReactNode;
}) => {
  const editorInterface = useEditorInterface();
  const isCompactStylesPanel = useStylesPanelMode() === "compact";
  const actionManager = useExcalidrawActionManager();

  const activeTool = appState.activeTool;
  const toolProps = { app, activeTool };
  const searchOpen =
    appState.openSidebar?.name === DEFAULT_SIDEBAR.name &&
    appState.openSidebar.tab === CANVAS_SEARCH_TAB;

  return (
    <Island
      padding={1}
      className={clsx("App-toolbar", {
        "zen-mode": appState.zenModeEnabled,
        "App-toolbar--compact": isCompactStylesPanel,
      })}
      data-viewport-ui="top"
    >
      <HintViewer
        appState={appState}
        isMobile={editorInterface.formFactor === "phone"}
        editorInterface={editorInterface}
        app={app}
      />
      {heading}
      <Stack.Row gap={isCompactStylesPanel ? 0.5 : 1}>
        {/* in compact UI the pen mode button is rendered as a separate
            floating button below the compact actions menu */}
        {!isCompactStylesPanel && (
          <PenModeButton
            checked={appState.penMode}
            onChange={() => onPenModeToggle(null)}
            title={t("toolBar.penMode")}
            penDetected={appState.penDetected}
          />
        )}
        {app.props.activeTool == null && (
          <>
            <LockButton
              checked={appState.activeTool.locked}
              onChange={onLockToggle}
              title={t("toolBar.lock")}
              // the active tool — including its lock state — is host-controlled
              disabled={app.props.activeTool != null}
            />
            <SearchButton
              checked={searchOpen}
              onChange={() =>
                actionManager.executeAction(actionToggleSearchMenu)
              }
              title={t("search.title")}
            />

            <div
              className="App-toolbar__divider"
              style={{ marginRight: "0.25rem" }}
            />
          </>
        )}

        <HandToolButton {...toolProps} hideKeyBinding />
        <FrameToolButton {...toolProps} />
        {isCompactStylesPanel ? (
          <SelectionToolPopover {...toolProps} setAppState={setAppState} />
        ) : appState.preferredSelectionTool.type === "lasso" ? (
          <LassoToolButton {...toolProps} />
        ) : (
          <SelectionToolButton {...toolProps} />
        )}
        <RectangleToolButton {...toolProps} />
        <DiamondToolButton {...toolProps} />
        <EllipseToolButton {...toolProps} />
        <ArrowToolButton {...toolProps} />
        <LineToolButton {...toolProps} />
        {isCompactStylesPanel ? (
          <FreedrawToolPopover {...toolProps} />
        ) : (
          <FreedrawToolButton {...toolProps} />
        )}
        <TextToolButton {...toolProps} />
        <StickyNoteToolButton {...toolProps} />
        <EraserToolButton {...toolProps} />

        <div
          className="App-toolbar__divider"
          style={{ marginLeft: "0.25rem" }}
        />

        <ExtraToolsDropdown
          app={app}
          activeTool={activeTool}
          setAppState={setAppState}
          UIOptions={UIOptions}
        />
      </Stack.Row>
    </Island>
  );
};

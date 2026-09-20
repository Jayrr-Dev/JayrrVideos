import { useAuthActions } from "@convex-dev/auth/react";
import {
  eyeIcon,
  LinkIcon,
  playerPlayIcon,
  presentationIcon,
  SceneIcon,
  usersIcon,
} from "@excalidraw/excalidraw/components/icons";
import { MainMenu, useExcalidrawAPI } from "@excalidraw/excalidraw/index";
import React, { useState } from "react";

import {
  DEFAULT_SIDEBAR,
  isDevEnv,
  SCENE_SIDEBAR_TAB,
} from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { useAtomValue } from "../app-jotai";
import { LanguageList } from "../app-language/LanguageList";
import { isConvexLinked } from "../convexClient";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  googleDriveConnectedAtom,
  isGoogleDriveConfigured,
} from "../data/connectGoogleDrive";
import { saveCanvasAsScene } from "../data/jayrrScenes";
import { JayrrFeatureFlags } from "../domain/flags/JayrrFeatureFlags";
import { JAYRR_PRESENT_TAB } from "../present/buildPresentDeck";

import { saveDebugState } from "./DebugCanvas";
import { JayrrSoundLibraryDialog } from "./ui";

const SignOutMenuItem = () => {
  const { signOut } = useAuthActions();
  return (
    <MainMenu.Item
      icon={usersIcon}
      onSelect={() => {
        void signOut();
      }}
    >
      Sign out
    </MainMenu.Item>
  );
};

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  refresh: () => void;
  onToast: (message: string) => void;
}> = React.memo((props) => {
  const driveConnected = useAtomValue(googleDriveConnectedAtom);
  const [driveBusy, setDriveBusy] = useState(false);
  const [soundLibraryOpen, setSoundLibraryOpen] = useState(false);
  const excalidrawAPI = useExcalidrawAPI();
  let driveLabel = "Connect Google Drive";
  if (driveBusy) {
    driveLabel = "Google Drive…";
  } else if (driveConnected) {
    driveLabel = "Disconnect Google Drive";
  }

  const onDriveSelect = async () => {
    if (driveBusy) {
      return;
    }

    if (!isGoogleDriveConfigured()) {
      props.onToast(
        "Add VITE_APP_GOOGLE_CLIENT_ID in .env.development.local, then restart yarn start.",
      );
      return;
    }

    setDriveBusy(true);
    try {
      if (driveConnected) {
        await disconnectGoogleDrive();
        props.onToast(
          "Google Drive disconnected. New big files stay in this browser.",
        );
        props.refresh();
        return;
      }

      await connectGoogleDrive();
      props.onToast(
        "Google Drive connected. Files over 512KB save to the JayrrVideos folder.",
      );
      props.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Google Drive sign-in failed.";
      props.onToast(message);
    } finally {
      setDriveBusy(false);
    }
  };

  return (
    <>
      <MainMenu>
        <MainMenu.DefaultItems.LoadScene />
        <MainMenu.Item
          icon={SceneIcon}
          onSelect={() => {
            if (!excalidrawAPI) {
              return;
            }
            if (!isConvexLinked) {
              props.onToast("Add VITE_CONVEX_URL, then restart the app.");
              return;
            }
            const name = window.prompt("Scene name", "Scene");
            if (!name) {
              return;
            }
            void saveCanvasAsScene(excalidrawAPI, name)
              .then(() => {
                props.onToast(`Saved "${name.trim()}" as a scene`);
                excalidrawAPI.updateScene({
                  appState: {
                    openSidebar: {
                      name: DEFAULT_SIDEBAR.name,
                      tab: SCENE_SIDEBAR_TAB,
                    },
                  },
                });
              })
              .catch((error: unknown) => {
                props.onToast(
                  error instanceof Error
                    ? error.message
                    : "Could not save scene",
                );
              });
          }}
        >
          Save as Scene
        </MainMenu.Item>
        <MainMenu.DefaultItems.SaveToActiveFile />
        <MainMenu.DefaultItems.Export />
        <MainMenu.DefaultItems.SaveAsImage />
        <MainMenu.DefaultItems.CommandPalette className="highlighted" />
        <MainMenu.DefaultItems.SearchMenu />
        <MainMenu.Item
          icon={presentationIcon}
          onSelect={() => {
            excalidrawAPI?.updateScene({
              appState: {
                openSidebar: {
                  name: DEFAULT_SIDEBAR.name,
                  tab: JAYRR_PRESENT_TAB,
                },
              },
            });
          }}
        >
          Present
        </MainMenu.Item>
        <MainMenu.Item
          icon={playerPlayIcon}
          onSelect={() => {
            setSoundLibraryOpen(true);
          }}
        >
          Sound Library
        </MainMenu.Item>
        <MainMenu.DefaultItems.Help />
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.Separator />
        <MainMenu.Item
          icon={LinkIcon}
          onSelect={() => {
            void onDriveSelect();
          }}
          aria-label={driveLabel}
        >
          {driveLabel}
        </MainMenu.Item>
        <MainMenu.DefaultItems.Socials />
        {isDevEnv() && (
          <MainMenu.Item
            icon={eyeIcon}
            onSelect={() => {
              if (window.visualDebug) {
                delete window.visualDebug;
                saveDebugState({ enabled: false });
              } else {
                window.visualDebug = { data: [] };
                saveDebugState({ enabled: true });
              }
              props?.refresh();
            }}
          >
            Visual Debug
          </MainMenu.Item>
        )}
        <MainMenu.Separator />
        {isConvexLinked ? <SignOutMenuItem /> : null}
        {isConvexLinked ? <JayrrFeatureFlags /> : null}
        <MainMenu.DefaultItems.Preferences />
        <MainMenu.DefaultItems.ToggleTheme
          allowSystemTheme
          theme={props.theme}
        />
        <MainMenu.ItemCustom>
          <LanguageList style={{ width: "100%" }} />
        </MainMenu.ItemCustom>
        <MainMenu.DefaultItems.ChangeCanvasBackground />
      </MainMenu>
      {soundLibraryOpen ? (
        <JayrrSoundLibraryDialog
          onClose={() => {
            setSoundLibraryOpen(false);
          }}
        />
      ) : null}
    </>
  );
});

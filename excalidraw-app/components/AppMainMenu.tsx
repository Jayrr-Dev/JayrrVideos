import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import {
  eyeIcon,
  LinkIcon,
  playerPlayIcon,
  presentationIcon,
  SceneIcon,
  usersIcon,
} from "@excalidraw/excalidraw/components/icons";
import { MainMenu, useExcalidrawAPI } from "@excalidraw/excalidraw/index";
import React from "react";

import {
  DEFAULT_SIDEBAR,
  LIBRARY_SIDEBAR_TAB,
  isDevEnv,
} from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { appJotaiStore, useAtomValue } from "../app-jotai";
import { collabAPIAtom } from "../collab/Collab";
import { LanguageList } from "../app-language/LanguageList";
import { api, isConvexLinked } from "../convexClient";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  googleDriveConnectedAtom,
  isGoogleDriveConfigured,
} from "../data/connectGoogleDrive";
import { openBlankCanvas, saveCanvasAsScene } from "../data/jayrrScenes";
import { JayrrFeatureFlags } from "../domain/flags/JayrrFeatureFlags";
import { JAYRR_PRESENT_TAB } from "../present/buildPresentDeck";
import { docsViewAtom, persistDocsView } from "../present/docsView";
import { setAccountCollabIdentity } from "../domain/profile/accountCollabIdentity";

import { saveDebugState } from "./DebugCanvas";
import { JayrrProfileDialog, JayrrSoundLibraryDialog } from "./ui";

const JayrrProfileSync = () => {
  const { isAuthenticated } = useConvexAuth();
  const collabAPI = useAtomValue(collabAPIAtom);
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");

  useEffect(() => {
    if (!viewer) {
      return;
    }
    const name = viewer.name?.trim() ?? "";
    const image = viewer.image ?? "";
    setAccountCollabIdentity(name || null, image || null);
    if (!collabAPI) {
      return;
    }
    if (name && collabAPI.getUsername() !== name) {
      collabAPI.setUsername(name);
    }
    if (collabAPI.getAvatarUrl() !== image) {
      collabAPI.setAvatarUrl(image);
    }
  }, [collabAPI, viewer]);

  return null;
};

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
  const [profileOpen, setProfileOpen] = useState(false);
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
      {isConvexLinked ? <JayrrProfileSync /> : null}
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
                openBlankCanvas(excalidrawAPI);
                props.onToast(`Saved "${name.trim()}" as a scene`);
                persistDocsView("scene");
                appJotaiStore.set(docsViewAtom, "scene");
                excalidrawAPI.updateScene({
                  appState: {
                    openSidebar: {
                      name: DEFAULT_SIDEBAR.name,
                      tab: LIBRARY_SIDEBAR_TAB,
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
        {props.isCollabEnabled ? (
          <MainMenu.DefaultItems.LiveCollaborationTrigger
            isCollaborating={props.isCollaborating}
            onSelect={props.onCollabDialogOpen}
          />
        ) : null}
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
        {isConvexLinked ? (
          <MainMenu.Item
            icon={usersIcon}
            onSelect={() => {
              setProfileOpen(true);
            }}
          >
            Profile
          </MainMenu.Item>
        ) : null}
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
      {profileOpen ? (
        <JayrrProfileDialog
          onClose={() => {
            setProfileOpen(false);
          }}
        />
      ) : null}
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

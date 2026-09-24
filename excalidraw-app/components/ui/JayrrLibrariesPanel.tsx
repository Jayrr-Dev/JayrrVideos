import { useAtom } from "../../app-jotai";
import { JayrrEditorProjectsPanel } from "../../domain/editor/JayrrEditorProjectsPanel";
import {
  librariesViewAtom,
  persistLibrariesView,
  recordingsUploadingAtom,
  type LibrariesView,
} from "../../present/docsView";
import { JayrrPresentRecordingsPanel } from "../../present/JayrrPresentRecordingsPanel";

import { JayrrLibraryMenu } from "./JayrrLibraryMenu";
import { JayrrSceneMenu } from "./JayrrSceneMenu";
import { LibrariesShell } from "./librariesChrome";
import "./JayrrLibraryMenu.scss";

const LIBRARY_TABS: { id: LibrariesView; label: string }[] = [
  { id: "record", label: "Record" },
  { id: "project", label: "Project" },
  { id: "scene", label: "Scene" },
  { id: "parts", label: "Parts" },
];

export const JayrrLibrariesPanel = () => {
  const [view, setView] = useAtom(librariesViewAtom);
  const [uploading] = useAtom(recordingsUploadingAtom);

  const selectView = (next: LibrariesView) => {
    setView(next);
    persistLibrariesView(next);
  };

  let body = <JayrrPresentRecordingsPanel uploading={uploading} />;
  if (view === "project") {
    body = <JayrrEditorProjectsPanel />;
  } else if (view === "scene") {
    body = <JayrrSceneMenu />;
  } else if (view === "parts") {
    body = <JayrrLibraryMenu />;
  }

  return (
    <LibrariesShell
      views={
        <div
          className="jayrr-libraries__views"
          role="group"
          aria-label="Libraries view"
        >
          {LIBRARY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`jayrr-libraries__view-btn${
                view === tab.id ? " is-active" : ""
              }`}
              aria-pressed={view === tab.id}
              onClick={() => selectView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      }
    >
      {body}
    </LibrariesShell>
  );
};

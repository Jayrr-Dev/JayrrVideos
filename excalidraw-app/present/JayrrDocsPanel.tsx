import { useAtom } from "../app-jotai";

import { JayrrEditorProjectsPanel } from "../domain/editor/JayrrEditorProjectsPanel";

import { JayrrPresentRecordingsPanel } from "./JayrrPresentRecordingsPanel";
import { docsViewAtom, persistDocsView, type DocsView } from "./docsView";

const DocsViewToggle = ({
  view,
  onChange,
}: {
  view: DocsView;
  onChange: (view: DocsView) => void;
}) => {
  return (
    <div className="jayrr-docs__views" role="group" aria-label="Docs view">
      <button
        type="button"
        className={`jayrr-docs__view-btn${
          view === "record" ? " is-active" : ""
        }`}
        aria-pressed={view === "record"}
        onClick={() => onChange("record")}
      >
        Record
      </button>
      <button
        type="button"
        className={`jayrr-docs__view-btn${
          view === "project" ? " is-active" : ""
        }`}
        aria-pressed={view === "project"}
        onClick={() => onChange("project")}
      >
        Project
      </button>
    </div>
  );
};

export const JayrrDocsPanel = ({ uploading }: { uploading: boolean }) => {
  const [view, setView] = useAtom(docsViewAtom);
  const toolbar = (
    <DocsViewToggle
      view={view}
      onChange={(next) => {
        setView(next);
        persistDocsView(next);
      }}
    />
  );

  if (view === "project") {
    return <JayrrEditorProjectsPanel toolbar={toolbar} />;
  }

  return (
    <JayrrPresentRecordingsPanel uploading={uploading} toolbar={toolbar} />
  );
};

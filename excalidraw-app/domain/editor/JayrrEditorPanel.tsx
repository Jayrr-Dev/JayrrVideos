import "../../components/ui/JayrrLibraryMenu.scss";

export const JAYRR_EDITOR_TAB = "jayrrEditor";

export const editorTabIcon = (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
    <path
      d="M5.2 3.4h6.4L14.8 6.6v9.8H5.2z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    <path
      d="M11.5 3.5v3.2h3.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    <path
      d="M7.2 11.1h5.6M7.2 13.7h3.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

export const JayrrEditorPanel = () => {
  return (
    <div className="layer-ui__library jayrr-library jayrr-editor-panel">
      <div className="jayrr-library__header">
        <div className="jayrr-library__title">Video editor</div>
      </div>
    </div>
  );
};

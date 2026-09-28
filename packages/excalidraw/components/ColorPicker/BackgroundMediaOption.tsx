import clsx from "clsx";
import { useRef } from "react";

import { t } from "../../i18n";

import PickerHeading from "./PickerHeading";

const ACCEPT =
  "image/*,video/mp4,video/webm,video/quicktime,image/gif,.gif,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov";

export const BackgroundMediaOption = ({
  active,
  onPickFile,
  onClear,
}: {
  active: boolean;
  onPickFile: (file: File) => void;
  onClear: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <PickerHeading>{t("colorPicker.media")}</PickerHeading>
      <div className="color-picker-content--default color-picker-content--media">
        <button
          type="button"
          tabIndex={-1}
          className={clsx("color-picker__button color-picker__button--large", {
            active,
            "is-transparent": !active,
            "is-bg-media": true,
          })}
          title={t("colorPicker.mediaHint")}
          aria-label={t("colorPicker.mediaHint")}
          aria-pressed={active}
          onClick={() => inputRef.current?.click()}
        >
          <span className="color-picker__media-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <rect
                x="1.5"
                y="3"
                width="13"
                height="10"
                rx="1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path
                d="M5.2 10.2 7.1 8.1l1.6 1.6 2.1-2.5 2.5 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <circle cx="5.2" cy="6.1" r="1.05" fill="currentColor" />
            </svg>
          </span>
        </button>
        {active ? (
          <button
            type="button"
            className="color-picker__media-clear"
            onClick={onClear}
          >
            {t("colorPicker.removeMedia")}
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            onPickFile(file);
          }
        }}
      />
    </div>
  );
};

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type LibrariesChromeSlots = {
  actionsEl: HTMLDivElement | null;
  titleEl: HTMLDivElement | null;
  backEl: HTMLSpanElement | null;
  setHasCustomTitle: (value: boolean) => void;
};

const LibrariesChromeContext = createContext<LibrariesChromeSlots | null>(null);

export const useLibrariesChrome = () => useContext(LibrariesChromeContext);

export const LibrariesShell = ({
  views,
  children,
}: {
  views: ReactNode;
  children: ReactNode;
}) => {
  const [actionsEl, setActionsEl] = useState<HTMLDivElement | null>(null);
  const [titleEl, setTitleEl] = useState<HTMLDivElement | null>(null);
  const [backEl, setBackEl] = useState<HTMLSpanElement | null>(null);
  const [hasCustomTitle, setHasCustomTitle] = useState(false);

  const slots = useMemo(
    () => ({
      actionsEl,
      titleEl,
      backEl,
      setHasCustomTitle,
    }),
    [actionsEl, titleEl, backEl],
  );

  return (
    <LibrariesChromeContext.Provider value={slots}>
      <div className="layer-ui__library jayrr-library">
        <div className="jayrr-library__header">
          <span className="jayrr-libraries__back" ref={setBackEl} />
          <div className="jayrr-libraries__title-slot" ref={setTitleEl}>
            {hasCustomTitle ? null : (
              <div className="jayrr-library__title">Libraries</div>
            )}
          </div>
          <div className="jayrr-library__header-actions" ref={setActionsEl} />
        </div>
        {views}
        <div className="jayrr-libraries__content">{children}</div>
      </div>
    </LibrariesChromeContext.Provider>
  );
};

const LibrariesChromePortals = ({
  actions,
  title,
  back,
}: {
  actions?: ReactNode;
  title?: ReactNode;
  back?: ReactNode;
}) => {
  const slots = useLibrariesChrome();
  const custom = title != null;

  useLayoutEffect(() => {
    slots?.setHasCustomTitle(custom);
    return () => {
      slots?.setHasCustomTitle(false);
    };
  }, [custom, slots]);

  if (!slots) {
    return null;
  }

  let backNode: ReactNode = null;
  if (slots.backEl) {
    if (back) {
      backNode = createPortal(back, slots.backEl);
    }
  }
  let titleNode: ReactNode = null;
  if (slots.titleEl) {
    if (title) {
      titleNode = createPortal(title, slots.titleEl);
    }
  }
  let actionsNode: ReactNode = null;
  if (slots.actionsEl) {
    if (actions) {
      actionsNode = createPortal(actions, slots.actionsEl);
    }
  }

  return (
    <>
      {backNode}
      {titleNode}
      {actionsNode}
    </>
  );
};

export const LibrariesPane = ({
  actions,
  title,
  back,
  className,
  fallbackTitle = "Libraries",
  children,
}: {
  actions?: ReactNode;
  title?: ReactNode;
  back?: ReactNode;
  className?: string;
  fallbackTitle?: string;
  children?: ReactNode;
}) => {
  const slots = useLibrariesChrome();
  if (!slots) {
    return (
      <div className="layer-ui__library jayrr-library">
        <div className="jayrr-library__header">
          {back}
          {title ?? <div className="jayrr-library__title">{fallbackTitle}</div>}
          {actions ? (
            <div className="jayrr-library__header-actions">{actions}</div>
          ) : null}
        </div>
        {children}
      </div>
    );
  }

  const paneClass = className
    ? `jayrr-libraries__pane ${className}`
    : "jayrr-libraries__pane";

  return (
    <div className={paneClass}>
      <LibrariesChromePortals actions={actions} title={title} back={back} />
      {children}
    </div>
  );
};

import clsx from "clsx";

export const LibraryMenuControlButtons = ({
  id,
  libraryReturnUrl,
  theme,
  style,
  children,
  className,
}: {
  id?: string;
  libraryReturnUrl?: string;
  theme?: string;
  style: React.CSSProperties;
  children?: React.ReactNode;
  className?: string;
}) => {
  void id;
  void libraryReturnUrl;
  void theme;

  return (
    <div
      className={clsx("library-menu-control-buttons", className)}
      style={style}
    >
      {children}
    </div>
  );
};

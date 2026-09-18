import "./ExcalidrawLogo.scss";

const LogoIcon = () => (
  <svg
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="ExcalidrawLogo-icon"
  >
    <rect
      x="3.4"
      y="4.2"
      width="33.2"
      height="31.6"
      rx="8"
      fill="#F5D000"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinejoin="round"
    />
    <path
      d="M15.2 12.4l14.4 7.4-14.6 8.2z"
      fill="#111"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
  </svg>
);

const LogoText = () => <span className="ExcalidrawLogo-text">JayrrVideos</span>;

type LogoSize = "xs" | "small" | "normal" | "large" | "custom" | "mobile";

interface LogoProps {
  size?: LogoSize;
  withText?: boolean;
  style?: React.CSSProperties;
  isNotLink?: boolean;
}

export const ExcalidrawLogo = ({
  style,
  size = "small",
  withText,
}: LogoProps) => {
  return (
    <div className={`ExcalidrawLogo is-${size}`} style={style}>
      <LogoIcon />
      {withText && <LogoText />}
    </div>
  );
};

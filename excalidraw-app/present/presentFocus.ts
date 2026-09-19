export const PRESENT_TRAP_CLASS = "jayrr-present-trap";

export const refocusPresentTrap = () => {
  const active = document.activeElement;
  if (active instanceof HTMLIFrameElement) {
    active.blur();
  }
  for (const iframe of document.querySelectorAll("iframe")) {
    iframe.tabIndex = -1;
    iframe.inert = true;
  }
  document
    .querySelector<HTMLElement>(`.${PRESENT_TRAP_CLASS}`)
    ?.focus({ preventScroll: true });
};

export const startPresentFocusGuard = () => {
  refocusPresentTrap();
  const id = window.setInterval(refocusPresentTrap, 350);
  return () => {
    window.clearInterval(id);
    for (const iframe of document.querySelectorAll("iframe")) {
      iframe.inert = false;
    }
  };
};

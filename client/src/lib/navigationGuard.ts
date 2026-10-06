type NavigationBlocker = (navigate: () => void) => void;

let activeBlocker: NavigationBlocker | null = null;

export function installNavigationBlocker(blocker: NavigationBlocker) {
  activeBlocker = blocker;
  return () => {
    if (activeBlocker === blocker) activeBlocker = null;
  };
}

export function runGuardedNavigation(navigate: () => void) {
  if (activeBlocker) activeBlocker(navigate);
  else navigate();
}
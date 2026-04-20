import { useCallback, useEffect, useState } from 'react';

// Intercepts browser back/forward navigation and refresh/close while a lesson
// is active. Back button opens a custom modal; refresh/close falls back to the
// browser's native "Leave site?" dialog (browsers intentionally disallow custom
// UI there).
export function useLessonExitGuard(active: boolean, onConfirmExit: () => void) {
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    if (!active) return;

    // Push a sentinel history entry so the next "back" fires popstate without
    // actually leaving the SPA.
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      setShowExitModal(true);
      // Re-trap so a second back press also lands on our modal.
      window.history.pushState(null, '', window.location.href);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [active]);

  const confirmExit = useCallback(() => {
    setShowExitModal(false);
    onConfirmExit();
  }, [onConfirmExit]);

  const cancelExit = useCallback(() => {
    setShowExitModal(false);
  }, []);

  return { showExitModal, confirmExit, cancelExit };
}

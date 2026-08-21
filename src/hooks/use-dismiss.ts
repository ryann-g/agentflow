"use client";

import { useEffect, type RefObject } from "react";

/**
 * Closes transient UI (dropdown menus, popovers) when the user clicks or
 * taps outside `ref`, presses Escape anywhere, or touches outside on mobile.
 *
 * Listeners attach only while `active` is true and are always removed on
 * cleanup, so closed menus cost nothing and open ones never leak handlers.
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  active: boolean
): void {
  useEffect(() => {
    if (!active) return;

    function isOutside(target: EventTarget | null): boolean {
      return (
        ref.current !== null &&
        target instanceof Node &&
        !ref.current.contains(target)
      );
    }

    function handlePointer(event: MouseEvent | TouchEvent): void {
      if (isOutside(event.target)) onDismiss();
    }

    function handleKeydown(event: KeyboardEvent): void {
      if (event.key === "Escape") onDismiss();
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [ref, onDismiss, active]);
}

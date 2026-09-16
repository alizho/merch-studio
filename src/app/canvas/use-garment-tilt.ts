import * as React from "react";

/** Transient presentation only: never writes artwork or camera state. */
export function useGarmentTilt(disabled: boolean) {
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const tiltRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const surface = surfaceRef.current;
    const tilt = tiltRef.current;
    if (!surface || !tilt) return;

    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const hover = matchMedia("(hover: hover) and (pointer: fine)");
    let frame = 0;
    let space = false;
    let point: { x: number; y: number } | null = null;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      point = null;
      tilt.style.transform = "rotateX(0deg) rotateY(0deg)";
    };
    const paint = () => {
      frame = 0;
      if (!point) return;
      // Measure the stationary parent, never the transformed hover target.
      const rect = surface.getBoundingClientRect();
      const x = (point.x - rect.left) / rect.width * 2 - 1;
      const y = (point.y - rect.top) / rect.height * 2 - 1;
      if (!rect.width || !rect.height || Math.abs(x) > 1.12 || Math.abs(y) > 1.12) {
        reset();
        return;
      }
      const clamp = (value: number) => Math.max(-1, Math.min(1, value));
      tilt.style.transform = `rotateX(${-clamp(y) * 5}deg) rotateY(${clamp(x) * 5}deg)`;
    };
    const move = (event: PointerEvent) => {
      if (disabled || motion.matches || !hover.matches || space || event.buttons ||
        event.pointerType !== "mouse" ||
        (event.target instanceof Element && event.target.closest('[data-merch-interactive], [data-slot="panel"]'))) {
        reset();
        return;
      }
      point = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.code === "Space") { space = true; reset(); }
    };
    const keyup = (event: KeyboardEvent) => {
      if (event.code === "Space") space = false;
    };
    const blur = () => { space = false; reset(); };
    reset();
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerdown", reset, true);
    document.addEventListener("pointercancel", reset);
    document.addEventListener("pointerleave", reset);
    document.addEventListener("wheel", reset, { passive: true });
    document.addEventListener("keydown", keydown);
    document.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    motion.addEventListener("change", reset);
    hover.addEventListener("change", reset);
    return () => {
      reset();
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerdown", reset, true);
      document.removeEventListener("pointercancel", reset);
      document.removeEventListener("pointerleave", reset);
      document.removeEventListener("wheel", reset);
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
      motion.removeEventListener("change", reset);
      hover.removeEventListener("change", reset);
    };
  }, [disabled]);

  return { surfaceRef, tiltRef };
}

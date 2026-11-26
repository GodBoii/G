"use client";

import Link from "next/link";
import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export function TableEntrance({ href, title, subtitle, theme, children }: {
  href: string;
  title: string;
  subtitle: string;
  theme: "patti" | "roulette";
  children: ReactNode;
}) {
  const link = useRef<HTMLAnchorElement>(null);
  const frame = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const element = link.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      element.dataset.inView = String(entry.isIntersecting);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  function tilt({ currentTarget, pointerType, clientX, clientY }: PointerEvent<HTMLAnchorElement>) {
    if (pointerType !== "mouse" || reducedMotion) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const bounds = currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
      const y = Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height));
      currentTarget.style.setProperty("--tilt-x", `${(0.5 - y) * 13}deg`);
      currentTarget.style.setProperty("--tilt-y", `${(x - 0.5) * 17}deg`);
      currentTarget.style.setProperty("--glare-x", `${x * 100}%`);
      currentTarget.style.setProperty("--glare-y", `${y * 100}%`);
      frame.current = null;
    });
  }

  function reset({ currentTarget }: PointerEvent<HTMLAnchorElement>) {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    currentTarget.style.removeProperty("--tilt-x");
    currentTarget.style.removeProperty("--tilt-y");
  }

  return (
    <Link className="table-entrance" ref={link} data-theme={theme} href={href}
      onPointerMove={tilt} onPointerLeave={reset} onPointerCancel={reset}>
      <div className="table-entrance-surface">
        <div className="entrance-scene" aria-hidden="true">{children}</div>
        <div className="entrance-copy">
          <div><h2 className="entrance-title">{title}</h2><p className="entrance-subtitle">{subtitle}</p></div>
          <span className="entrance-arrow" aria-hidden="true">↗</span>
        </div>
        <span className="entrance-glare" aria-hidden="true" />
      </div>
    </Link>
  );
}

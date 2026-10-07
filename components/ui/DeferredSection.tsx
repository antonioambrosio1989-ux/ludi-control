"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import SectionSkeleton from "./SectionSkeleton";

class SectionErrorBoundary extends Component<
  { children: ReactNode; label: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? (
      <p role="alert" className="rounded-[13px] bg-red-50 p-5 text-sm font-bold text-red-700">
        Impossibile caricare {this.props.label.toLocaleLowerCase("it")}.
      </p>
    ) : this.props.children;
  }
}

// Mount lower sections shortly before they enter the viewport. Once mounted,
// keep them alive: scrolling must not restart requests or lose local state.
export default function DeferredSection({ children, label, rows = 3 }: {
  children: ReactNode;
  label: string;
  rows?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!("IntersectionObserver" in window)) {
      // Keep the fallback asynchronous, as with the observer callback.
      let active = true;
      queueMicrotask(() => { if (active) setVisible(true); });
      return () => { active = false; };
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "400px 0px" });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef}>
      {visible ? (
        <SectionErrorBoundary label={label}>{children}</SectionErrorBoundary>
      ) : <SectionSkeleton label={`Caricamento ${label}`} rows={rows} />}
    </div>
  );
}

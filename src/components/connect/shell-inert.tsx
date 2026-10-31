"use client";

import { useEffect } from "react";

export function ShellInert() {
  useEffect(() => {
    const app = document.querySelector<HTMLElement>(".connect-app");
    const viewport = window.visualViewport;
    const fit = () => {
      if (!app || !viewport) {
        return;
      }
      app.style.height = `${viewport.height}px`;
      app.style.top = `${viewport.offsetTop}px`;
    };
    fit();
    viewport?.addEventListener("resize", fit);
    viewport?.addEventListener("scroll", fit);
    return () => {
      viewport?.removeEventListener("resize", fit);
      viewport?.removeEventListener("scroll", fit);
      if (app) {
        app.style.height = "";
        app.style.top = "";
      }
    };
  }, []);
  return null;
}

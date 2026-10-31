"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function SwipeBack() {
  const router = useRouter();

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const start = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch || touch.clientX > 24) {
        tracking = false;
        return;
      }
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    };
    const end = (event: TouchEvent) => {
      if (!tracking) {
        return;
      }
      tracking = false;
      const touch = event.changedTouches[0];
      if (!touch) {
        return;
      }
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);
      if (dx < 72 || dy > 48) {
        return;
      }
      if (window.location.pathname === "/workspace/connect") {
        return;
      }
      router.push("/workspace/connect");
    };

    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchend", end, { passive: true });
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchend", end);
    };
  }, [router]);

  return null;
}

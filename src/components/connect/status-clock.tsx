"use client";

import { useEffect, useState } from "react";

export function StatusClock() {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const paint = () => {
      setLabel(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    };
    paint();
    const timer = setInterval(paint, 15000);
    return () => clearInterval(timer);
  }, []);

  return <span>{label}</span>;
}

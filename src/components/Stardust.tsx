"use client";

import { useEffect, useState } from "react";

export interface Burst {
  id: number;
  x: number;
  y: number;
}

export function Stardust({ burst }: { burst: Burst | null }) {
  const [live, setLive] = useState<Burst | null>(null);

  useEffect(() => {
    if (!burst) return;
    setLive(burst);
    const t = setTimeout(() => setLive(null), 1600);
    return () => clearTimeout(t);
  }, [burst]);

  if (!live) return null;

  return (
    <div className="dust" key={live.id}>
      {Array.from({ length: 30 }, (_, i) => {
        const angle = (i / 30) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 70 + Math.random() * 190;
        return (
          <span
            key={i}
            className="mote"
            style={
              {
                left: live.x,
                top: live.y,
                "--dx": `${Math.cos(angle) * dist}px`,
                "--dy": `${Math.sin(angle) * dist - 40}px`,
                animationDelay: `${Math.random() * 0.12}s`,
                opacity: 0.4 + Math.random() * 0.6,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

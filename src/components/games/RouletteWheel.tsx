import type { CSSProperties } from "react";
import { pocketColor, POCKET_ANGLE, WHEEL_ORDER } from "@/lib/logic/roulette";

const pocketPaint = { red: "#a8223b", black: "#24202c", green: "#267456" };
const segments = WHEEL_ORDER.flatMap((number, index) => {
  const start = index * POCKET_ANGLE;
  const end = start + POCKET_ANGLE;
  const paint = pocketPaint[pocketColor(number)];
  return [`${paint} ${start}deg ${end - 0.37}deg`, `#b78262 ${end - 0.37}deg ${end}deg`];
});
const pockets = `conic-gradient(from ${-POCKET_ANGLE / 2}deg, ${segments.join(", ")})`;

export function RouletteWheel({ rotation, ballRotation, spinning, hasResult }: {
  rotation: number;
  ballRotation: number;
  spinning: boolean;
  hasResult: boolean;
}) {
  const style: CSSProperties & Record<`--${string}`, string> = {
    "--wheel-rotation": `${rotation}deg`,
    "--ball-rotation": `${ballRotation}deg`,
    "--pockets": pockets,
  };
  return (
    <div className={`roulette-wheel${spinning ? " is-spinning" : ""}`} style={style} aria-hidden="true">
      <div className="wheel-rim">
        <div className="wheel-disc">
          {WHEEL_ORDER.map((number, index) => (
            <div key={number} className="wheel-pocket" style={{ transform: `rotate(${index * POCKET_ANGLE}deg)` }}>
              <span>{number}</span>
            </div>
          ))}
        </div>
        <div className="wheel-hub"><span>37</span></div>
        <div className="ball-orbit" data-visible={spinning || hasResult}><span className="wheel-ball" /></div>
      </div>
      <span className="wheel-pointer" />
    </div>
  );
}

import type { CSSProperties } from "react";
import { pocketColor, POCKET_ANGLE, WHEEL_ORDER } from "@/lib/logic/roulette";

export const SPIN_DURATION = 2880;

const pocketPaint = { red: "#8a302d", black: "#202321", green: "#2e6c53" };
const segments = WHEEL_ORDER.flatMap((number, index) => {
  const start = index * POCKET_ANGLE;
  const end = start + POCKET_ANGLE;
  const paint = pocketPaint[pocketColor(number)];
  return [`${paint} ${start}deg ${end - 0.37}deg`, `#af8b5c ${end - 0.37}deg ${end}deg`];
});
const pockets = `conic-gradient(from ${-POCKET_ANGLE / 2}deg, ${segments.join(", ")})`;

export function RouletteWheel({ rotation = 0, ballRotation = 0, spinning = false, showBall = false }: {
  rotation?: number;
  ballRotation?: number;
  spinning?: boolean;
  showBall?: boolean;
}) {
  const style: CSSProperties & Record<`--${string}`, string> = {
    "--wheel-rotation": `${rotation}deg`,
    "--ball-rotation": `${ballRotation}deg`,
    "--spin-time": `${SPIN_DURATION}ms`,
    "--pockets": pockets,
  };

  return (
    <div className="roulette-wheel" style={style} data-spinning={spinning} aria-hidden="true">
      <div className="wheel-plane">
        <div className="wheel-shell" />
        <div className="wheel-rim" />
        <div className="wheel-track" />
        <div className="wheel-rotor">
          {WHEEL_ORDER.map((number, index) => (
            <div key={number} className="wheel-pocket" style={{ transform: `rotate(${index * POCKET_ANGLE}deg)` }}>
              <span>{number}</span>
            </div>
          ))}
        </div>
        <div className="wheel-dish" />
        <div className="wheel-spindle">
          <span className="spindle-stem" /><span className="spindle-knob">✦</span>
        </div>
        <div className="ball-orbit" data-visible={spinning || showBall}><span className="wheel-ball" /></div>
        <span className="wheel-pointer" />
      </div>
    </div>
  );
}

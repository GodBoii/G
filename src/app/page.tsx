import Image from "next/image";
import { TableEntrance } from "@/components/lobby/TableEntrance";
import { PlayingCard } from "@/components/games/PlayingCard";
import { RouletteWheel } from "@/components/games/RouletteWheel";

export default function Home() {
  return (
    <div className="lobby">
      <div className="salon-backdrop" aria-hidden="true">
        <Image src="/salon.webp" alt="" fill sizes="100vw" preload />
      </div>
      <div className="lobby-inner">
        <div className="lobby-intro">
          <span className="club-mark" aria-hidden="true">✦</span>
          <h1>House <em>37</em></h1>
          <p>Choose your table</p>
        </div>
        <div className="lobby-tables">
          <TableEntrance href="/teen-patti" title="Teen Patti" subtitle="Three cards. One showdown." theme="patti">
            <div className="lobby-card-fan">
              <div className="fan-card"><PlayingCard card={{ rank: 13, suit: "clubs" }} /></div>
              <div className="fan-card"><PlayingCard card={{ rank: 14, suit: "spades" }} /></div>
              <div className="fan-card"><PlayingCard card={{ rank: 12, suit: "hearts" }} /></div>
            </div>
          </TableEntrance>
          <TableEntrance href="/roulette" title="Roulette" subtitle="The European single-zero wheel." theme="roulette">
            <div className="lobby-wheel"><RouletteWheel rotation={9} showBall /></div>
          </TableEntrance>
        </div>
      </div>
    </div>
  );
}

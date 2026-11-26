import Image from "next/image";
import { TableEntrance } from "@/components/lobby/TableEntrance";
import { PlayingCard } from "@/components/games/PlayingCard";
import { RouletteWheel } from "@/components/games/RouletteWheel";

export default function Home() {
  return (
    <div className="lobby">
      <div className="lobby-inner">
        <div className="house-strip">
          <span><b aria-hidden="true">♠</b> The game room</span>
          <span className="play-mode">Free play</span>
        </div>
        <div className="lobby-intro">
          <div className="salon-backdrop" aria-hidden="true">
            <Image src="/queen-of-hearts.webp" alt="" fill sizes="(max-width: 1280px) 100vw, 1280px" preload />
          </div>
          <h1>House <em>37</em></h1>
          <a className="explore-link" href="#tables">Explore tables <span aria-hidden="true">↓</span></a>
        </div>
        <div className="collection-heading" id="tables">
          <h2>Choose your table</h2>
          <span aria-hidden="true">♠ <i>♥</i> ♣ <i>♦</i></span>
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

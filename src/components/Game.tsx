"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import {
  createGrid,
  hasWon,
  isGameOver,
  move,
  spawnTile,
  type Direction,
  type Grid,
} from "@/lib/game/engine";
import Subscribe from "./Subscribe";
import styles from "./Game.module.css";

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

const SWIPE_THRESHOLD = 30;

const EMPTY_BOARD: Grid = Array.from({ length: 4 }, () =>
  Array<number>(4).fill(0),
);

export interface GameEntitlement {
  subscribed: boolean;
  freeGamesRemaining: number | null;
}

interface GameProps {
  userName: string;
  initialBest: number;
  entitlement: GameEntitlement;
  checkoutSuccess?: boolean;
}

export default function Game({
  userName,
  initialBest,
  entitlement,
  checkoutSuccess = false,
}: GameProps) {
  const router = useRouter();

  const [grid, setGrid] = useState<Grid | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(initialBest);
  const [won, setWon] = useState(false);
  const [keepPlaying, setKeepPlaying] = useState(false);
  const [over, setOver] = useState(false);

  const [subscribed, setSubscribed] = useState(entitlement.subscribed);
  const [remaining, setRemaining] = useState<number | null>(
    entitlement.freeGamesRemaining,
  );
  const [locked, setLocked] = useState(
    !entitlement.subscribed && (entitlement.freeGamesRemaining ?? 0) <= 0,
  );
  const [starting, setStarting] = useState(false);
  const savedRef = useRef(false);

  const beginBoard = useCallback(() => {
    setGrid(createGrid());
    setScore(0);
    setWon(false);
    setKeepPlaying(false);
    setOver(false);
    savedRef.current = false;
  }, []);

  // Ask the server for permission to start a game (counts a free play unless
  // subscribed). Locks the board when the free quota is exhausted.
  const requestStart = useCallback(async () => {
    if (subscribed) {
      beginBoard();
      return;
    }

    setStarting(true);
    try {
      const res = await fetch("/api/games/start", { method: "POST" });
      if (res.status === 402) {
        setLocked(true);
        setRemaining(0);
        setGrid(null);
        return;
      }
      const data = await res.json();
      if (data.subscribed) {
        setSubscribed(true);
      } else {
        setRemaining(data.freeGamesRemaining);
      }
      setLocked(false);
      beginBoard();
    } catch {
      // Network error — fall back to letting the player start.
      beginBoard();
    } finally {
      setStarting(false);
    }
  }, [subscribed, beginBoard]);

  // Initialise after mount (keeps the random board out of SSR/hydration).
  useEffect(() => {
    if (subscribed || (remaining ?? 0) > 0) {
      requestStart();
    } else {
      setLocked(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After returning from a successful checkout, refresh once so the server
  // recomputes the (webhook-updated) subscription state.
  useEffect(() => {
    if (!checkoutSuccess) return;
    const t = setTimeout(() => router.refresh(), 1500);
    return () => clearTimeout(t);
  }, [checkoutSuccess, router]);

  const applyMove = useCallback(
    (direction: Direction) => {
      setGrid((current) => {
        if (!current || over) return current;
        const result = move(current, direction);
        if (!result.moved) return current;

        const next = spawnTile(result.grid);
        setScore((s) => s + result.gained);
        if (hasWon(next)) setWon(true);
        if (isGameOver(next)) setOver(true);
        return next;
      });
    },
    [over],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const direction = KEY_TO_DIRECTION[e.key];
      if (!direction) return;
      e.preventDefault();
      applyMove(direction);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyMove]);

  // Persist the final score once per game.
  useEffect(() => {
    if (!over || savedRef.current) return;
    savedRef.current = true;

    fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: score }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.best === "number") setBest(data.best);
      })
      .catch(() => {
        /* best-effort */
      });
  }, [over, score]);

  // Touch / swipe controls.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      applyMove(dx > 0 ? "right" : "left");
    } else {
      applyMove(dy > 0 ? "down" : "up");
    }
  }

  async function handleLogout() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  const liveBest = Math.max(best, score);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>2048</h1>
        <div className={styles.scores}>
          <div className={styles.scoreBox}>
            <span className={styles.scoreLabel}>得分</span>
            <span className={styles.scoreValue}>{score}</span>
          </div>
          <div className={styles.scoreBox}>
            <span className={styles.scoreLabel}>最高</span>
            <span className={styles.scoreValue}>{liveBest}</span>
          </div>
        </div>
      </header>

      {checkoutSuccess && (
        <div className={styles.successBanner}>
          ✅ 支付成功！订阅正在激活，稍候即可无限畅玩。
        </div>
      )}

      <div className={styles.toolbar}>
        <span className={styles.user}>
          你好，{userName}
          {subscribed ? (
            <span className={styles.badgePro}>已订阅 ✓</span>
          ) : (
            <span className={styles.badgeFree}>
              剩余免费 {remaining ?? 0} 局
            </span>
          )}
        </span>
        <div className={styles.toolbarButtons}>
          <button
            type="button"
            className={styles.btn}
            onClick={requestStart}
            disabled={starting}
          >
            {starting ? "…" : "重新开始"}
          </button>
          <button type="button" className={styles.btnGhost} onClick={handleLogout}>
            登出
          </button>
        </div>
      </div>

      <div
        className={styles.boardWrap}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className={styles.board}>
          {(grid ?? EMPTY_BOARD).flatMap((row, r) =>
            row.map((value, c) => (
              <div
                key={`${r}-${c}`}
                className={styles.tile}
                data-value={value || undefined}
              >
                {value !== 0 ? value : ""}
              </div>
            )),
          )}
        </div>

        {locked && (
          <div className={`${styles.overlay} ${styles.paywall}`}>
            <p className={styles.overlayText}>免费次数已用完</p>
            <p className={styles.overlayScore}>
              订阅后即可无限畅玩 2048
            </p>
            <Subscribe />
          </div>
        )}

        {!locked && over && (
          <div className={styles.overlay}>
            <p className={styles.overlayText}>游戏结束</p>
            <p className={styles.overlayScore}>得分 {score}</p>
            <button type="button" className={styles.btn} onClick={requestStart}>
              再来一局
            </button>
            {!subscribed && (remaining ?? 0) <= 0 && (
              <p className={styles.overlayHint}>这是最后一局免费游戏</p>
            )}
          </div>
        )}

        {!locked && won && !keepPlaying && !over && (
          <div className={styles.overlay}>
            <p className={styles.overlayText}>你赢了！🎉</p>
            <p className={styles.overlayScore}>得分 {score}</p>
            <div className={styles.toolbarButtons}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => setKeepPlaying(true)}
              >
                继续挑战
              </button>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={requestStart}
              >
                再来一局
              </button>
            </div>
          </div>
        )}
      </div>

      <p className={styles.hint}>方向键或 WASD 移动，移动端可滑动</p>
    </div>
  );
}

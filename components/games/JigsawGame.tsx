"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Artwork } from "@/lib/artworks";

interface Props {
  artwork: Artwork;
  n: number;
  onComplete: (timeSec: number, moves: number, score: number) => void;
}

export default function JigsawGame({ artwork, n, onComplete }: Props) {
  const [pieces, setPieces] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [solved, setSolved] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const startRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const boardRef = useRef<HTMLDivElement>(null);
  const boardSize = typeof window !== "undefined" ? Math.min(window.innerWidth * 0.9, 520) : 480;
  const pieceSize = Math.floor(boardSize / n);

  const shuffle = useCallback(() => {
    const arr = Array.from({ length: n * n }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (arr.every((v, i) => v === i)) { arr[0] = 1; arr[1] = 0; }
    return arr;
  }, [n]);

  useEffect(() => {
    setPieces(shuffle());
    setMoves(0);
    setElapsed(0);
    setSolved(false);
    setDragFrom(null);
    setDragOver(null);
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 500);
    return () => clearInterval(timerRef.current);
  }, [shuffle]);

  function swap(from: number, to: number) {
    if (from === to || solved) return;
    setPieces((prev) => {
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      const isSolved = next.every((v, i) => v === i);
      if (isSolved) {
        clearInterval(timerRef.current);
        setSolved(true);
        const finalTime = Math.floor((Date.now() - startRef.current) / 1000);
        const finalMoves = moves + 1;
        const base: Record<number, number> = { 3: 1000, 4: 3000, 5: 6000 };
        const score = Math.max(50, (base[n] ?? 1000) - finalTime * 3 - finalMoves * 5);
        setTimeout(() => onComplete(finalTime, finalMoves, score), 400);
      }
      return next;
    });
    setMoves((m) => m + 1);
  }

  // ── Desktop drag ──
  function onDragStart(slot: number) { setDragFrom(slot); }
  function onDragEnd() { setDragFrom(null); setDragOver(null); }
  function onDragOver(e: React.DragEvent, slot: number) { e.preventDefault(); setDragOver(slot); }
  function onDrop(e: React.DragEvent, slot: number) {
    e.preventDefault();
    if (dragFrom !== null) swap(dragFrom, slot);
    setDragFrom(null);
    setDragOver(null);
  }

  // ── Mobile touch ──
  function slotFromTouch(e: React.TouchEvent): number | null {
    const touch = e.changedTouches[0];
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const x = touch.clientX - rect.left - 3; // 3px padding
    const y = touch.clientY - rect.top - 3;
    const col = Math.floor(x / (pieceSize + 3));
    const row = Math.floor(y / (pieceSize + 3));
    if (col < 0 || col >= n || row < 0 || row >= n) return null;
    return row * n + col;
  }

  function onTouchStart(e: React.TouchEvent, slot: number) {
    e.preventDefault();
    setDragFrom(slot);
  }

  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault();
    const slot = slotFromTouch(e);
    setDragOver(slot);
  }

  function onTouchEnd(e: React.TouchEvent) {
    e.preventDefault();
    const slot = slotFromTouch(e);
    if (dragFrom !== null && slot !== null) swap(dragFrom, slot);
    setDragFrom(null);
    setDragOver(null);
  }

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* HUD */}
      <div className="flex items-center gap-6 text-center">
        {[
          { label: "เวลา", val: fmt(elapsed) },
          { label: "การเคลื่อน", val: moves },
          { label: "ความยาก", val: `${n}×${n}` },
        ].map(({ label, val }, i) => (
          <div key={i}>
            <div className="text-[10px] tracking-[.15em] uppercase text-ink3">{label}</div>
            <div className="font-bold text-xl text-gold-light" style={{ fontFamily: "var(--font-serif)" }}>
              {val}
            </div>
          </div>
        ))}
      </div>

      {/* Board */}
      <div
        ref={boardRef}
        className="grid gap-[3px] p-[3px] rounded-lg select-none"
        style={{
          gridTemplateColumns: `repeat(${n},${pieceSize}px)`,
          width: pieceSize * n + 6,
          background: "rgba(212,168,67,.1)",
          border: "1px solid rgba(212,168,67,.2)",
          touchAction: "none",
        }}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {pieces.map((pieceIdx, slot) => {
          const row = Math.floor(pieceIdx / n);
          const col = pieceIdx % n;
          const isDragging = dragFrom === slot;
          const isOver = dragOver === slot;
          const isCorrect = pieceIdx === slot;

          return (
            <div
              key={slot}
              draggable={!solved}
              onDragStart={() => onDragStart(slot)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => onDragOver(e, slot)}
              onDrop={(e) => onDrop(e, slot)}
              onTouchStart={(e) => onTouchStart(e, slot)}
              className="rounded-sm transition-all duration-100"
              style={{
                width: pieceSize,
                height: pieceSize,
                backgroundImage: `url('/images/${artwork.file}')`,
                backgroundSize: `${pieceSize * n}px ${pieceSize * n}px`,
                backgroundPosition: `-${col * pieceSize}px -${row * pieceSize}px`,
                backgroundRepeat: "no-repeat",
                cursor: solved ? "default" : isDragging ? "grabbing" : "grab",
                opacity: isDragging ? 0.4 : 1,
                outline: isOver
                  ? "3px solid #d4a843"
                  : isCorrect && !solved
                  ? "2px solid rgba(0,200,80,.4)"
                  : "none",
                boxShadow: isOver ? "0 0 16px rgba(212,168,67,.5)" : "none",
                transform: isOver ? "scale(1.04)" : "scale(1)",
              }}
            />
          );
        })}
      </div>

      <p className="text-ink3 text-xs">✦ ลากชิ้นส่วนเพื่อสลับตำแหน่ง</p>
    </div>
  );
}

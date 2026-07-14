"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  typedName: string;
  onNameChange: (name: string) => void;
  // Emits a PNG dataURL of the current signature (drawn or rendered-from-typed), or "" when cleared.
  onSignatureChange: (dataUrl: string) => void;
  disabled?: boolean;
}

type Mode = "draw" | "type";

/**
 * Lightweight signature capture — no external dependency.
 * "Draw" gives a pointer/touch canvas; "Type" renders the typed name
 * in a script font onto a canvas so both modes yield a PNG dataURL.
 */
export default function SignaturePad({ typedName, onNameChange, onSignatureChange, disabled }: Props) {
  const [mode, setMode] = useState<Mode>("draw");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Size the canvas to its container (handles mobile widths) once mounted.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";
    }
  }, []);

  function pos(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent) {
    if (disabled) return;
    drawing.current = true;
    last.current = pos(e);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    hasDrawn.current = true;
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (hasDrawn.current) emitDrawn();
  }

  function emitDrawn() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSignatureChange(canvas.toDataURL("image/png"));
  }

  function clearDrawn() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    hasDrawn.current = false;
    onSignatureChange("");
  }

  // Render the typed name into an off-screen canvas as a script signature.
  function renderTyped(name: string) {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 160;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    ctx.fillStyle = "#111827";
    ctx.textBaseline = "middle";
    ctx.font = "48px 'Segoe Script', 'Brush Script MT', cursive";
    ctx.fillText(name, 20, 90);
    return c.toDataURL("image/png");
  }

  function switchMode(m: Mode) {
    if (disabled) return;
    setMode(m);
    if (m === "type") {
      onSignatureChange(typedName.trim() ? renderTyped(typedName) : "");
    } else {
      // switching back to draw — keep whatever was drawn (empty if none)
      onSignatureChange(hasDrawn.current && canvasRef.current ? canvasRef.current.toDataURL("image/png") : "");
    }
  }

  return (
    <div className={disabled ? "opacity-50 pointer-events-none" : ""}>
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => switchMode("draw")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            mode === "draw" ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-600"
          }`}
        >
          ✍️ Draw
        </button>
        <button
          type="button"
          onClick={() => switchMode("type")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            mode === "type" ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-600"
          }`}
        >
          ⌨️ Type
        </button>
      </div>

      {mode === "draw" ? (
        <div>
          <canvas
            ref={canvasRef}
            className="w-full h-36 rounded-xl border border-gray-300 bg-white touch-none"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-400">Sign with your finger or mouse</span>
            <button type="button" onClick={clearDrawn} className="text-xs text-gray-500 hover:text-red-500 font-medium">
              Clear
            </button>
          </div>
        </div>
      ) : (
        <div>
          <input
            type="text"
            value={typedName}
            onChange={(e) => {
              onNameChange(e.target.value);
              onSignatureChange(e.target.value.trim() ? renderTyped(e.target.value) : "");
            }}
            placeholder="Type your full legal name"
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {typedName.trim() && (
            <div
              className="mt-2 h-20 rounded-xl border border-gray-200 bg-white flex items-center px-4 text-4xl text-gray-900"
              style={{ fontFamily: "'Segoe Script', 'Brush Script MT', cursive" }}
            >
              {typedName}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

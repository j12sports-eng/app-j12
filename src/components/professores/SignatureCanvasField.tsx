import { useEffect, useRef, useState } from "react";
import { RotateCcw, Signature } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SignatureCanvasField({ value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(Boolean(value));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.lineJoin = "round";
    context.lineCap = "round";
    context.lineWidth = 2.4;
    context.strokeStyle = "#ff6a00";
    context.fillStyle = "#0f172a";
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (!value) return;

    const image = new Image();
    image.onload = () => {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      setHasDrawn(true);
    };
    image.src = value;
  }, [value]);

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function beginStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    const point = getPoint(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function drawStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const point = getPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    const dataUrl = canvas.toDataURL("image/png");
    onChange(dataUrl);
    setHasDrawn(true);
  }

  function endStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawingRef.current = false;
    canvas.releasePointerCapture(event.pointerId);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.fillStyle = "#0f172a";
    context.fillRect(0, 0, canvas.width, canvas.height);
    onChange("");
    setHasDrawn(false);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-primary/20 bg-[#0b1120] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
          <Signature className="h-4 w-4 text-primary" />
          Assinatura em canvas
        </div>
        <Button type="button" variant="outline" size="sm" onClick={clearCanvas}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Limpar
        </Button>
      </div>

      <canvas
        ref={canvasRef}
        width={900}
        height={240}
        onPointerDown={beginStroke}
        onPointerMove={drawStroke}
        onPointerUp={endStroke}
        onPointerLeave={endStroke}
        className="h-44 w-full rounded-xl border border-dashed border-primary/30 bg-slate-950 touch-none"
      />

      <p className="text-xs text-slate-400">
        {hasDrawn
          ? "Assinatura capturada. Se precisar, limpe e desenhe novamente."
          : "Desenhe a assinatura no campo acima usando mouse, trackpad ou toque."}
      </p>
    </div>
  );
}

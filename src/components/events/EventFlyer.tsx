import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

type FlyerData = {
  title: string;
  category?: string | null;
  dateLabel: string;
  timeLabel?: string | null;
  location?: string | null;
  priceLabel: string;
  therapistName?: string | null;
  coverUrl?: string | null;
  targetUrl: string;
};

const W = 1080;
const H = 1350; // 4:5

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function renderFlyer(canvas: HTMLCanvasElement, d: FlyerData) {
  const ctx = canvas.getContext("2d")!;
  canvas.width = W;
  canvas.height = H;

  // Background fallback (deep violet gradient)
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1a0b2e");
  bg.addColorStop(1, "#3d1a78");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Cover image (full-bleed, cover-fit)
  if (d.coverUrl) {
    try {
      const img = await loadImage(d.coverUrl);
      const ratio = Math.max(W / img.width, H / img.height);
      const iw = img.width * ratio;
      const ih = img.height * ratio;
      ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
    } catch {}
  }

  // Bottom dark gradient overlay (40% height)
  const overlayTop = Math.round(H * 0.55);
  const grad = ctx.createLinearGradient(0, overlayTop, 0, H);
  grad.addColorStop(0, "rgba(15,5,30,0)");
  grad.addColorStop(0.35, "rgba(15,5,30,0.85)");
  grad.addColorStop(1, "rgba(10,3,20,0.96)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, overlayTop, W, H - overlayTop);

  // Top-left: Holiswiss wordmark
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "600 36px 'Inter', system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText("Holi", 56, 56);
  ctx.fillStyle = "#c084fc";
  const holiW = ctx.measureText("Holi").width;
  ctx.fillText("swiss", 56 + holiW, 56);

  // Top-right: category pill
  if (d.category) {
    const pad = 22;
    ctx.font = "600 26px 'Inter', system-ui, sans-serif";
    const tw = ctx.measureText(d.category).width;
    const pillW = tw + pad * 2;
    const pillH = 52;
    const px = W - pillW - 56;
    const py = 56;
    ctx.fillStyle = "rgba(192,132,252,0.95)";
    roundRect(ctx, px, py, pillW, pillH, 26);
    ctx.fill();
    ctx.fillStyle = "#1a0b2e";
    ctx.fillText(d.category, px + pad, py + 12);
  }

  // Title (bottom-left, large)
  const textX = 64;
  const qrSize = 260;
  const qrPad = 16;
  const qrBoxSize = qrSize + qrPad * 2;
  const qrX = W - qrBoxSize - 56;
  const qrY = H - qrBoxSize - 56;
  const maxTextWidth = qrX - textX - 32;

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 72px 'Inter', system-ui, sans-serif";
  const titleLines = wrapText(ctx, d.title, maxTextWidth).slice(0, 3);
  let cursorY = overlayTop + 100;
  for (const line of titleLines) {
    ctx.fillText(line, textX, cursorY);
    cursorY += 82;
  }

  // Therapist (if any)
  if (d.therapistName) {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "400 28px 'Inter', system-ui, sans-serif";
    ctx.fillText(`avec ${d.therapistName}`, textX, cursorY + 8);
    cursorY += 50;
  }

  // Info lines (date, time, location, price)
  cursorY += 24;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "500 30px 'Inter', system-ui, sans-serif";

  const infoLines: string[] = [];
  infoLines.push(d.dateLabel + (d.timeLabel ? ` · ${d.timeLabel}` : ""));
  if (d.location) infoLines.push(d.location);
  infoLines.push(d.priceLabel);

  for (const line of infoLines) {
    const trimmed = wrapText(ctx, line, maxTextWidth)[0];
    ctx.fillText(trimmed, textX, cursorY);
    cursorY += 44;
  }

  // QR code white box bottom-right
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, qrX, qrY, qrBoxSize, qrBoxSize, 20);
  ctx.fill();
  ctx.strokeStyle = "#c084fc";
  ctx.lineWidth = 4;
  roundRect(ctx, qrX, qrY, qrBoxSize, qrBoxSize, 20);
  ctx.stroke();

  const qrDataUrl = await QRCode.toDataURL(d.targetUrl, {
    margin: 0,
    width: qrSize,
    color: { dark: "#1a0b2e", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, qrX + qrPad, qrY + qrPad, qrSize, qrSize);

  // "Réserver" label under QR
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "600 22px 'Inter', system-ui, sans-serif";
  const label = "Scanner pour réserver";
  const lw = ctx.measureText(label).width;
  ctx.fillText(label, qrX + qrBoxSize / 2 - lw / 2, qrY - 36);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function EventFlyer({ data, filename = "flyer-holiswiss.png" }: { data: FlyerData; filename?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      if (!canvasRef.current) return;
      await renderFlyer(canvasRef.current, data);
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  const download = async () => {
    if (!canvasRef.current) return;
    setBusy(true);
    try {
      await renderFlyer(canvasRef.current, data);
      const url = canvasRef.current.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden border border-border bg-card max-w-sm mx-auto">
        <canvas
          ref={canvasRef}
          className="block w-full h-auto"
          style={{ aspectRatio: "4 / 5" }}
          aria-label="Aperçu du flyer"
        />
      </div>
      <div className="flex justify-center">
        <Button type="button" onClick={download} disabled={!ready || busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Télécharger le flyer (PNG)
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Format 1080 × 1350 — idéal Instagram & Facebook.
      </p>
    </div>
  );
}
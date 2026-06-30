import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Download, QrCode as QrIcon } from "lucide-react";
import lotusAsset from "@/assets/lotus-transparent.png.asset.json";
const lotusLogo = lotusAsset.url;

const BRAND = "#7C3AED";
const SITE = "https://holiswiss.ch";

type Variant = {
  key: "profil" | "intake";
  label: string;
  caption: string;
  pathPrefix: string;
};

const VARIANTS: Variant[] = [
  { key: "profil", label: "Mon profil HoliSwiss", caption: "Scannez pour accéder à mon profil", pathPrefix: "/therapeute/" },
  { key: "intake", label: "Prendre rendez-vous", caption: "Scannez pour prendre rendez-vous", pathPrefix: "/intake/" },
];

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function renderQrCanvas(url: string, size: number, withLogo: boolean): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  await QRCode.toCanvas(canvas, url, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: size,
    color: { dark: BRAND, light: "#FFFFFF" },
  });
  if (withLogo) {
    try {
      const logo = await loadImage(lotusLogo);
      const ctx = canvas.getContext("2d")!;
      const logoSize = Math.round(size * 0.2);
      const pad = Math.round(logoSize * 0.12);
      const x = (size - logoSize) / 2;
      const y = (size - logoSize) / 2;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2);
      ctx.drawImage(logo, x, y, logoSize, logoSize);
    } catch {
      /* ignore logo errors */
    }
  }
  return canvas;
}

async function renderFramedCanvas(url: string, caption: string): Promise<HTMLCanvasElement> {
  const W = 600;
  const H = 750;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  // background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);
  // header
  ctx.fillStyle = BRAND;
  ctx.fillRect(0, 0, W, 80);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 28px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🌿 HoliSwiss", W / 2, 40);
  // qr
  const qr = await renderQrCanvas(url, 400, true);
  ctx.drawImage(qr, (W - 400) / 2, 110);
  // caption
  ctx.fillStyle = "#1C1C1E";
  ctx.font = "500 20px Inter, system-ui, sans-serif";
  ctx.fillText(caption, W / 2, 560);
  // url
  ctx.fillStyle = BRAND;
  ctx.font = "400 16px Inter, system-ui, sans-serif";
  ctx.fillText(url.replace(/^https?:\/\//, ""), W / 2, 610);
  // footer line
  ctx.fillStyle = "#E5E7EB";
  ctx.fillRect(40, 670, W - 80, 1);
  ctx.fillStyle = "#6B7280";
  ctx.font = "400 13px Inter, system-ui, sans-serif";
  ctx.fillText("holiswiss.ch", W / 2, 700);
  return canvas;
}

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  const href = URL.createObjectURL(blob);
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function QrPreview({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const canvas = await renderQrCanvas(url, 300, true);
      if (cancelled || !ref.current) return;
      ref.current.innerHTML = "";
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      canvas.style.maxWidth = "300px";
      canvas.style.display = "block";
      ref.current.appendChild(canvas);
    })();
    return () => { cancelled = true; };
  }, [url]);
  return <div ref={ref} className="mx-auto flex items-center justify-center rounded-xl bg-white p-4" style={{ minHeight: 320 }} />;
}

function VariantBlock({ slug, variant }: { slug: string; variant: Variant }) {
  const url = `${SITE}${variant.pathPrefix}${slug}`;
  const [busy, setBusy] = useState<null | "png" | "svg">(null);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lien copié ✓");
    } catch {
      toast.error("Impossible de copier le lien");
    }
  };

  const onDownloadPng = async () => {
    setBusy("png");
    try {
      const canvas = await renderFramedCanvas(url, variant.caption);
      await new Promise<void>((resolve) =>
        canvas.toBlob((blob) => {
          if (blob) downloadBlob(blob, `holiswiss-qr-${variant.key}-${slug}.png`);
          resolve();
        }, "image/png"),
      );
    } finally {
      setBusy(null);
    }
  };

  const onDownloadSvg = async () => {
    setBusy("svg");
    try {
      const svg = await QRCode.toString(url, {
        type: "svg",
        errorCorrectionLevel: "H",
        margin: 1,
        color: { dark: BRAND, light: "#FFFFFF" },
      });
      const blob = new Blob([svg], { type: "image/svg+xml" });
      downloadBlob(blob, `holiswiss-qr-${variant.key}-${slug}.svg`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <QrPreview url={url} />
      <p className="text-center text-sm font-medium text-white">{variant.label}</p>
      <p className="text-center text-xs text-[#a89bc4] break-all">{url}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" size="sm" onClick={onDownloadPng} disabled={busy !== null}>
          <Download className="mr-1 h-4 w-4" /> {busy === "png" ? "..." : "PNG"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDownloadSvg} disabled={busy !== null}>
          <Download className="mr-1 h-4 w-4" /> {busy === "svg" ? "..." : "SVG"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCopy}>
          <Copy className="mr-1 h-4 w-4" /> Copier le lien
        </Button>
      </div>
    </div>
  );
}

export default function QrCodePanel({ slug }: { slug: string }) {
  const cleanSlug = (slug || "").trim();
  if (!cleanSlug) {
    return (
      <div className="rounded-xl border border-[#3a2d5f] bg-[#1a1230]/60 p-5 text-sm text-[#a89bc4]">
        <div className="flex items-center gap-2 font-medium text-white">
          <QrIcon className="h-4 w-4 text-[#b86ef9]" /> Mon QR Code
        </div>
        <p className="mt-2">Définissez et enregistrez votre slug public pour générer votre QR code personnalisé.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#3a2d5f] bg-[#1a1230]/60 p-5">
      <div className="mb-4 flex items-center gap-2 font-medium text-white">
        <QrIcon className="h-4 w-4 text-[#b86ef9]" /> Mon QR Code
      </div>
      <Tabs defaultValue="profil" className="w-full">
        <TabsList className="mb-4 grid w-full grid-cols-2">
          <TabsTrigger value="profil">Profil public</TabsTrigger>
          <TabsTrigger value="intake">Prise de RDV</TabsTrigger>
        </TabsList>
        {VARIANTS.map((v) => (
          <TabsContent key={v.key} value={v.key}>
            <VariantBlock slug={cleanSlug} variant={v} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
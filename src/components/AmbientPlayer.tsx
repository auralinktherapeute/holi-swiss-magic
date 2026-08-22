import { useEffect, useRef, useState } from "react";
import { Music2, Volume2 } from "lucide-react";
import ambientAudio from "@/assets/ambient-handpan.mp3.asset.json";

const STORAGE_KEY = "holiswiss-ambient";
const DEFAULT_VOLUME = 0.3;
const AUDIO_URL = ambientAudio.url;

const PURPLE = "#b86ef9";
const CYAN = "#5cc8fa";

export function AmbientPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [mounted, setMounted] = useState(false);

  // SSR-safe mount
  useEffect(() => {
    setMounted(true);
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved === "on") {
      // Don't auto-play; browser blocks it. Just set state.
      setPlaying(false);
    }
    return () => {
      if (fadeRef.current) clearInterval(fadeRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  const stopFade = () => {
    if (fadeRef.current) {
      clearInterval(fadeRef.current);
      fadeRef.current = null;
    }
  };

  const fadeIn = () => {
    stopFade();
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0;
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.catch((err) => {
        console.warn("[AmbientPlayer] play() failed:", err);
        setPlaying(false);
        try { localStorage.setItem(STORAGE_KEY, "off"); } catch {}
        stopFade();
      });
    }
    fadeRef.current = setInterval(() => {
      if (audio.volume < DEFAULT_VOLUME - 0.02) {
        audio.volume = Math.min(DEFAULT_VOLUME, audio.volume + 0.02);
      } else {
        audio.volume = DEFAULT_VOLUME;
        stopFade();
      }
    }, 200);
  };

  const fadeOut = () => {
    stopFade();
    const audio = audioRef.current;
    if (!audio) return;
    // Stop immediately so the user gets instant feedback on mobile/desktop.
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = DEFAULT_VOLUME;
    } catch (err) {
      console.warn("[AmbientPlayer] pause() failed:", err);
    }
  };

  const toggle = () => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = "auto";
      a.loop = true;
      a.volume = DEFAULT_VOLUME;
      a.src = AUDIO_URL;
      a.addEventListener("error", () => {
        console.warn("[AmbientPlayer] audio element error", a.error);
      });
      audioRef.current = a;
    }

    if (playing) {
      fadeOut();
      setPlaying(false);
      try { localStorage.setItem(STORAGE_KEY, "off"); } catch {}
    } else {
      fadeIn();
      setPlaying(true);
      try { localStorage.setItem(STORAGE_KEY, "on"); } catch {}
    }
  };

  if (!mounted) return null;

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Désactiver la musique" : "Activer l'ambiance sonore"}
        aria-pressed={playing}
        className="ambient-pill fixed z-50 flex h-14 items-center overflow-hidden rounded-full pl-[3px] pr-[3px] transition-[padding] duration-300 ease-out hover:pr-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0a1e]"
        style={{
          bottom: 24,
          right: 24,
          background: "rgba(20,10,40,0.7)",
          border: "1px solid rgba(184,110,249,0.35)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <span className="relative grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full">
          <span className={playing ? "ambient-conic ambient-conic--on" : "ambient-conic"} />
          <span
            className="relative grid h-[38px] w-[38px] place-items-center rounded-full"
            style={{ background: "#1a1035", color: playing ? PURPLE : "rgba(255,255,255,0.7)" }}
          >
            {playing ? <Bars /> : <Music2 className="h-[18px] w-[18px]" />}
          </span>
        </span>
        <span className="ambient-label whitespace-nowrap text-sm font-medium text-white/90">
          {playing ? "Musique active" : "Ambiance sonore"}
        </span>
      </button>

      <style>{`
        @keyframes ambient-bar-0 { from { height: 4px } to { height: 15px } }
        @keyframes ambient-bar-1 { from { height: 8px } to { height: 18px } }
        @keyframes ambient-bar-2 { from { height: 6px } to { height: 13px } }
        @keyframes ambient-spin { to { transform: rotate(360deg) } }
        .ambient-conic {
          position: absolute; inset: 0; border-radius: 999px;
          background: conic-gradient(from 0deg, transparent 0 60%, ${PURPLE} 78%, ${CYAN} 92%, transparent 100%);
          opacity: .5;
        }
        .ambient-conic--on { opacity: 1; animation: ambient-spin 3.2s linear infinite }
        .ambient-label {
          max-width: 0; opacity: 0; margin-left: 0;
          transition: max-width .35s ease-out, opacity .25s ease-out, margin-left .35s ease-out;
        }
        .ambient-pill:hover .ambient-label,
        .ambient-pill:focus-visible .ambient-label {
          max-width: 200px; opacity: 1; margin-left: 10px;
        }
        @media (prefers-reduced-motion: reduce) {
          .ambient-conic--on { animation: none !important }
        }
      `}</style>
    </>
  );
}

function Bars({ color = PURPLE }: { color?: string }) {
  return (
    <span className="flex items-end gap-[3px] h-4" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block rounded-full"
          style={{
            width: 3,
            background: i === 1 ? CYAN : color,
            animation: `ambient-bar-${i} ${0.7 + i * 0.1}s ease-in-out infinite alternate`,
          }}
        />
      ))}
    </span>
  );
}

export default AmbientPlayer;

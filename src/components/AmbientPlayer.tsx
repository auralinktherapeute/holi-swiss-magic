import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

const STORAGE_KEY = "holiswiss-ambient";
const DEFAULT_VOLUME = 0.3;
const AUDIO_URL =
  "https://archive.org/download/jamendo-625387/01-2300348-Siarhei%20Korbut-Meditation%20Handpan%20Loop%201.mp3";

export function AmbientPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
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
    audio.play().catch(() => {
      // Autoplay blocked or other error
      setPlaying(false);
    });
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
    fadeRef.current = setInterval(() => {
      if (audio.volume > 0.02) {
        audio.volume = Math.max(0, audio.volume - 0.02);
      } else {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = DEFAULT_VOLUME;
        stopFade();
      }
    }, 100);
  };

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(AUDIO_URL);
      audioRef.current.loop = true;
      audioRef.current.volume = DEFAULT_VOLUME;
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
    <button
      type="button"
      onClick={toggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={playing ? "Désactiver la musique" : "Activer l'ambiance sonore"}
      className="fixed z-50 flex items-center justify-center transition-all duration-200 ease-out hover:scale-105"
      style={{
        bottom: 24,
        left: 24,
        width: 44,
        height: 44,
        borderRadius: 999,
        background: "rgba(184,110,249,0.15)",
        border: "1px solid rgba(184,110,249,0.3)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        color: playing ? "#b86ef9" : "rgba(255,255,255,0.5)",
      }}
      onMouseDown={(e) => {
        (e.currentTarget.style.background as unknown as string) = "rgba(184,110,249,0.25)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget.style.background as unknown as string) = "rgba(184,110,249,0.15)";
      }}
    >
      {playing ? (
        <span className="flex items-end gap-[3px] h-4">
          <span
            className="inline-block rounded-full"
            style={{
              width: 3,
              background: "#b86ef9",
              animation: "ambient-bar-1 0.8s ease-in-out infinite alternate",
            }}
          />
          <span
            className="inline-block rounded-full"
            style={{
              width: 3,
              background: "#5cc8fa",
              animation: "ambient-bar-2 0.7s ease-in-out infinite alternate",
            }}
          />
          <span
            className="inline-block rounded-full"
            style={{
              width: 3,
              background: "#b86ef9",
              animation: "ambient-bar-3 0.9s ease-in-out infinite alternate",
            }}
          />
        </span>
      ) : (
        <Volume2 className="h-5 w-5" />
      )}

      {hovered && (
        <span
          className="absolute left-full ml-2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium"
          style={{
            background: "rgba(15,10,30,0.9)",
            border: "1px solid rgba(184,110,249,0.3)",
            color: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(8px)",
          }}
        >
          {playing ? "Désactiver la musique" : "Activer l'ambiance sonore"}
        </span>
      )}

      <style>{`
        @keyframes ambient-bar-1 {
          0% { height: 4px; }
          100% { height: 14px; }
        }
        @keyframes ambient-bar-2 {
          0% { height: 8px; }
          100% { height: 16px; }
        }
        @keyframes ambient-bar-3 {
          0% { height: 6px; }
          100% { height: 12px; }
        }
      `}</style>
    </button>
  );
}

export default AmbientPlayer;

import { useState, useEffect, useCallback, useRef } from "react";

const slides = [
  { src: "/presentation/slide1_final.png", alt: "U-Storage Go - Title" },
  { src: "/presentation/slide2_problem.png", alt: "The Problem" },
  { src: "/presentation/slide3_final.png", alt: "The Solution" },
  { src: "/presentation/slide4_founder.png", alt: "Market Opportunity" },
  { src: "/presentation/slide5_final.png", alt: "Built on Replit" },
  { src: "/presentation/slide6_final.png", alt: "U-Storage Partnership" },
  { src: "/presentation/slide7_final.png", alt: "The Team" },
];

const autoTimings = [30, 105, 30, 60, 30, 30, 0];

export default function Presentation() {
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [controlTimeout, setControlTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [autoRemaining, setAutoRemaining] = useState(0);
  const autoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const goNext = useCallback(() => {
    setCurrent((c) => Math.min(c + 1, slides.length - 1));
  }, []);

  const goPrev = useCallback(() => {
    setCurrent((c) => Math.max(c - 1, 0));
  }, []);

  const goTo = useCallback((idx: number) => {
    setCurrent(idx);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "f" || e.key === "F") {
        if (!document.fullscreenElement) toggleFullscreen();
      } else if (e.key === "Escape") {
        if (isAutoPlay) stopAutoPlay();
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
      }
      if (!isFullscreen) flashControls();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev, isFullscreen]);

  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch (_) {}
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch (_) {}
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (fs) {
        requestWakeLock();
      } else {
        releaseWakeLock();
        setIsAutoPlay(false);
        setAutoRemaining(0);
      }
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isFullscreen) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isFullscreen, requestWakeLock]);

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen().catch(() => {
        document.documentElement.requestFullscreen();
      });
    }
  };

  const flashControls = useCallback(() => {
    setShowControls(true);
    if (controlTimeout) clearTimeout(controlTimeout);
    const t = setTimeout(() => setShowControls(false), 3000);
    setControlTimeout(t);
  }, [controlTimeout]);

  useEffect(() => {
    flashControls();
    return () => {
      if (controlTimeout) clearTimeout(controlTimeout);
    };
  }, []);

  const clearAutoTimers = useCallback(() => {
    if (autoTimerRef.current) { clearTimeout(autoTimerRef.current); autoTimerRef.current = null; }
    if (autoCountdownRef.current) { clearInterval(autoCountdownRef.current); autoCountdownRef.current = null; }
  }, []);

  const startAutoPlay = useCallback(() => {
    setIsAutoPlay(true);
    setCurrent(0);
    const el = containerRef.current;
    if (el && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => {
        document.documentElement.requestFullscreen();
      });
    }
  }, []);

  const stopAutoPlay = useCallback(() => {
    setIsAutoPlay(false);
    setAutoRemaining(0);
    clearAutoTimers();
  }, [clearAutoTimers]);

  useEffect(() => {
    if (!isAutoPlay) return;
    clearAutoTimers();
    const duration = autoTimings[current];
    if (duration === 0) {
      setAutoRemaining(0);
      return;
    }
    setAutoRemaining(duration);
    autoCountdownRef.current = setInterval(() => {
      setAutoRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    autoTimerRef.current = setTimeout(() => {
      setCurrent((c) => {
        if (c < slides.length - 1) return c + 1;
        return c;
      });
    }, duration * 1000);
    return () => clearAutoTimers();
  }, [isAutoPlay, current, clearAutoTimers]);

  if (isFullscreen) {
    return (
      <div
        ref={containerRef}
        data-testid="presentation-container"
        style={{
          width: "100vw",
          height: "100vh",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "none",
          overflow: "hidden",
          position: "relative",
        }}
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (x > rect.width * 0.3) goNext();
          else goPrev();
        }}
      >
        <img
          data-testid={`slide-image-${current}`}
          src={slides[current].src}
          alt={slides[current].alt}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
        {isAutoPlay && autoTimings[current] > 0 && (
          <div
            data-testid="auto-progress"
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "100%",
              height: "3px",
              background: "rgba(255,255,255,0.1)",
            }}
          >
            <div
              style={{
                height: "100%",
                background: "rgba(255,255,255,0.5)",
                width: `${((autoTimings[current] - autoRemaining) / autoTimings[current]) * 100}%`,
                transition: "width 1s linear",
              }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="presentation-container"
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#1a1a2e",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        cursor: showControls ? "default" : "none",
      }}
      onMouseMove={flashControls}
      onClick={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x > rect.width * 0.6) goNext();
        else if (x < rect.width * 0.4) goPrev();
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          padding: "20px",
          minHeight: 0,
        }}
      >
        <img
          data-testid={`slide-image-${current}`}
          src={slides[current].src}
          alt={slides[current].alt}
          style={{
            maxWidth: "100%",
            maxHeight: "calc(100vh - 120px)",
            objectFit: "contain",
            borderRadius: "4px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
            transition: "opacity 0.3s ease",
          }}
        />

        <button
          data-testid="button-prev"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          disabled={current === 0}
          style={{
            position: "absolute",
            left: "20px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "50%",
            width: "50px",
            height: "50px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: current === 0 ? "default" : "pointer",
            opacity: showControls ? (current === 0 ? 0.3 : 0.8) : 0,
            transition: "opacity 0.3s ease",
            color: "white",
            fontSize: "20px",
            backdropFilter: "blur(10px)",
          }}
        >
          ‹
        </button>

        <button
          data-testid="button-next"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          disabled={current === slides.length - 1}
          style={{
            position: "absolute",
            right: "20px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "50%",
            width: "50px",
            height: "50px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: current === slides.length - 1 ? "default" : "pointer",
            opacity: showControls ? (current === slides.length - 1 ? 0.3 : 0.8) : 0,
            transition: "opacity 0.3s ease",
            color: "white",
            fontSize: "20px",
            backdropFilter: "blur(10px)",
          }}
        >
          ›
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "16px 20px",
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(10px)",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {slides.map((_, i) => (
            <button
              key={i}
              data-testid={`slide-dot-${i}`}
              onClick={(e) => { e.stopPropagation(); goTo(i); }}
              style={{
                width: i === current ? "32px" : "10px",
                height: "10px",
                borderRadius: "5px",
                border: "none",
                background: i === current ? "#A8B8C4" : "rgba(255,255,255,0.3)",
                cursor: "pointer",
                transition: "all 0.3s ease",
                padding: 0,
              }}
            />
          ))}
        </div>

        <span
          data-testid="text-slide-counter"
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: "14px",
            marginLeft: "8px",
            minWidth: "50px",
            textAlign: "center",
          }}
        >
          {current + 1} / {slides.length}
        </span>

        <div style={{ display: "flex", gap: "8px", marginLeft: "16px" }}>
          <button
            data-testid="button-auto"
            onClick={(e) => { e.stopPropagation(); startAutoPlay(); }}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "8px",
              padding: "8px 14px",
              color: "white",
              cursor: "pointer",
              fontSize: "13px",
              backdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            ▶ Auto
          </button>

          <button
            data-testid="button-fullscreen"
            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "8px",
              padding: "8px 14px",
              color: "white",
              cursor: "pointer",
              fontSize: "13px",
              backdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            ⛶ Fullscreen
          </button>

          <a
            data-testid="link-download"
            href="/presentation/Ruku_Pitch_Deck.pdf"
            download="Ruku_Pitch_Deck.pdf"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "8px",
              padding: "8px 14px",
              color: "white",
              cursor: "pointer",
              fontSize: "13px",
              textDecoration: "none",
              backdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            ↓ Download PDF
          </a>
        </div>
      </div>
    </div>
  );
}

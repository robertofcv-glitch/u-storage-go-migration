import { useState } from "react";

interface ChatMessage {
  id: number;
  text: string;
  sender: "user" | "bot";
  time: string;
}

const sampleMessages: ChatMessage[] = [
  { id: 1, text: "Hi! I need a ride to the airport.", sender: "user", time: "8:42 PM" },
  { id: 2, text: "I found 3 drivers nearby. Your closest driver is 4 min away. Confirm pickup?", sender: "bot", time: "8:42 PM" },
  { id: 3, text: "Yes, confirm please!", sender: "user", time: "8:43 PM" },
  { id: 4, text: "Your ride is confirmed! Driver Marco is on his way in a black sedan. ETA: 4 minutes.", sender: "bot", time: "8:43 PM" },
];

function PhoneChatMockup() {
  const [messages] = useState<ChatMessage[]>(sampleMessages);

  return (
    <div
      data-testid="phone-mockup-ridesharing"
      style={{
        width: 220,
        height: 420,
        background: "linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        borderRadius: 32,
        border: "3px solid #444",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
        display: "flex",
        flexDirection: "column" as const,
        overflow: "hidden",
        position: "relative" as const,
      }}
    >
      {/* Status bar */}
      <div style={{
        height: 28,
        background: "rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        color: "#aaa",
        letterSpacing: 0.5,
      }}>
        <span>9:41</span>
      </div>

      {/* Header */}
      <div style={{
        padding: "8px 12px",
        background: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
        }}>
          🚗
        </div>
        <div>
          <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: 0.3 }}>
            Ridesharing
          </div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 9 }}>
            AI Assistant • Online
          </div>
        </div>
      </div>

      {/* Chat messages */}
      <div style={{
        flex: 1,
        padding: "8px 8px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column" as const,
        gap: 6,
        background: "rgba(0,0,0,0.15)",
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            data-testid={`chat-message-${msg.id}`}
            style={{
              alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
              maxWidth: "82%",
            }}
          >
            <div style={{
              padding: "6px 10px",
              borderRadius: msg.sender === "user"
                ? "12px 12px 2px 12px"
                : "12px 12px 12px 2px",
              background: msg.sender === "user"
                ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                : "rgba(255,255,255,0.12)",
              color: "#fff",
              fontSize: 10,
              lineHeight: 1.4,
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}>
              {msg.text}
            </div>
            <div style={{
              fontSize: 8,
              color: "rgba(255,255,255,0.4)",
              marginTop: 2,
              textAlign: msg.sender === "user" ? "right" : "left",
              paddingLeft: msg.sender === "bot" ? 4 : 0,
              paddingRight: msg.sender === "user" ? 4 : 0,
            }}>
              {msg.time}
            </div>
          </div>
        ))}
      </div>

      {/* Input bar */}
      <div style={{
        padding: "6px 8px",
        background: "rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}>
        <div style={{
          flex: 1,
          height: 28,
          borderRadius: 14,
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.15)",
          display: "flex",
          alignItems: "center",
          paddingLeft: 10,
          fontSize: 9,
          color: "rgba(255,255,255,0.35)",
        }}>
          Type a message...
        </div>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          cursor: "pointer",
        }}>
          ▶
        </div>
      </div>
    </div>
  );
}

export default function Slide4Founder() {
  return (
    <div
      data-testid="slide4-founder"
      style={{
        width: 1280,
        height: 720,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        background: "#0a0a0a",
      }}
    >
      {/* LEFT SIDE — Ride Sharing */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "60%",
        height: "100%",
        clipPath: "polygon(0 0, 100% 0, 75% 100%, 0 100%)",
        zIndex: 2,
      }}>
        {/* Neon city background */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, #0c0c1d 0%, #1a0a2e 30%, #0d1b3e 60%, #0a1628 100%)",
        }} />

        {/* Neon glow effects */}
        <div style={{
          position: "absolute",
          top: "10%",
          left: "15%",
          width: 180,
          height: 300,
          background: "radial-gradient(ellipse, rgba(255, 0, 128, 0.25) 0%, transparent 70%)",
          filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute",
          top: "5%",
          right: "20%",
          width: 200,
          height: 250,
          background: "radial-gradient(ellipse, rgba(0, 200, 255, 0.2) 0%, transparent 70%)",
          filter: "blur(50px)",
        }} />
        <div style={{
          position: "absolute",
          bottom: "20%",
          left: "40%",
          width: 150,
          height: 200,
          background: "radial-gradient(ellipse, rgba(128, 0, 255, 0.2) 0%, transparent 70%)",
          filter: "blur(45px)",
        }} />

        {/* City skyline silhouette */}
        <svg
          style={{ position: "absolute", bottom: 120, left: 0, width: "100%", opacity: 0.3 }}
          viewBox="0 0 800 200"
          preserveAspectRatio="none"
        >
          <path
            d="M0,200 L0,140 L30,140 L30,100 L50,100 L50,80 L70,80 L70,60 L90,60 L90,80 L110,80 L110,120 L130,120 L130,70 L150,70 L150,50 L170,50 L170,30 L190,30 L190,50 L210,50 L210,90 L230,90 L230,40 L250,40 L250,20 L270,20 L270,50 L290,50 L290,100 L310,100 L310,60 L330,60 L330,80 L350,80 L350,45 L370,45 L370,25 L390,25 L390,55 L410,55 L410,90 L430,90 L430,110 L450,110 L450,70 L470,70 L470,35 L490,35 L490,15 L510,15 L510,45 L530,45 L530,75 L550,75 L550,100 L570,100 L570,130 L590,130 L590,80 L610,80 L610,60 L630,60 L630,90 L650,90 L650,120 L670,120 L670,100 L690,100 L690,140 L710,140 L710,110 L730,110 L730,150 L750,150 L750,130 L770,130 L770,160 L800,160 L800,200Z"
            fill="url(#cityGrad)"
          />
          <defs>
            <linearGradient id="cityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a1a3e" />
              <stop offset="100%" stopColor="#0d0d1a" />
            </linearGradient>
          </defs>
        </svg>

        {/* Neon sign elements */}
        <div style={{
          position: "absolute",
          top: 80,
          left: 60,
          fontSize: 22,
          fontWeight: 800,
          color: "#ff2d8a",
          textShadow: "0 0 20px rgba(255, 45, 138, 0.8), 0 0 40px rgba(255, 45, 138, 0.4)",
          letterSpacing: 4,
          transform: "rotate(-5deg)",
        }}>
          RIDES
        </div>
        <div style={{
          position: "absolute",
          top: 120,
          left: 180,
          fontSize: 16,
          fontWeight: 700,
          color: "#00d4ff",
          textShadow: "0 0 15px rgba(0, 212, 255, 0.8), 0 0 30px rgba(0, 212, 255, 0.3)",
          letterSpacing: 2,
        }}>
          24/7
        </div>

        {/* Road / ground */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 120,
          background: "linear-gradient(180deg, #1a1a2e 0%, #111 100%)",
        }}>
          {/* Road lines */}
          <div style={{
            position: "absolute",
            top: 50,
            left: 0,
            width: "100%",
            height: 3,
            background: "repeating-linear-gradient(90deg, rgba(255,255,0,0.6) 0px, rgba(255,255,0,0.6) 30px, transparent 30px, transparent 60px)",
          }} />
        </div>

        {/* Car silhouette */}
        <svg
          style={{ position: "absolute", bottom: 30, left: "25%", width: 250, opacity: 0.9 }}
          viewBox="0 0 300 100"
        >
          <path
            d="M30,70 Q30,50 60,45 L100,25 Q120,15 160,15 L200,15 Q230,15 250,30 L270,45 Q290,50 290,70 L290,75 L30,75Z"
            fill="#1a1a2e"
            stroke="rgba(128, 0, 255, 0.6)"
            strokeWidth="1.5"
          />
          {/* Windows */}
          <path
            d="M105,28 L120,18 Q130,15 155,15 L155,40Z"
            fill="rgba(0, 200, 255, 0.15)"
            stroke="rgba(0, 200, 255, 0.3)"
            strokeWidth="0.5"
          />
          <path
            d="M160,15 Q185,15 200,18 L215,28 L160,40Z"
            fill="rgba(0, 200, 255, 0.15)"
            stroke="rgba(0, 200, 255, 0.3)"
            strokeWidth="0.5"
          />
          {/* Headlights */}
          <circle cx="275" cy="55" r="8" fill="rgba(255, 200, 0, 0.8)" />
          <circle cx="275" cy="55" r="15" fill="rgba(255, 200, 0, 0.15)" />
          {/* Tail lights */}
          <rect x="30" y="50" width="6" height="12" rx="2" fill="rgba(255, 0, 50, 0.9)" />
          <rect x="30" y="50" width="12" height="12" rx="2" fill="rgba(255, 0, 50, 0.15)" />
          {/* Wheels */}
          <circle cx="85" cy="75" r="14" fill="#111" stroke="#333" strokeWidth="2" />
          <circle cx="85" cy="75" r="6" fill="#222" />
          <circle cx="235" cy="75" r="14" fill="#111" stroke="#333" strokeWidth="2" />
          <circle cx="235" cy="75" r="6" fill="#222" />
          {/* Neon underglow */}
          <rect x="60" y="78" width="200" height="4" rx="2" fill="rgba(128, 0, 255, 0.5)" filter="url(#glow)" />
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>
        </svg>

        {/* Couple silhouette */}
        <svg
          style={{ position: "absolute", bottom: 85, left: "52%", width: 80, opacity: 0.7 }}
          viewBox="0 0 80 120"
        >
          {/* Person 1 */}
          <circle cx="25" cy="15" r="10" fill="#1a1a3e" />
          <path d="M15,30 Q10,80 15,110 L35,110 Q30,80 35,30Z" fill="#1a1a3e" />
          {/* Person 2 */}
          <circle cx="55" cy="12" r="10" fill="#1a1a3e" />
          <path d="M45,27 Q40,75 45,110 L65,110 Q60,75 65,27Z" fill="#1a1a3e" />
        </svg>

        {/* Phone mockup with chat */}
        <div style={{
          position: "absolute",
          bottom: 100,
          left: "6%",
          transform: "perspective(800px) rotateY(5deg)",
          zIndex: 10,
        }}>
          <PhoneChatMockup />
        </div>
      </div>

      {/* DIAGONAL DIVIDER */}
      <div style={{
        position: "absolute",
        top: 0,
        left: "42%",
        width: "20%",
        height: "100%",
        background: "linear-gradient(135deg, rgba(128, 0, 255, 0.3) 0%, rgba(255, 200, 100, 0.3) 100%)",
        clipPath: "polygon(30% 0, 100% 0, 70% 100%, 0% 100%)",
        zIndex: 3,
        filter: "blur(1px)",
      }} />

      {/* RIGHT SIDE — Vacation Rental */}
      <div style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: "55%",
        height: "100%",
        clipPath: "polygon(25% 0, 100% 0, 100% 100%, 0 100%)",
        zIndex: 1,
      }}>
        {/* Tropical sunset sky background */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, #1a0a2e 0%, #4a1942 15%, #c0392b 30%, #e67e22 45%, #f39c12 55%, #f5d76e 62%, #48c9b0 70%, #1a8a7a 80%, #0e6655 90%, #0a4a3a 100%)",
        }} />

        {/* Sun glow */}
        <div style={{
          position: "absolute",
          top: "28%",
          right: "35%",
          width: 200,
          height: 200,
          background: "radial-gradient(circle, rgba(255, 200, 80, 0.8) 0%, rgba(255, 140, 50, 0.4) 30%, transparent 65%)",
          filter: "blur(15px)",
        }} />

        {/* Sun */}
        <svg
          style={{ position: "absolute", top: "30%", right: "36%", width: 80, opacity: 0.9 }}
          viewBox="0 0 80 80"
        >
          <circle cx="40" cy="40" r="30" fill="#f9e547" />
          <circle cx="40" cy="40" r="35" fill="rgba(249, 229, 71, 0.3)" />
        </svg>

        {/* Clouds */}
        <svg
          style={{ position: "absolute", top: "18%", right: "15%", width: 180, opacity: 0.4 }}
          viewBox="0 0 180 50"
        >
          <ellipse cx="60" cy="30" rx="50" ry="15" fill="#e8a87c" />
          <ellipse cx="100" cy="25" rx="40" ry="18" fill="#d4836a" />
          <ellipse cx="140" cy="30" rx="35" ry="12" fill="#e8a87c" />
        </svg>
        <svg
          style={{ position: "absolute", top: "24%", right: "50%", width: 120, opacity: 0.3 }}
          viewBox="0 0 120 40"
        >
          <ellipse cx="40" cy="20" rx="35" ry="12" fill="#d4836a" />
          <ellipse cx="75" cy="18" rx="30" ry="14" fill="#e8a87c" />
        </svg>

        {/* Ocean water */}
        <div style={{
          position: "absolute",
          bottom: 100,
          left: 0,
          width: "100%",
          height: 180,
          background: "linear-gradient(180deg, #1abc9c 0%, #16a085 30%, #148f77 60%, #117a65 100%)",
        }} />

        {/* Ocean wave lines */}
        <svg
          style={{ position: "absolute", bottom: 160, left: 0, width: "100%", height: 120, opacity: 0.4 }}
          viewBox="0 0 700 120"
          preserveAspectRatio="none"
        >
          <path d="M0,30 Q80,10 160,30 T320,30 T480,30 T640,30 T700,30" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" />
          <path d="M0,55 Q70,38 140,55 T280,55 T420,55 T560,55 T700,55" stroke="rgba(255,255,255,0.25)" strokeWidth="1" fill="none" />
          <path d="M0,80 Q90,65 180,80 T360,80 T540,80 T700,80" stroke="rgba(255,255,255,0.2)" strokeWidth="1" fill="none" />
        </svg>

        {/* Sun reflection on water */}
        <div style={{
          position: "absolute",
          bottom: 140,
          right: "32%",
          width: 80,
          height: 120,
          background: "linear-gradient(180deg, rgba(249, 229, 71, 0.3) 0%, rgba(249, 229, 71, 0.1) 40%, transparent 100%)",
          filter: "blur(8px)",
        }} />

        {/* Sandy beach */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 110,
          background: "linear-gradient(180deg, #e8c170 0%, #d4a84b 40%, #c49a3a 70%, #b8892e 100%)",
        }} />

        {/* Beach texture / sand details */}
        <svg
          style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 110, opacity: 0.3 }}
          viewBox="0 0 700 110"
          preserveAspectRatio="none"
        >
          <circle cx="100" cy="60" r="1.5" fill="#c49a3a" />
          <circle cx="250" cy="40" r="1" fill="#b8892e" />
          <circle cx="400" cy="70" r="1.5" fill="#c49a3a" />
          <circle cx="550" cy="50" r="1" fill="#b8892e" />
          <circle cx="180" cy="85" r="1" fill="#c49a3a" />
          <circle cx="450" cy="90" r="1.5" fill="#b8892e" />
          <circle cx="600" cy="75" r="1" fill="#c49a3a" />
          <circle cx="320" cy="55" r="1" fill="#b8892e" />
        </svg>

        {/* Shoreline - where water meets sand */}
        <svg
          style={{ position: "absolute", bottom: 95, left: 0, width: "100%", height: 30, opacity: 0.6 }}
          viewBox="0 0 700 30"
          preserveAspectRatio="none"
        >
          <path d="M0,15 Q50,5 100,12 T200,10 T300,14 T400,8 T500,13 T600,9 T700,12 L700,30 L0,30Z" fill="rgba(255,255,255,0.2)" />
          <path d="M0,20 Q60,12 120,18 T240,16 T360,20 T480,14 T600,18 T700,16 L700,30 L0,30Z" fill="rgba(232,193,112,0.5)" />
        </svg>

        {/* Beach house / cabana */}
        <svg
          style={{ position: "absolute", bottom: 90, right: "18%", width: 200, opacity: 0.85 }}
          viewBox="0 0 200 160"
        >
          {/* House body */}
          <rect x="30" y="60" width="140" height="90" rx="3" fill="#f0e0c8" />
          {/* Roof */}
          <path d="M20,65 L100,15 L180,65Z" fill="#c0392b" />
          <path d="M20,65 L100,15 L180,65Z" fill="rgba(0,0,0,0.1)" />
          {/* Roof overhang shadow */}
          <rect x="25" y="60" width="150" height="5" fill="rgba(0,0,0,0.1)" />
          {/* Door */}
          <rect x="80" y="100" width="40" height="50" rx="2" fill="#8b5e3c" />
          <circle cx="112" cy="128" r="3" fill="#d4a84b" />
          {/* Windows */}
          <rect x="42" y="78" width="28" height="24" rx="2" fill="#87ceeb" opacity="0.7" />
          <line x1="56" y1="78" x2="56" y2="102" stroke="#f0e0c8" strokeWidth="2" />
          <line x1="42" y1="90" x2="70" y2="90" stroke="#f0e0c8" strokeWidth="2" />
          <rect x="130" y="78" width="28" height="24" rx="2" fill="#87ceeb" opacity="0.7" />
          <line x1="144" y1="78" x2="144" y2="102" stroke="#f0e0c8" strokeWidth="2" />
          <line x1="130" y1="90" x2="158" y2="90" stroke="#f0e0c8" strokeWidth="2" />
          {/* Porch overhang */}
          <rect x="65" y="95" width="70" height="4" rx="1" fill="#a0522d" />
          {/* Porch posts */}
          <rect x="68" y="95" width="3" height="55" fill="#a0522d" />
          <rect x="129" y="95" width="3" height="55" fill="#a0522d" />
        </svg>

        {/* Left palm tree */}
        <svg
          style={{ position: "absolute", bottom: 80, right: "55%", width: 140, height: 320, opacity: 0.85 }}
          viewBox="0 0 140 320"
        >
          {/* Trunk */}
          <path d="M70,310 Q65,250 72,200 Q78,150 68,100" stroke="#8b6914" strokeWidth="12" fill="none" strokeLinecap="round" />
          <path d="M70,310 Q65,250 72,200 Q78,150 68,100" stroke="#a07828" strokeWidth="8" fill="none" strokeLinecap="round" />
          {/* Trunk texture */}
          <line x1="65" y1="280" x2="75" y2="278" stroke="#6b5010" strokeWidth="1" opacity="0.5" />
          <line x1="66" y1="250" x2="76" y2="248" stroke="#6b5010" strokeWidth="1" opacity="0.5" />
          <line x1="68" y1="220" x2="78" y2="218" stroke="#6b5010" strokeWidth="1" opacity="0.5" />
          <line x1="70" y1="190" x2="80" y2="188" stroke="#6b5010" strokeWidth="1" opacity="0.5" />
          <line x1="72" y1="160" x2="76" y2="158" stroke="#6b5010" strokeWidth="1" opacity="0.5" />
          {/* Fronds */}
          <path d="M68,100 Q30,60 5,80" stroke="#2d7a3a" strokeWidth="3" fill="none" />
          <path d="M68,100 Q25,55 0,70" stroke="#1e6b2a" strokeWidth="2" fill="none" />
          <path d="M68,100 Q40,50 15,30" stroke="#2d7a3a" strokeWidth="3" fill="none" />
          <path d="M68,100 Q60,40 50,10" stroke="#3a8a4a" strokeWidth="3" fill="none" />
          <path d="M68,100 Q80,40 90,10" stroke="#3a8a4a" strokeWidth="3" fill="none" />
          <path d="M68,100 Q95,50 120,25" stroke="#2d7a3a" strokeWidth="3" fill="none" />
          <path d="M68,100 Q100,60 135,50" stroke="#1e6b2a" strokeWidth="2" fill="none" />
          <path d="M68,100 Q105,70 130,80" stroke="#2d7a3a" strokeWidth="3" fill="none" />
          {/* Frond leaves */}
          <path d="M5,80 Q20,65 35,75" fill="#2d7a3a" opacity="0.6" />
          <path d="M15,30 Q30,40 40,50" fill="#3a8a4a" opacity="0.5" />
          <path d="M120,25 Q105,40 95,50" fill="#2d7a3a" opacity="0.5" />
          <path d="M135,50 Q115,55 100,65" fill="#1e6b2a" opacity="0.5" />
          {/* Coconuts */}
          <circle cx="65" cy="105" r="5" fill="#8b6914" />
          <circle cx="73" cy="103" r="5" fill="#6b5010" />
          <circle cx="69" cy="108" r="4" fill="#7a5e12" />
        </svg>

        {/* Right palm tree */}
        <svg
          style={{ position: "absolute", bottom: 80, right: "5%", width: 120, height: 280, opacity: 0.75 }}
          viewBox="0 0 120 280"
        >
          {/* Trunk */}
          <path d="M55,270 Q60,210 52,160 Q45,120 55,80" stroke="#8b6914" strokeWidth="10" fill="none" strokeLinecap="round" />
          <path d="M55,270 Q60,210 52,160 Q45,120 55,80" stroke="#a07828" strokeWidth="6" fill="none" strokeLinecap="round" />
          {/* Fronds */}
          <path d="M55,80 Q20,50 0,65" stroke="#2d7a3a" strokeWidth="2.5" fill="none" />
          <path d="M55,80 Q30,35 10,20" stroke="#3a8a4a" strokeWidth="2.5" fill="none" />
          <path d="M55,80 Q50,30 45,5" stroke="#2d7a3a" strokeWidth="2.5" fill="none" />
          <path d="M55,80 Q70,30 80,5" stroke="#3a8a4a" strokeWidth="2.5" fill="none" />
          <path d="M55,80 Q85,40 110,30" stroke="#2d7a3a" strokeWidth="2.5" fill="none" />
          <path d="M55,80 Q90,55 115,60" stroke="#1e6b2a" strokeWidth="2" fill="none" />
          {/* Coconuts */}
          <circle cx="52" cy="84" r="4" fill="#8b6914" />
          <circle cx="59" cy="82" r="4" fill="#6b5010" />
        </svg>

        {/* Beach umbrella */}
        <svg
          style={{ position: "absolute", bottom: 75, right: "38%", width: 100, height: 140, opacity: 0.8 }}
          viewBox="0 0 100 140"
        >
          {/* Pole */}
          <line x1="50" y1="35" x2="50" y2="135" stroke="#8b6914" strokeWidth="3" />
          {/* Umbrella canopy */}
          <path d="M10,40 Q50,0 90,40Z" fill="#c0392b" />
          <path d="M10,40 Q30,15 50,10 L50,40Z" fill="#e74c3c" />
          <path d="M50,10 Q70,15 90,40 L50,40Z" fill="#c0392b" />
          <path d="M25,40 Q40,20 50,15" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
          <path d="M75,40 Q60,20 50,15" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
        </svg>

        {/* Beach chair */}
        <svg
          style={{ position: "absolute", bottom: 70, right: "35%", width: 70, height: 60, opacity: 0.75 }}
          viewBox="0 0 70 60"
        >
          {/* Chair back */}
          <rect x="10" y="5" width="40" height="30" rx="2" fill="#2980b9" transform="rotate(-15, 30, 20)" />
          {/* Chair seat */}
          <rect x="15" y="32" width="45" height="8" rx="2" fill="#2980b9" />
          {/* Legs */}
          <line x1="18" y1="40" x2="12" y2="55" stroke="#d4a84b" strokeWidth="2" />
          <line x1="55" y1="40" x2="60" y2="55" stroke="#d4a84b" strokeWidth="2" />
          <line x1="35" y1="40" x2="35" y2="55" stroke="#d4a84b" strokeWidth="2" />
        </svg>

        {/* Distant sailboat on ocean */}
        <svg
          style={{ position: "absolute", bottom: 200, right: "50%", width: 40, height: 35, opacity: 0.5 }}
          viewBox="0 0 40 35"
        >
          <path d="M20,5 L20,30 L5,30Z" fill="rgba(255,255,255,0.7)" />
          <path d="M20,8 L20,30 L33,30Z" fill="rgba(255,255,255,0.5)" />
          <rect x="3" y="28" width="34" height="4" rx="2" fill="#5a4020" />
        </svg>

        {/* Flying birds */}
        <svg
          style={{ position: "absolute", top: "15%", right: "25%", width: 80, opacity: 0.4 }}
          viewBox="0 0 80 30"
        >
          <path d="M5,15 Q10,8 15,15 Q20,8 25,15" stroke="#2c1a0a" strokeWidth="1.5" fill="none" />
          <path d="M35,10 Q39,5 43,10 Q47,5 51,10" stroke="#2c1a0a" strokeWidth="1.2" fill="none" />
          <path d="M55,18 Q58,14 61,18 Q64,14 67,18" stroke="#2c1a0a" strokeWidth="1" fill="none" />
        </svg>

        {/* "Vacation Rentals" text overlay at bottom */}
        <div style={{
          position: "absolute",
          bottom: 25,
          right: 30,
          zIndex: 5,
        }}>
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            color: "rgba(255, 220, 150, 0.6)",
            letterSpacing: 3,
            textTransform: "uppercase",
          }}>
            Vacation Rentals
          </div>
        </div>
      </div>

      {/* Diagonal shine line */}
      <div style={{
        position: "absolute",
        top: 0,
        left: "43%",
        width: 3,
        height: "150%",
        background: "linear-gradient(180deg, rgba(255,255,255,0.4), rgba(255,255,255,0.1), rgba(255,255,255,0.3))",
        transform: "rotate(15deg)",
        transformOrigin: "top left",
        zIndex: 4,
      }} />
    </div>
  );
}
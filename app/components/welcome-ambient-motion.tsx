import type { CSSProperties } from "react";

export function WelcomeAmbientMotion({ cycleDuration }: { cycleDuration: number }) {
  return (
    <div
      aria-hidden="true"
      className="welcome-ambient-motion"
      data-ambient-motion="crossfade-ribbon-drift"
      data-ambient-renderer="inline-svg"
      style={{ "--welcome-ambient-cycle": `${cycleDuration}ms` } as CSSProperties}
    >
      <svg focusable="false" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1440 900">
        <defs>
          <linearGradient
            id="rune-welcome-ribbon-warm"
            gradientUnits="userSpaceOnUse"
            x1="-120"
            x2="1540"
            y1="640"
            y2="240"
          >
            <stop offset="0" stopColor="#ff375f" />
            <stop offset=".24" stopColor="#ff9f0a" />
            <stop offset=".46" stopColor="#ffd60a" />
            <stop offset=".68" stopColor="#30d158" />
            <stop offset="1" stopColor="#64d2ff" />
          </linearGradient>
          <linearGradient
            id="rune-welcome-ribbon-cool"
            gradientUnits="userSpaceOnUse"
            x1="120"
            x2="1320"
            y1="100"
            y2="820"
          >
            <stop offset="0" stopColor="#64d2ff" />
            <stop offset=".34" stopColor="#0a84ff" />
            <stop offset=".68" stopColor="#5e5ce6" />
            <stop offset="1" stopColor="#bf5af2" />
          </linearGradient>
          <radialGradient id="rune-welcome-ribbon-focus" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".82" />
            <stop offset=".52" stopColor="#dff6ff" stopOpacity=".28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <mask id="rune-welcome-ribbon-vignette">
            <rect width="1440" height="900" fill="url(#rune-welcome-ribbon-focus)" />
          </mask>
        </defs>

        <g className="welcome-ambient-field" mask="url(#rune-welcome-ribbon-vignette)">
          <path
            className="welcome-ambient-ribbon welcome-ambient-ribbon-warm"
            d="M-170 666 C126 402 362 736 632 514 C850 334 1088 258 1608 602"
            pathLength="1"
            stroke="url(#rune-welcome-ribbon-warm)"
          />
          <path
            className="welcome-ambient-ribbon welcome-ambient-ribbon-cool"
            d="M-124 214 C202 542 452 132 748 326 C1010 498 1170 746 1572 320"
            pathLength="1"
            stroke="url(#rune-welcome-ribbon-cool)"
          />
          <path
            className="welcome-ambient-thread"
            d="M-80 548 C260 296 492 624 740 430 C964 256 1194 346 1518 578"
            pathLength="1"
            stroke="url(#rune-welcome-ribbon-warm)"
          />
        </g>
      </svg>
    </div>
  );
}

import React from 'react';

export default function Logo({ className = "w-8 h-8", style = {} }) {
  return (
    <svg 
      viewBox="215 30 250 250" 
      className={className} 
      style={style}
      role="img" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>CommandCenter App Logo</title>
      <defs>
        <radialGradient id="cc-logo-bg-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#1e1a2e"/>
          <stop offset="100%" stop-color="#0e0e14"/>
        </radialGradient>
        <radialGradient id="cc-logo-core-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#7c5cfc"/>
          <stop offset="100%" stop-color="#4b35b8"/>
        </radialGradient>
        <radialGradient id="cc-logo-ring-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#5b6af8"/>
          <stop offset="100%" stop-color="#3a48cc"/>
        </radialGradient>
      </defs>

      {/* Outer icon card shape */}
      <rect 
        x="215" 
        y="30" 
        width="250" 
        height="250" 
        rx="52" 
        fill="url(#cc-logo-bg-grad)" 
        stroke="#2a2445" 
        strokeWidth="1.5" 
      />

      {/* Grid lines inside card */}
      <g stroke="#ffffff" strokeOpacity="0.04" strokeWidth="0.8">
        <line x1="215" y1="93" x2="465" y2="93" />
        <line x1="215" y1="155" x2="465" y2="155" />
        <line x1="215" y1="217" x2="465" y2="217" />
        <line x1="278" y1="30" x2="278" y2="280" />
        <line x1="340" y1="30" x2="340" y2="280" />
        <line x1="402" y1="30" x2="402" y2="280" />
      </g>

      {/* Outer orbit ring */}
      <circle 
        cx="340" 
        cy="155" 
        r="88" 
        fill="none" 
        stroke="#5b6af8" 
        strokeOpacity="0.25" 
        strokeWidth="1.2" 
        strokeDasharray="4 6" 
      />

      {/* Mid orbit ring */}
      <circle 
        cx="340" 
        cy="155" 
        r="62" 
        fill="none" 
        stroke="#7c5cfc" 
        strokeOpacity="0.3" 
        strokeWidth="1" 
      />

      {/* Connector lines from core to outer nodes */}
      <g stroke="#5b6af8" strokeOpacity="0.5" strokeWidth="1.2" fill="none">
        <line x1="340" y1="138" x2="340" y2="67" />
        <line x1="340" y1="172" x2="340" y2="243" />
        <line x1="323" y1="155" x2="252" y2="155" />
        <line x1="357" y1="155" x2="428" y2="155" />
        <line x1="352" y1="143" x2="393" y2="102" />
        <line x1="328" y1="167" x2="287" y2="208" />
        <line x1="328" y1="143" x2="287" y2="102" />
        <line x1="352" y1="167" x2="393" y2="208" />
      </g>

      {/* Outer nodes (8 points) */}
      <g fill="#5b6af8" stroke="#0e0e14" strokeWidth="1.5">
        <circle cx="340" cy="67" r="5" />
        <circle cx="340" cy="243" r="5" />
        <circle cx="252" cy="155" r="5" />
        <circle cx="428" cy="155" r="5" />
        <circle cx="393" cy="102" r="4" />
        <circle cx="287" cy="208" r="4" />
        <circle cx="287" cy="102" r="4" />
        <circle cx="393" cy="208" r="4" />
      </g>

      {/* Mid ring accent nodes */}
      <g fill="#7c5cfc" stroke="#0e0e14" strokeWidth="1.2">
        <circle cx="340" cy="93" r="3.5" />
        <circle cx="340" cy="217" r="3.5" />
        <circle cx="278" cy="155" r="3.5" />
        <circle cx="402" cy="155" r="3.5" />
      </g>

      {/* Core circle */}
      <circle 
        cx="340" 
        cy="155" 
        r="28" 
        fill="url(#cc-logo-core-glow)" 
        stroke="#9d8ff5" 
        strokeWidth="1.5" 
        strokeOpacity="0.8" 
      />

      {/* Core inner ring */}
      <circle 
        cx="340" 
        cy="155" 
        r="20" 
        fill="none" 
        stroke="#ffffff" 
        strokeOpacity="0.15" 
        strokeWidth="1" 
      />

      {/* Command symbol ">_" inside core */}
      <g fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* > chevron */}
        <polyline points="330,148 338,155 330,162" />
        {/* _ cursor bar */}
        <line x1="342" y1="162" x2="350" y2="162" />
      </g>
    </svg>
  );
}

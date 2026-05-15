import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg 
      viewBox="0 0 500 400" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Residencial Caribbean Garden Logo"
    >
      {/* Sun Background */}
      <circle cx="350" cy="180" r="100" fill="#FFE000" />
      <circle cx="350" cy="180" r="110" fill="#FFE000" opacity="0.4" />
      
      {/* Wave at bottom */}
      <path 
        d="M0 320 Q200 240 500 320 L500 400 L0 400 Z" 
        fill="#00AEEF" 
      />
      
      {/* Palm Trees */}
      {/* Main Palm */}
      <g transform="translate(340, 320)">
        <path d="M0 0 Q10 -70 20 -150" stroke="#8B5E3C" strokeWidth="12" fill="none" strokeLinecap="round" />
        <g transform="translate(20, -150)">
          {/* Leaves */}
          <path d="M0 0 Q-50 -40 -100 20" stroke="#009245" strokeWidth="6" fill="none" />
          <path d="M0 0 Q-20 -80 50 -60" stroke="#009245" strokeWidth="6" fill="none" />
          <path d="M0 0 Q60 -80 110 -20" stroke="#009245" strokeWidth="6" fill="none" />
          <path d="M0 0 Q80 20 100 80" stroke="#009245" strokeWidth="6" fill="none" />
          <path d="M0 0 Q-30 60 -80 80" stroke="#009245" strokeWidth="6" fill="none" />
        </g>
      </g>
      
      {/* Smaller Palm */}
      <g transform="translate(280, 320) scale(0.6)">
        <path d="M0 0 Q-10 -70 -20 -140" stroke="#8B5E3C" strokeWidth="10" fill="none" strokeLinecap="round" />
        <g transform="translate(-20, -140)">
          <path d="M0 0 Q-40 -30 -70 10" stroke="#006837" strokeWidth="5" fill="none" />
          <path d="M0 0 Q40 -30 70 10" stroke="#006837" strokeWidth="5" fill="none" />
          <path d="M0 0 Q0 50 20 70" stroke="#006837" strokeWidth="5" fill="none" />
        </g>
      </g>

      {/* Text Elements */}
      <text 
        x="60" 
        y="100" 
        fontFamily="var(--font-sans), sans-serif" 
        fontSize="32" 
        fontWeight="bold"
        letterSpacing="2"
        fill="#064e3b"
      >
        Residencial
      </text>
      
      {/* Caribbean - Dynamic Type */}
      <text 
        x="40" 
        y="180" 
        fontFamily="var(--font-sans), sans-serif" 
        fontSize="80" 
        fontWeight="900"
        fill="#0369a1"
        style={{ letterSpacing: '-2px' }}
      >
        Caribbean
      </text>
      
      {/* Garden - Dynamic Type */}
      <text 
        x="60" 
        y="280" 
        fontFamily="var(--font-sans), sans-serif" 
        fontSize="100" 
        fontWeight="900"
        fill="#15803d"
        style={{ letterSpacing: '-4px' }}
      >
        Garden
      </text>
    </svg>
  );
};

export default Logo;

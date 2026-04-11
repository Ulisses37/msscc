'use client';

import React, { useState } from 'react';

interface ButtonProps {
  text: string;
  padding?: string;
  fontSize?: string;
  onClick?: () => void;
}

// Default Button Size
export default function Button({ text, padding = '10px 18px', fontSize = '12px', onClick }: ButtonProps) {
  const [hovered, setHovered] = useState(false);

  const containerStyle: React.CSSProperties = {
    borderRadius: '10px',
    backgroundColor: hovered ? 'var(--color-white)' : '#d72638',
    border: hovered ? '1px solid #d72638' : '1px solid transparent',
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    cursor: 'pointer',
    padding,
    fontSize,
    transition: 'background-color 0.15s ease',
    alignSelf: 'flex-start'
  };

  const innerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: hovered ? '#d72638' : 'var(--color-white)',
    transition: 'color 0.15s ease',
  };

  return (
    <button
      onClick={onClick}
      style={containerStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={innerStyle}>
        {text}
      </span>
    </button>
  );
}

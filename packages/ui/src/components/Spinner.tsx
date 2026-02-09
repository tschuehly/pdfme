import React from 'react';
import { defaultThemeToken } from '../contexts.js';

const Spinner: React.FC = () => {
  const token = defaultThemeToken;

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    color: token.colorPrimary,
  };

  const loaderStyle: React.CSSProperties = {
    animation: 'spin 1s linear infinite',
    width: 50,
    height: 50,
  };

  const keyframes = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  return (
    <>
      <style>{keyframes}</style>
      <div style={containerStyle}>
        <svg style={loaderStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    </>
  );
};

export default Spinner;

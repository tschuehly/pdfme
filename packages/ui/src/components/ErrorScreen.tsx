import React, { useContext } from 'react';
import { Size } from '@pdfme/common';
import { I18nContext, defaultThemeToken } from '../contexts.js';
import { BACKGROUND_COLOR } from '../constants.js';

const ErrorScreen = ({ size, error }: { size: Size; error: Error }) => {
  const i18n = useContext(I18nContext);
  const token = defaultThemeToken;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: BACKGROUND_COLOR,
        ...size,
      }}
    >
      <div style={{ width: 300, margin: '0 auto', background: token.colorBgLayout, padding: 24, borderRadius: token.borderRadius, textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>ERROR</div>
        <div style={{ color: token.colorText, marginBottom: 12 }}>{i18n('errorOccurred')}</div>
        <div style={{ color: token.colorError }}>{error.message}</div>
      </div>
    </div>
  );
};

export default ErrorScreen;

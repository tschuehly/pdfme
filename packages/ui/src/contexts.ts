import { createContext } from 'react';
import { i18n } from './i18n.js';
import { getDefaultFont, PluginRegistry, pluginRegistry, UIOptions } from '@pdfme/common';
import { builtInPlugins } from '@pdfme/schemas';

export const I18nContext = createContext(i18n);

export const FontContext = createContext(getDefaultFont());

export const PluginsRegistry = createContext<PluginRegistry>(pluginRegistry(builtInPlugins));

export const OptionsContext = createContext<UIOptions>({});

export const CacheContext = createContext<Map<string | number, unknown>>(new Map());

// Static antd-like token — no Context needed, just a plain object
export const defaultThemeToken = {
  colorPrimary: '#38a0ff',
  colorBgLayout: '#f5f5f5',
  colorBgMask: 'rgba(0, 0, 0, 0.45)',
  colorWhite: '#ffffff',
  colorText: 'rgba(0, 0, 0, 0.88)',
  colorError: '#ff4d4f',
  colorSplit: 'rgba(5, 5, 5, 0.06)',
  colorPrimaryBorder: '#91caff',
  fontSize: 14,
  borderRadius: 6,
  paddingSM: 12,
  marginXS: 8,
} as const;

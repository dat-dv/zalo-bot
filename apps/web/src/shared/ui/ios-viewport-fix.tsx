'use client';

import { useEffect } from 'react';

function isIosDevice(): boolean {
  const { userAgent, maxTouchPoints } = navigator;
  // iPadOS 13+ reports a desktop Mac user agent, so detect it by touch support.
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/**
 * iOS Safari zooms into any focused field whose font is under 16px and stays
 * zoomed after the keyboard closes. The dashboard keeps compact 11–13px
 * controls, so on iOS only we cap `maximum-scale=1`: Safari (iOS 10+) still
 * allows manual pinch-zoom but stops the automatic focus zoom. Other platforms
 * keep the default `maximumScale: 5` from the root layout.
 */
export function IosViewportFix(): null {
  useEffect(() => {
    if (!isIosDevice()) return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;

    const original = meta.content;
    const directives = original
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part && !part.startsWith('maximum-scale'));
    meta.content = [...directives, 'maximum-scale=1'].join(', ');
    return () => {
      meta.content = original;
    };
  }, []);

  return null;
}

import { getSetting } from "@/lib/db";

const DEFAULT_UI_FONT_SIZE = 14;
const DEFAULT_CODE_FONT_SIZE = 13;

export function renderFontCSS(): string {
  let uiFontFamily: string | undefined;
  let codeFontFamily: string | undefined;
  let uiFontSize: number = DEFAULT_UI_FONT_SIZE;
  let codeFontSize: number = DEFAULT_CODE_FONT_SIZE;

  try {
    uiFontFamily = getSetting("ui_font_family") || undefined;
    codeFontFamily = getSetting("code_font_family") || undefined;
    const rawUiSize = getSetting("ui_font_size");
    const rawCodeSize = getSetting("code_font_size");
    if (rawUiSize) uiFontSize = parseInt(rawUiSize, 10) || DEFAULT_UI_FONT_SIZE;
    if (rawCodeSize) codeFontSize = parseInt(rawCodeSize, 10) || DEFAULT_CODE_FONT_SIZE;
  } catch {
    // DB unavailable — use defaults
  }

  const lines: string[] = [];

  if (uiFontFamily) {
    lines.push(`html { --font-sans: ${uiFontFamily}, var(--font-geist-sans); }`);
  }
  if (codeFontFamily) {
    lines.push(`html { --font-mono: ${codeFontFamily}, var(--font-geist-mono); }`);
  }

  // Use CSS zoom for UI font size — scales everything including px-based sizes
  if (uiFontSize !== DEFAULT_UI_FONT_SIZE) {
    const zoom = (uiFontSize / DEFAULT_UI_FONT_SIZE).toFixed(3);
    lines.push(`[data-app-shell] { zoom: ${zoom}; }`);
  }

  // Code font size — apply to pre/code with !important to beat inline styles
  if (codeFontSize !== DEFAULT_CODE_FONT_SIZE) {
    lines.push(`pre, code, kbd, samp { font-size: ${codeFontSize}px !important; }`);
  }

  return lines.join("\n");
}
"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, useRef } from "react";
import { useTheme } from "next-themes";
import { codeToHtml, type BundledTheme } from "shiki";
import { useThemeFamily } from "@/lib/theme/context";
import {
  resolveShikiTheme,
  resolveShikiThemes,
} from "@/lib/theme/code-themes";
import { useTranslation } from "@/hooks/useTranslation";
import { CodePilotIcon, type CodePilotIconName } from "@/components/ui/semantic-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SettingsCard } from "@/components/patterns/SettingsCard";
import { FieldRow } from "@/components/patterns/FieldRow";

// ── Theme Mode Pill Selector ────────────────────────────────────────

const MODE_OPTIONS: ReadonlyArray<{ value: string; icon: CodePilotIconName; labelKey: "settings.modeLight" | "settings.modeDark" | "settings.modeSystem" }> = [
  { value: "light", icon: "theme_light", labelKey: "settings.modeLight" },
  { value: "dark", icon: "theme_dark", labelKey: "settings.modeDark" },
  { value: "system", icon: "desktop", labelKey: "settings.modeSystem" },
] as const;

function ThemeModePills({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center rounded-lg border border-border/50 p-1 gap-1" role="radiogroup">
      {MODE_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <Button
            key={opt.value}
            variant="ghost"
            size="sm"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all h-auto",
              selected
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <CodePilotIcon name={opt.icon} size="sm" aria-hidden />
            {t(opt.labelKey)}
          </Button>
        );
      })}
    </div>
  );
}

// ── Shiki Code Preview ──────────────────────────────────────────────

const PREVIEW_CODE = `function greet(name: string) {
  const time = new Date().getHours();
  if (time < 12) return \`Good morning, \${name}\`;
  return \`Hello, \${name}\`;
}`;

function ShikiCodePreview({ isDark }: { isDark: boolean }) {
  const { family, families } = useThemeFamily();
  const shikiMapping = resolveShikiTheme(families, family);
  const { light, dark } = resolveShikiThemes(shikiMapping);
  const theme: BundledTheme = isDark ? dark : light;
  const [html, setHtml] = useState("");

  // Phase 5B — this preview stays on the main thread on purpose (it is NOT
  // routed through the shiki Web Worker). Rationale: it's a single tiny,
  // one-shot snippet rendered only while the Appearance settings page is open,
  // not the streaming chat hot path the worker offload targets; and it needs
  // an HTML string for dangerouslySetInnerHTML, whereas the worker returns
  // structured tokens (a different shape). Keeping codeToHtml here avoids
  // widening the worker's surface and leaves this file's single HTML-injection
  // path unchanged. If this ever becomes a hot path, migrate it to the
  // token-based CodeBlock renderer rather than adding an HTML RPC.
  useEffect(() => {
    let cancelled = false;
    codeToHtml(PREVIEW_CODE, {
      lang: "typescript",
      theme,
    }).then((result) => {
      if (!cancelled) setHtml(result);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [theme]);

  return (
    <div className="rounded-md border border-border/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 text-xs bg-muted text-muted-foreground">
        <span className="font-medium">preview.ts</span>
        <span className="rounded bg-accent px-1.5 py-0.5 text-accent-foreground">TypeScript</span>
      </div>
      {html ? (
        <div
          className="shiki-preview [&_pre]:!m-0 [&_pre]:!rounded-none [&_pre]:!text-xs [&_pre]:!leading-relaxed [&_pre]:!p-2 [&_code]:!text-xs"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">
          Loading…
        </div>
      )}
    </div>
  );
}

// ── UI Token Preview ────────────────────────────────────────────────

function UIPreview() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" className="text-xs h-auto py-1">Primary</Button>
      <Button size="sm" variant="secondary" className="text-xs h-auto py-1">Secondary</Button>
      <Button size="sm" variant="destructive" className="text-xs h-auto py-1">Destructive</Button>
      <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-medium text-accent-foreground">
        Badge
      </span>
      <span className="inline-flex items-center rounded-full border border-border/50 bg-card px-2.5 py-0.5 text-[10px] text-card-foreground">
        Card
      </span>
      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[10px] text-muted-foreground">
        Muted
      </span>
    </div>
  );
}

// ── Main Appearance Section ─────────────────────────────────────────

/** Persist theme setting to DB so it survives across sessions */
function persistThemeSetting(key: string, value: string) {
  fetch('/api/settings/app', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings: { [key]: value } }),
  }).catch(() => { /* best-effort */ });
}

export function AppearanceSection() {
  const { theme, setTheme: setThemeRaw, resolvedTheme } = useTheme();
  const { family, setFamily: setFamilyRaw, families } = useThemeFamily();
  const { t } = useTranslation();
  const isDark = resolvedTheme === "dark";
  const fontStyleRef = useRef<HTMLStyleElement | null>(null);

  const [uiFontFamily, setUiFontFamily] = useState("");
  const [codeFontFamily, setCodeFontFamily] = useState("");
  const [uiFontSize, setUiFontSize] = useState("14");
  const [codeFontSize, setCodeFontSize] = useState("13");

  useEffect(() => {
    fetch("/api/settings/app")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.settings) {
          if (data.settings.ui_font_family) setUiFontFamily(data.settings.ui_font_family);
          if (data.settings.code_font_family) setCodeFontFamily(data.settings.code_font_family);
          if (data.settings.ui_font_size) setUiFontSize(data.settings.ui_font_size);
          if (data.settings.code_font_size) setCodeFontSize(data.settings.code_font_size);
        }
      })
      .catch(() => {});
  }, []);

  const updateFontCSS = useCallback((key: string, value: string) => {
    persistThemeSetting(key, value);
    // Live-update CSS in a dynamic style element
    if (!fontStyleRef.current) {
      const style = document.createElement("style");
      style.id = "font-vars-dynamic";
      document.head.appendChild(style);
      fontStyleRef.current = style;
    }
    const currentUiFF = key === "ui_font_family" ? value : uiFontFamily;
    const currentCodeFF = key === "code_font_family" ? value : codeFontFamily;
    const currentUiFS = key === "ui_font_size" ? value : uiFontSize;
    const currentCodeFS = key === "code_font_size" ? value : codeFontSize;
    const lines: string[] = [];
    if (currentUiFF) lines.push(`html { --font-sans: ${currentUiFF}, var(--font-geist-sans); }`);
    if (currentCodeFF) lines.push(`html { --font-mono: ${currentCodeFF}, var(--font-geist-mono); }`);
    const uiSize = parseInt(currentUiFS, 10) || 14;
    if (uiSize !== 14) {
      lines.push(`[data-app-shell] { zoom: ${(uiSize / 14).toFixed(3)}; }`);
    } else {
      // Reset zoom if back to default
      lines.push(`[data-app-shell] { zoom: 1; }`);
    }
    const codeSize = parseInt(currentCodeFS, 10) || 13;
    if (codeSize !== 13) {
      lines.push(`pre, code, kbd, samp { font-size: ${codeSize}px !important; }`);
    } else {
      lines.push(`pre, code, kbd, samp { font-size: 13px; }`);
    }
    fontStyleRef.current.textContent = lines.join("\n");
  }, [uiFontFamily, codeFontFamily, uiFontSize, codeFontSize]);

  const setTheme = useCallback((mode: string) => {
    setThemeRaw(mode);
    persistThemeSetting('theme_mode', mode);
  }, [setThemeRaw]);

  const setFamily = useCallback((id: string) => {
    setFamilyRaw(id);
    persistThemeSetting('theme_family', id);
  }, [setFamilyRaw]);

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Apply the initial font CSS on mount (from server-rendered settings)
  useEffect(() => {
    // Remove existing dynamic style to avoid duplicates
    const existing = document.getElementById("font-vars-dynamic");
    if (existing) existing.remove();
    fontStyleRef.current = null;
    // Trigger rebuild with loaded values
    if (uiFontFamily || codeFontFamily || uiFontSize !== "14" || codeFontSize !== "13") {
      updateFontCSS("", "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  return (
    // Top-level Settings page wrapper — matches RuntimePanel / ModelsSection
    // / GeneralSection. AppearanceSection used to render inline at the
    // bottom of GeneralSection; promotion to a sibling sidebar entry needs
    // its own page-shell width + spacing so it doesn't read as half-width.
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Section header — outside card */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{t("settings.appearance")}</h2>
        <p className="text-xs text-muted-foreground">{t("settings.appearanceDesc")}</p>
      </div>

      <SettingsCard>
      {/* Mode */}
      <FieldRow
        label={t("settings.themeMode")}
        description={t("settings.themeModeDesc")}
      >
        <ThemeModePills value={theme || "system"} onChange={setTheme} />
      </FieldRow>

      {theme === "system" && resolvedTheme && (
        <p className="text-[11px] text-muted-foreground pl-1">
          {resolvedTheme === "dark" ? t("settings.modeDark") : t("settings.modeLight")}
        </p>
      )}

      {/* Family */}
      <FieldRow
        label={t("settings.themeFamily")}
        description={t("settings.themeFamilyDesc")}
        separator
      >
        <Select value={family} onValueChange={setFamily}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {families.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                <span className="flex items-center gap-2">
                  {f.previewColors && (
                    <span className="flex gap-0.5">
                      <span
                        className="inline-block h-3 w-3 rounded-full border border-border/30"
                        style={{ background: f.previewColors.primaryLight }}
                      />
                      <span
                        className="inline-block h-3 w-3 rounded-full border border-border/30"
                        style={{ background: f.previewColors.primaryDark }}
                      />
                    </span>
                  )}
                  <span className="text-xs">{f.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      {/* UI Font Family */}
      <FieldRow
        label={t("settings.uiFontFamily")}
        description={t("settings.uiFontFamilyDesc")}
        separator
      >
        <Input
          className="w-[260px]"
          placeholder={t("settings.uiFontFamilyPlaceholder")}
          value={uiFontFamily}
          onChange={(e) => {
            setUiFontFamily(e.target.value);
            updateFontCSS("ui_font_family", e.target.value);
          }}
        />
      </FieldRow>

      {/* Code Font Family */}
      <FieldRow
        label={t("settings.codeFontFamily")}
        description={t("settings.codeFontFamilyDesc")}
      >
        <Input
          className="w-[260px]"
          placeholder={t("settings.codeFontFamilyPlaceholder")}
          value={codeFontFamily}
          onChange={(e) => {
            setCodeFontFamily(e.target.value);
            updateFontCSS("code_font_family", e.target.value);
          }}
        />
      </FieldRow>

      {/* UI Font Size */}
      <FieldRow
        label={t("settings.uiFontSize")}
        description={t("settings.uiFontSizeDesc")}
      >
        <Input
          className="w-[100px]"
          type="number"
          min="10"
          max="24"
          value={uiFontSize}
          onChange={(e) => {
            setUiFontSize(e.target.value);
            updateFontCSS("ui_font_size", e.target.value);
          }}
        />
      </FieldRow>

      {/* Code Font Size */}
      <FieldRow
        label={t("settings.codeFontSize")}
        description={t("settings.codeFontSizeDesc")}
      >
        <Input
          className="w-[100px]"
          type="number"
          min="10"
          max="24"
          value={codeFontSize}
          onChange={(e) => {
            setCodeFontSize(e.target.value);
            updateFontCSS("code_font_size", e.target.value);
          }}
        />
      </FieldRow>

      {/* Preview */}
      <div className="mt-6 space-y-3">
        <h3 className="text-xs font-medium text-muted-foreground">Preview</h3>
        <UIPreview />
        <ShikiCodePreview isDark={isDark} />
      </div>
      </SettingsCard>
    </div>
  );
}

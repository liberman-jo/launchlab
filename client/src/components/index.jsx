import { useState } from "react";

// ── DESIGN TOKENS ──────────────────────────────────────────────────────────────
export const C = {
  bg:      "#FAFAF9", surface: "#FFFFFF", dark:    "#111113",
  border:  "#E5E5E3", text:    "#1A1A1E", muted:   "#6B7280", subtle: "#9CA3AF",
  disc:    "#5B42C0", discBg:  "#EEE9F8",
  crea:    "#0369A1", creaBg:  "#E0F2FE",
  mktg:    "#B45309", mktgBg:  "#FEF3C7",
  mgmt:    "#047857", mgmtBg:  "#ECFDF5",
  ok:      "#10B981", okBg:    "#D1FAE5",
  warn:    "#F59E0B", warnBg:  "#FEF3C7",
  err:     "#EF4444", errBg:   "#FEF2F2",
  auto:    "#7C5FE6", autoBg:  "#F0EDFF",
};

export const FH = "var(--font-head)";
export const FB = "var(--font-body)";

// shadow-based cards instead of border cards
const shadow = "0 0 0 1px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.06)";
const shadowMd = "0 0 0 1px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08)";

// ── STYLE HELPERS ──────────────────────────────────────────────────────────────
export const card  = (p = "20px 24px", extra = {}) => ({ background: C.surface, borderRadius: 12, boxShadow: shadow, padding: p, ...extra });
export const cardMd = (p = "20px 24px", extra = {}) => ({ background: C.surface, borderRadius: 14, boxShadow: shadowMd, padding: p, ...extra });
export const btn   = (bg, fg = "#fff", sz = 14) => ({ background: bg, color: fg, border: "none", borderRadius: 8, padding: "9px 18px", fontSize: sz, fontWeight: 600, cursor: "pointer", fontFamily: FB, letterSpacing: "-0.1px", transition: "opacity 0.15s" });
export const btnSm = (bg, fg = "#fff") => ({ background: bg, color: fg, border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FB });
export const btnO  = (clr, sz = 13) => ({ background: "transparent", color: clr, border: `1.5px solid ${clr}30`, borderRadius: 7, padding: "7px 14px", fontSize: sz, fontWeight: 500, cursor: "pointer", fontFamily: FB });
export const inp   = (extra = {}) => ({ width: "100%", padding: "9px 13px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: FB, color: C.text, background: C.surface, outline: "none", boxSizing: "border-box", ...extra });
export const badge = (clr, bg, sz = 10) => ({ background: bg, color: clr, fontSize: sz, fontWeight: 600, padding: "3px 9px", borderRadius: 20, display: "inline-block", textTransform: "uppercase", letterSpacing: "0.3px", fontFamily: FB, whiteSpace: "nowrap" });
export const lbl   = { fontSize: 11, fontWeight: 600, display: "block", marginBottom: 7, color: C.muted, fontFamily: FB, textTransform: "uppercase", letterSpacing: "0.4px" }; // alias for backward compat
export const H1    = { fontFamily: FH, fontWeight: 700, fontSize: 32, color: C.text, letterSpacing: "-0.5px", lineHeight: 1.15 };
export const H2    = { fontFamily: FH, fontWeight: 700, fontSize: 24, color: C.text, letterSpacing: "-0.3px" };
export const label = { fontSize: 11, fontWeight: 600, display: "block", marginBottom: 7, color: C.muted, fontFamily: FB, textTransform: "uppercase", letterSpacing: "0.4px" };
export const hint  = { fontSize: 12, color: C.muted, marginTop: 5, fontFamily: FB, lineHeight: 1.5 };

// ── TAG INPUT ──────────────────────────────────────────────────────────────────
export function TagInput({ tags = [], onChange, placeholder = "Type and press Enter", color = C.disc }) {
  const [val, setVal] = useState("");
  const add = () => { const v = val.trim(); if (v && !tags.includes(v)) onChange([...tags, v]); setVal(""); };
  return (
    <div style={{ border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", background: C.surface, minHeight: 50 }}>
      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {tags.map(t => (
            <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 12px", borderRadius: 20, background: color + "18", color, fontSize: 13, fontFamily: FB }}>
              {t}<span onClick={() => onChange(tags.filter(x => x !== t))} style={{ cursor: "pointer", fontSize: 15, lineHeight: 1, opacity: 0.6, fontWeight: 600 }}>&#215;</span>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} placeholder={placeholder}
          style={{ border: "none", outline: "none", flex: 1, fontSize: 14, fontFamily: FB, color: C.text, background: "transparent", padding: "2px 0" }} />
        {val.trim() && <button onClick={add} style={{ ...btn(color, "#fff", 12), padding: "3px 10px", flexShrink: 0 }}>Add</button>}
      </div>
    </div>
  );
}

// ── SCORE BAR ─────────────────────────────────────────────────────────────────
export function ScoreBar({ label: lbl, value, color = C.disc }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: C.muted, fontFamily: FB }}>{lbl}</span>
        <span style={{ fontWeight: 600, color: C.text, fontFamily: FB }}>{Number(value).toFixed(1)}/10</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: C.border }}>
        <div style={{ height: "100%", width: `${Number(value) * 10}%`, background: color, borderRadius: 2, transition: "width 0.6s" }} />
      </div>
    </div>
  );
}

// ── SPINNER ───────────────────────────────────────────────────────────────────
export function Spinner({ color = C.disc, size = 36 }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", border: `2.5px solid ${color}20`, borderTopColor: color, animation: "spin 0.85s linear infinite", flexShrink: 0 }} />;
}

// ── ERROR BOX ─────────────────────────────────────────────────────────────────
export function ErrorBox({ msg, onRetry }) {
  if (!msg) return null;
  return (
    <div style={{ ...card("13px 16px"), background: C.errBg, boxShadow: `0 0 0 1px ${C.err}20`, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 16 }}>⚠</span>
      <div style={{ fontSize: 13, color: C.err, flex: 1, fontFamily: FB }}>{msg}</div>
      {onRetry && <button onClick={onRetry} style={{ ...btnSm(C.err), flexShrink: 0 }}>Dismiss</button>}
    </div>
  );
}

// ── WORKFLOW RAIL ─────────────────────────────────────────────────────────────
export function WorkflowRail({ currentStage, completedStages = [], businessName, userName, onNavigate }) {
  const stages = [
    { key: "discovery", label: "Discovery" },
    { key: "creation",  label: "Setup"     },
    { key: "hub",       label: "Hub"       },
  ];
  const stageClr = { discovery: C.disc, creation: C.crea, hub: C.mgmt };

  return (
    <div style={{ width: 210, background: C.dark, minHeight: "100vh", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid #ffffff08" }}>
        <div style={{ fontFamily: FH, fontWeight: 400, fontSize: 18, color: "#fff", letterSpacing: "-0.3px" }}>LaunchLab</div>
        {userName && <div style={{ fontSize: 11, color: "#ffffff35", marginTop: 4, fontFamily: FB }}>{userName}</div>}
      </div>
      <div style={{ flex: 1, padding: "12px 10px" }}>
        {stages.map((stage, si) => {
          const active = stage.key === currentStage;
          const done   = completedStages.includes(stage.key);
          const locked = si > 0 && !completedStages.includes("discovery");
          return (
            <div key={stage.key} onClick={() => !locked && onNavigate?.(stage.key)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, background: active ? "#ffffff10" : "transparent", cursor: locked ? "default" : "pointer", marginBottom: 2 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, fontFamily: FB, color: "#fff", background: done ? C.ok : active ? stageClr[stage.key] : "transparent", border: `1.5px solid ${done ? C.ok : active ? stageClr[stage.key] : "#ffffff15"}` }}>
                {done ? "✓" : si + 1}
              </div>
              <span style={{ fontSize: 13, fontWeight: active ? 500 : 400, color: locked ? "#ffffff15" : active ? "#fff" : "#ffffff55", fontFamily: FB }}>{stage.label}</span>
            </div>
          );
        })}
      </div>
      {businessName && (
        <div style={{ padding: "12px 16px", borderTop: "1px solid #ffffff08" }}>
          <div style={{ fontSize: 10, color: "#ffffff20", textTransform: "uppercase", letterSpacing: "0.6px", fontFamily: FB, marginBottom: 4 }}>Business</div>
          <div style={{ fontSize: 13, color: "#ffffffcc", fontFamily: FB, lineHeight: 1.4 }}>{businessName}</div>
        </div>
      )}
    </div>
  );
}

// ── GUIDE PANEL ───────────────────────────────────────────────────────────────
export function GuidePanel({ onClose, onSend, messages = [] }) {
  const [input, setInput] = useState("");
  const send = () => { if (input.trim()) { onSend(input); setInput(""); } };
  return (
    <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 340, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", zIndex: 200, boxShadow: "-8px 0 40px rgba(0,0,0,0.08)" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: FH, fontWeight: 400, fontSize: 17 }}>AI Guide</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 18, width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>&#215;</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", background: m.role === "user" ? C.disc : C.bg, color: m.role === "user" ? "#fff" : C.text, padding: "10px 14px", borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", fontSize: 13, lineHeight: 1.55, fontFamily: FB }}>
            {m.text}
          </div>
        ))}
      </div>
      <div style={{ padding: 12, borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask anything..." style={{ ...inp(), flex: 1, fontSize: 13, padding: "9px 12px" }} />
        <button onClick={send} style={{ ...btn(C.disc, "#fff", 13), padding: "9px 14px" }}>→</button>
      </div>
    </div>
  );
}

// ── DOWNLOAD BUTTON ───────────────────────────────────────────────────────────
export function DownloadBtn({ content, filename, label = "Download", mimeType = "text/html" }) {
  const download = () => {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };
  return <button onClick={download} style={btn(C.dark)}>{label}</button>;
}

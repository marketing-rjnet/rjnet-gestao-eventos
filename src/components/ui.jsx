import React, { useRef, useEffect } from 'react';
import { Chart } from 'chart.js';
import { STATUS_LABEL, tipoLabel } from '../utils/format';

/* ============================================================
   SVG ICON SYSTEM — stroke-based, geometric, clean
   ============================================================ */
export const Icon = ({ name, size = 16, stroke = "currentColor", strokeWidth = 1.6 }) => {
  const s = { width: size, height: size, display: "inline-block", verticalAlign: "middle", flexShrink: 0 };
  const p = { fill: "none", stroke, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    calendar: <svg style={s} viewBox="0 0 24 24" {...p}><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>,
    box: <svg style={s} viewBox="0 0 24 24" {...p}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
    users: <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></svg>,
    briefcase: <svg style={s} viewBox="0 0 24 24" {...p}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="12"/><line x1="2" y1="12" x2="22" y2="12"/></svg>,
    pin: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    sun: <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    moon: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
    x: <svg style={s} viewBox="0 0 24 24" {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    back: <svg style={s} viewBox="0 0 24 24" {...p}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
    plus: <svg style={s} viewBox="0 0 24 24" {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    dot_green: <svg style={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="#22c55e"/></svg>,
    dot_yellow: <svg style={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="#ffcb00"/></svg>,
    dot_red: <svg style={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="#ef4444"/></svg>,
    chart: <svg style={s} viewBox="0 0 24 24" {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
    person: <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="8" r="4"/><path d="M4 20v-1a8 8 0 0 1 16 0v1"/></svg>,
    arrow_right: <svg style={s} viewBox="0 0 24 24" {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
    search: <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    check_circle: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    x_circle: <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
    activity: <svg style={s} viewBox="0 0 24 24" {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  };
  return paths[name] || null;
};

/* ============================================================
   STATUS / TIPO BADGES
   ============================================================ */
export const StatusBadge = ({ s }) => (
  <span className={"badge badge-" + s}>{STATUS_LABEL[s] || s}</span>
);

export const TipoBadge = ({ t }) => (
  <span className="badge badge-tipo">{tipoLabel(t)}</span>
);

/* ============================================================
   KPI CARD
   ============================================================ */
export function Kpi({ label, value, icon, alert }) {
  return (
    <div className={"kpi" + (alert ? " alert" : "")}>
      <div className="kpi-label">{icon && <Icon name={icon} size={14} stroke="var(--text-3)" />}{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

/* ============================================================
   CHART WRAPPER (useEffect + useRef + destroy cleanup)
   ============================================================ */
export function ChartView({ type, data, options }) {
  const ref = useRef(null);
  const inst = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    inst.current = new Chart(ref.current, {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...options,
      },
    });
    return () => { if (inst.current) inst.current.destroy(); };
  }, [JSON.stringify(data), type, JSON.stringify(options)]);
  return <canvas ref={ref} />;
}

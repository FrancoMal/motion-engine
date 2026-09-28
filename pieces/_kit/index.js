// Lámina de control del kit de UI (no entregable): todos los componentes en un
// frame para compararlos con las capturas reales de la app.

import { tween, E } from "../../engine/ease.js";
import { drawText } from "../../engine/text.js";
import { C, card, chip, avatar, button, tag, checkbox, progressBar, paragraph, appIcon, phone, notification, icon } from "../../shared/ui.js";

function draw(ctx, t) {
  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 0, 1920, 1080);
  card(ctx, 80, 80, 820, 560);
  drawText(ctx, "Aceptación de normas grupales", 120, 150, { size: 30, weight: 700 }, { color: C.ink });
  drawText(ctx, "SUGERENCIAS", 120, 200, { size: 18, weight: 700, tracking: 0.08 }, { color: C.inkMute });
  let y = 225;
  const sug = [
    "Respeta las normas acordadas con iniciativa y sin necesidad de recordatorios.",
    "Cumple las normas de la sala en la mayoría de las situaciones.",
    "Cumple las normas cuando se le recuerdan y necesita apoyo.",
  ];
  sug.forEach((s, i) => {
    const r = chip(ctx, 120, y, s, { size: 25, selected: i === 0 ? tween(t, 0, 20, 0, 1, E.outCubic) : 0, maxWidth: 740 });
    y += r.h + 14;
  });
  avatar(ctx, 1000, 140, 34, "LF", { bg: C.ink, ring: C.accent });
  avatar(ctx, 1085, 140, 34, "LM", { bg: C.card, color: C.ink, ring: C.border, ringWidth: 2 });
  avatar(ctx, 1170, 140, 34, "SB");
  button(ctx, 1000, 220, 330, 76, "Generar informe", { iconName: "arrow-right" });
  button(ctx, 1350, 220, 260, 76, "Anterior", { variant: "outline", iconName: "arrow-left", iconSide: "left" });
  tag(ctx, 1000, 330, "listo");
  tag(ctx, 1100, 330, "en curso", { tone: "accent", upper: true });
  checkbox(ctx, 1300, 330, 40, 1);
  checkbox(ctx, 1360, 330, 40, 0);
  progressBar(ctx, 1000, 400, 600, 12, 0.62, { glow: 1 });
  icon(ctx, "sparkles", 1660, 250, 48, { color: C.accent });
  card(ctx, 80, 690, 820, 330);
  drawText(ctx, "Formación Personal y Social", 120, 755, { size: 30, weight: 700 }, { color: C.ink });
  paragraph(ctx, "Sofía participa activamente de las propuestas de rutina de la sala, aceptando las mismas como acuerdos grupales. Sofía se muestra cercana a su maestra.", 120, 820, 740, { size: 27, weight: 450 }, { color: C.ink, highlight: ["Sofía"] });
  phone(ctx, 1000, 460, 300, 600, (c, w, h) => {
    c.fillStyle = C.surface;
    c.fillRect(0, 0, w, h);
    notification(c, 14, 60, w - 28, { body: "Ya están listos tus 12 informes." });
  });
  appIcon(ctx, 1500, 700, 160);
  notification(ctx, 1380, 850, 500, { body: "Ya están listos tus 12 informes." });
}

export default { id: "_kit", width: 1920, height: 1080, fps: 30, duration: 30, draw, motion: () => ({ samples: 1, shutter: 0 }) };

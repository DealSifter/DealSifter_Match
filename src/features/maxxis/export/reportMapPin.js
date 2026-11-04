/** Display only: the tip stays at the existing plotted coordinate. */
export function drawReportMapPin(context, { x, y, marker, color }) {
  const subject = marker === 'S', radius = subject ? 14 : 12, cy = y - 15;
  context.save();
  context.shadowColor = 'rgba(15,32,49,.35)'; context.shadowBlur = 5; context.shadowOffsetY = 2;
  context.fillStyle = color; context.strokeStyle = '#fff'; context.lineWidth = 3;
  context.beginPath(); context.moveTo(x, y); context.lineTo(x - radius * .809, cy + radius * .588);
  context.arc(x, cy, radius, Math.PI * .8, Math.PI * 2.2); context.lineTo(x, y); context.closePath();
  context.fill(); context.stroke(); context.restore();
  context.fillStyle = '#fff';
  if (subject) {
    context.beginPath(); context.moveTo(x - 9, cy - 1); context.lineTo(x, cy - 9); context.lineTo(x + 9, cy - 1);
    context.lineTo(x + 6, cy - 1); context.lineTo(x + 6, cy + 8); context.lineTo(x - 6, cy + 8); context.lineTo(x - 6, cy - 1); context.closePath(); context.fill();
    context.fillStyle = color; context.fillRect(x - 2, cy + 1, 4, 7);
  } else {
    context.font = '700 14px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(marker, x, cy);
  }
}

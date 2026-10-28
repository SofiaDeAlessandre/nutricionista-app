// Helpers de formato compartidos.

// '2026-10-15' -> '15 de octubre de 2026'
export function fechaLarga(fecha) {
  if (!fecha) return '';
  return new Date(fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function tamanoLabel(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
  return Math.max(1, Math.round(n / 1024)) + ' KB';
}

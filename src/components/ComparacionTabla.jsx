import { MEDIDA_CAMPOS, formatMedida } from '../data/patients.js';
import { fechaLarga } from '../lib/format.js';

const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

// 'Peso (kg)' -> { nombre: 'Peso', unidad: 'kg' }
function partirLabel(label) {
  const m = label.match(/^(.*?)\s*\((.*)\)$/);
  return m ? { nombre: m[1], unidad: m[2] } : { nombre: label, unidad: '' };
}

const fechaCorta = (f) => new Date(f + 'T00:00:00').toLocaleDateString('es-AR');

function fmt(campo, n, conMinimo = true) {
  const dec = campo.decimales ?? 0;
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: conMinimo ? dec : 0,
    maximumFractionDigits: campo.decimales ?? 1,
  });
}

// Compara dos mediciones: siempre toma la más antigua como punto de partida,
// aunque se hayan elegido al revés. Diferencia = posterior − anterior.
export function calcularComparacion(x, y) {
  const [a, b] = x.fecha <= y.fecha ? [x, y] : [y, x];
  const dias = Math.round((new Date(b.fecha + 'T00:00:00') - new Date(a.fecha + 'T00:00:00')) / 86400000);
  const filas = MEDIDA_CAMPOS.map((campo) => {
    const va = num(a[campo.key]);
    const vb = num(b[campo.key]);
    let diff = null;
    let pct = null;
    if (va !== null && vb !== null) {
      diff = Math.round((vb - va) * 100) / 100;
      pct = va !== 0 ? Math.round(((vb - va) / va) * 1000) / 10 : null;
    }
    return { campo, ...partirLabel(campo.label), va, vb, diff, pct };
  });
  return { a, b, dias, filas };
}

export default function ComparacionTabla({ a: x, b: y }) {
  const { a, b, dias, filas } = calcularComparacion(x, y);
  return (
    <div className="comp-wrap">
      <p className="comp-rango">
        {fechaLarga(a.fecha)} → {fechaLarga(b.fecha)}
        <span> · {dias === 0 ? 'mismo día' : dias === 1 ? '1 día' : dias + ' días'} entre mediciones</span>
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="comp-tabla">
          <thead>
            <tr>
              <th>Medida</th>
              <th>{fechaCorta(a.fecha)}</th>
              <th>{fechaCorta(b.fecha)}</th>
              <th>Diferencia</th>
              <th>Variación</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const dir = f.diff === null ? 'na' : f.diff > 0 ? 'sube' : f.diff < 0 ? 'baja' : 'igual';
              return (
                <tr key={f.campo.key}>
                  <td className="comp-medida">{f.nombre}</td>
                  <td data-label={fechaCorta(a.fecha)}>{formatMedida(f.campo, f.va)}{f.va !== null && f.unidad ? ' ' + f.unidad : ''}</td>
                  <td data-label={fechaCorta(b.fecha)}>{formatMedida(f.campo, f.vb)}{f.vb !== null && f.unidad ? ' ' + f.unidad : ''}</td>
                  <td data-label="Diferencia" className={'comp-dif ' + dir}>
                    {dir === 'na' && '—'}
                    {dir === 'igual' && '= Sin cambios'}
                    {dir === 'sube' && `▲ Subió ${fmt(f.campo, f.diff)} ${f.unidad}`}
                    {dir === 'baja' && `▼ Bajó ${fmt(f.campo, Math.abs(f.diff))} ${f.unidad}`}
                  </td>
                  <td data-label="Variación" className={'comp-pct ' + dir}>
                    {f.pct === null ? '—' : (f.pct > 0 ? '+' : f.pct < 0 ? '−' : '') + Math.abs(f.pct).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' %'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

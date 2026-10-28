import { useState } from 'react';
import { descargarPlan } from '../lib/api.js';
import { fechaLarga, tamanoLabel } from '../lib/format.js';

// Lista de planes de alimentación (archivos). La usan la nutricionista (con
// "Eliminar") y el paciente (solo "Descargar").
export default function PlanesLista({ planes, onEliminar, vacio }) {
  const [bajando, setBajando] = useState(null);
  const [error, setError] = useState('');

  async function bajar(p) {
    setError('');
    setBajando(p.id);
    try {
      await descargarPlan(p);
    } catch (err) {
      console.error(err);
      setError('No se pudo descargar el archivo. Probá de nuevo.');
    } finally {
      setBajando(null);
    }
  }

  if (!planes.length) return <p className="turno-empty">{vacio}</p>;

  return (
    <>
      {error && <p className="login-error">{error}</p>}
      <div className="plan-lista">
        {planes.map((p, i) => (
          <div key={p.id} className={'plan-item' + (i === 0 ? ' ultimo' : '')}>
            <div className="plan-ic">📄</div>
            <div className="plan-info">
              <b>
                {fechaLarga(p.fecha)}
                {i === 0 && <span className="plan-badge">Último plan</span>}
              </b>
              <span>{p.nombre} · {tamanoLabel(p.tamano)}</span>
            </div>
            <div className="plan-acciones">
              <button type="button" className="btn-sm" onClick={() => bajar(p)} disabled={bajando === p.id}>
                {bajando === p.id ? 'Descargando…' : '⬇ Descargar'}
              </button>
              {onEliminar && (
                <button type="button" className="btn-sm danger" onClick={() => onEliminar(p)}>
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

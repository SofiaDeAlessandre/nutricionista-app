import { useMemo, useState } from 'react';
import { MONTH_NAMES, fechaKey } from '../data/patients.js';

const AHORA = new Date();
const HOY_ISO = fechaKey(AHORA.getFullYear(), AHORA.getMonth(), AHORA.getDate());
const MES_ACTUAL = HOY_ISO.slice(0, 7); // 'YYYY-MM'

const peso = (n) =>
  n == null ? '—' : '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 });

// Montos en pesos: "30.000" y "30000" valen 30000; "30.000,50" vale 30000,5.
// El punto se toma como separador de miles (lo normal al escribir plata en Argentina),
// salvo que haya decimales claros ("30.5"). Devuelve NaN si no se entiende.
function parseMonto(texto) {
  let t = String(texto ?? '').trim().replace(/[$\s]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  return Number(t);
}

// Para el porcentaje: acepta coma o punto como decimal ("60" o "62,5").
function parsePorcentaje(texto) {
  const t = String(texto ?? '').trim().replace('%', '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  return Number(t);
}

const montoATexto = (n) => (n == null || Number.isNaN(n) ? '' : n.toLocaleString('es-AR', { maximumFractionDigits: 2 }));
const num1 = (n) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });

function nombreMes(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function mesAnterior(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Valores que rigen en un mes: los de la fila de ese mes o, si no hay, los de
// la fila más reciente anterior. Así alcanza con cargar los valores cuando cambian.
function configPara(config, ym) {
  let vigente = null;
  for (const c of config) {
    if (c.mes.slice(0, 7) <= ym) vigente = c;
  }
  return vigente;
}

function FormConfig({ ym, cfg, onGuardar }) {
  const [valorConsulta, setValorConsulta] = useState(cfg ? montoATexto(cfg.valorConsulta) : '');
  const [valorControl, setValorControl] = useState(cfg ? montoATexto(cfg.valorControl) : '');
  const [porcentaje, setPorcentaje] = useState(cfg ? montoATexto(cfg.porcentaje) : '');
  const [estado, setEstado] = useState(''); // '' | 'guardando' | 'ok' | 'error'

  async function guardar(e) {
    e.preventDefault();
    const vc = parseMonto(valorConsulta);
    const vk = parseMonto(valorControl);
    const pc = parsePorcentaje(porcentaje);
    if ([vc, vk, pc].some((n) => Number.isNaN(n) || n < 0) || pc > 100) {
      setEstado('error');
      return;
    }
    setEstado('guardando');
    try {
      await onGuardar({ mes: ym + '-01', valorConsulta: vc, valorControl: vk, porcentaje: pc });
      setEstado('ok');
    } catch (err) {
      console.error(err);
      setEstado('error');
    }
  }

  return (
    <form className="ing-cfg" onSubmit={guardar}>
      <div className="field">
        <label>Valor primera consulta ($)</label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="30.000"
          value={valorConsulta}
          onChange={(e) => { setValorConsulta(e.target.value); setEstado(''); }}
          onBlur={() => { const n = parseMonto(valorConsulta); if (!Number.isNaN(n)) setValorConsulta(montoATexto(n)); }}
          required
        />
      </div>
      <div className="field">
        <label>Valor control ($)</label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="20.000"
          value={valorControl}
          onChange={(e) => { setValorControl(e.target.value); setEstado(''); }}
          onBlur={() => { const n = parseMonto(valorControl); if (!Number.isNaN(n)) setValorControl(montoATexto(n)); }}
          required
        />
      </div>
      <div className="field">
        <label>% que te corresponde</label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="60"
          value={porcentaje}
          onChange={(e) => { setPorcentaje(e.target.value); setEstado(''); }}
          required
        />
      </div>
      <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '13px 22px' }} disabled={estado === 'guardando'}>
        {estado === 'guardando' ? 'Guardando…' : 'Guardar valores'}
      </button>
      {estado === 'ok' && <span className="saved-msg">✓ Guardado</span>}
      {estado === 'error' && <span className="login-error">Revisá los números: los valores en pesos (ej: 30.000) y el % de 0 a 100 (ej: 60). Si sigue fallando, probá de nuevo.</span>}
    </form>
  );
}

export default function Ingresos({ patients, config, loadError, onGuardarConfig }) {
  const [ym, setYm] = useState(MES_ACTUAL);

  // Una fila por mes, desde la primera consulta registrada hasta el mes actual.
  const meses = useMemo(() => {
    // Se cuentan las consultas registradas en la solapa "Consultas" de cada paciente.
    const consultas = Object.values(patients).flatMap((p) => p.consultas || []);

    const porMes = {};
    consultas.forEach((c) => {
      const k = c.fecha.slice(0, 7);
      porMes[k] = porMes[k] || { total: 0, primeras: 0, controles: 0 };
      porMes[k].total += 1;
      if (c.tipo === 'primera') porMes[k].primeras += 1;
      else if (c.tipo === 'control') porMes[k].controles += 1;
    });

    const keys = Object.keys(porMes).sort();
    const desde = keys.length ? keys[0] : MES_ACTUAL;
    const lista = [];
    for (let k = desde; k <= MES_ACTUAL; k = mesAnterior(k, 1)) {
      const c = porMes[k] || { total: 0, primeras: 0, controles: 0 };
      const cfg = configPara(config, k);
      const facturado = cfg ? c.primeras * cfg.valorConsulta + c.controles * cfg.valorControl : null;
      const tuParte = cfg ? (facturado * cfg.porcentaje) / 100 : null;
      lista.push({ ym: k, ...c, cfg, facturado, tuParte });
    }
    return lista;
  }, [patients, config]);

  const sel = meses.find((m) => m.ym === ym) || {
    ym, total: 0, primeras: 0, controles: 0, cfg: configPara(config, ym), facturado: null, tuParte: null,
  };
  const selCfg = configPara(config, ym);
  const selFacturado = selCfg ? sel.primeras * selCfg.valorConsulta + sel.controles * selCfg.valorControl : null;
  const selTuParte = selCfg ? (selFacturado * selCfg.porcentaje) / 100 : null;

  // Promedio mensual: sobre los meses que tuvieron al menos una consulta.
  const activos = meses.filter((m) => m.total > 0);
  const prom = (campo) => (activos.length ? activos.reduce((s, m) => s + m[campo], 0) / activos.length : 0);
  const conPlata = activos.filter((m) => m.tuParte != null);
  const promPlata = (campo) => (conPlata.length ? conPlata.reduce((s, m) => s + m[campo], 0) / conPlata.length : null);

  return (
    <div className="page">
      <div className="ing-top">
        <h1>Ingresos</h1>
        <div className="monthbar" style={{ margin: 0 }}>
          <span className="navbtn" onClick={() => setYm(mesAnterior(ym, -1))}>‹</span>
          <b>{nombreMes(ym)}</b>
          <span className="navbtn" onClick={() => setYm(mesAnterior(ym, 1))}>›</span>
        </div>
      </div>

      {loadError && <p className="ing-warn">{loadError}</p>}

      <div className="ing-grid">
        <div className="ing-stat"><span>Total de consultas</span><b>{sel.total}</b></div>
        <div className="ing-stat"><span>Primeras consultas</span><b>{sel.primeras}</b></div>
        <div className="ing-stat"><span>Controles</span><b>{sel.controles}</b></div>
        <div className="ing-stat"><span>Facturado en el mes</span><b>{peso(selFacturado)}</b></div>
        <div className="ing-stat destacado"><span>Te corresponde{selCfg ? ` (${num1(selCfg.porcentaje)}%)` : ''}</span><b>{peso(selTuParte)}</b></div>
      </div>

      <div className="ing-section">
        <h4>Valores de {nombreMes(ym)}</h4>
        <p className="edit-hint">
          Cargá los valores que rigen desde este mes. Si no los cambiás, los meses siguientes usan estos mismos hasta que cargues otros.
        </p>
        <FormConfig key={ym + JSON.stringify(selCfg)} ym={ym} cfg={selCfg} onGuardar={onGuardarConfig} />
      </div>

      <div className="ing-section">
        <h4>Mes por mes</h4>
        <p className="edit-hint">Se cuentan las consultas que registrás en la solapa Consultas de cada paciente. Cada mes usa los valores que regían en ese momento.</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="ing-table">
            <thead>
              <tr>
                <th>Mes</th><th>Total</th><th>Primeras</th><th>Controles</th><th>Facturado</th><th>Te corresponde</th>
              </tr>
            </thead>
            <tbody>
              {[...meses].reverse().map((m) => (
                <tr key={m.ym}>
                  <td>{nombreMes(m.ym)}</td>
                  <td data-label="Total">{m.total}</td>
                  <td data-label="Primeras">{m.primeras}</td>
                  <td data-label="Controles">{m.controles}</td>
                  <td data-label="Facturado">{peso(m.facturado)}</td>
                  <td data-label="Te corresponde">{peso(m.tuParte)}</td>
                </tr>
              ))}
              <tr className="prom">
                <td>Promedio mensual</td>
                <td data-label="Total">{num1(prom('total'))}</td>
                <td data-label="Primeras">{num1(prom('primeras'))}</td>
                <td data-label="Controles">{num1(prom('controles'))}</td>
                <td data-label="Facturado">{peso(promPlata('facturado'))}</td>
                <td data-label="Te corresponde">{peso(promPlata('tuParte'))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

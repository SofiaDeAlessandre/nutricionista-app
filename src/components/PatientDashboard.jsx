import { useState } from 'react';
import PlanesLista from './PlanesLista.jsx';
import ComparacionTabla from './ComparacionTabla.jsx';
import { fechaLarga } from '../lib/format.js';
import {
  MEAL_ORDER, MEAL_LABELS, registroDelDia, statusForDay, fechaKey,
  TODAY, MONTH_NAMES, DAY_LETTERS, daysInMonth, firstWeekdayMonday,
  columnasMedidas, formatMedida,
} from '../data/patients.js';

const ICONS = { desayuno: '☀️', colacion: '🍎', almuerzo: '🍽️', merienda: '🍪', cena: '🌙' };
const HOY_KEY = fechaKey(TODAY.year, TODAY.month, TODAY.day);
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function fechaHoyLabel() {
  const d = new Date(TODAY.year, TODAY.month, TODAY.day);
  const nombreDia = DIAS_SEMANA[d.getDay()];
  return `${nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1)} ${TODAY.day} de ${MONTH_NAMES[TODAY.month].toLowerCase()}`;
}

// Calendario real del mes (no una lista fija de días) — así cualquier turno,
// caiga el día que caiga, se puede ver navegando el mes correspondiente.
function buildCalendarCells({ year, month, patient, selectedFecha, onSelect }) {
  const isCurrentMonth = year === TODAY.year && month === TODAY.month;
  const total = daysInMonth(year, month);
  const firstDay = firstWeekdayMonday(year, month);
  const turnos = patient.turnos || [];
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div key={'b' + i} className="cell blank" />);
  for (let d = 1; d <= total; d++) {
    const fecha = fechaKey(year, month, d);
    const isToday = isCurrentMonth && d === TODAY.day;
    const cls = isCurrentMonth ? statusForDay(patient, d) : 'm';
    const hasTurno = turnos.some((t) => t.fecha === fecha);
    cells.push(
      <div
        key={fecha}
        className={'cell' + (isToday ? ' today' : '') + (fecha === selectedFecha ? ' sel' : '') + (hasTurno ? ' turno' : '')}
        onClick={() => onSelect(fecha)}
      >
        <span>{d}</span>
        <span className={'dot ' + cls}></span>
      </div>
    );
  }
  return cells;
}

export default function PatientDashboard({ view, onChangeView, patient, onUpdatePatient }) {
  const primerNombre = patient.name.split(' ')[0];
  const [drafts, setDrafts] = useState({});
  const [calYear, setCalYear] = useState(TODAY.year);
  const [calMonth, setCalMonth] = useState(TODAY.month);
  const [calFecha, setCalFecha] = useState(HOY_KEY);

  const saved = patient.log || {};
  const filledCount = MEAL_ORDER.filter((k) => saved[k]).length;

  function saveMeal(k) {
    const txt = drafts[k];
    if (!txt) return;
    const time = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    onUpdatePatient((prev) => ({ log: { ...prev.log, [k]: { txt, time } } }));
  }

  const calReg = registroDelDia(patient, 2);
  const turnos = patient.turnos || [];
  const proximoTurno = turnos
    .filter((t) => t.fecha >= HOY_KEY)
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))[0];

  const calIsCurrentMonth = calYear === TODAY.year && calMonth === TODAY.month;
  const calSelectedDay = Number(calFecha.split('-')[2]);
  const calRegSeleccionado = calIsCurrentMonth && calSelectedDay === TODAY.day ? calReg : {};
  const calHasData = MEAL_ORDER.some((k) => calRegSeleccionado[k]);
  const turnoDelDiaSeleccionado = turnos.find((t) => t.fecha === calFecha);

  // Al abrir la pestaña "Calendario" (desde el menú, no desde el aviso de
  // arriba) llevamos directo al mes del próximo turno si hay uno — así el
  // paciente no tiene que ir adivinando a qué mes navegar para verlo.
  function irACalendario() {
    if (proximoTurno) {
      const [y, m] = proximoTurno.fecha.split('-').map(Number);
      setCalYear(y);
      setCalMonth(m - 1);
      setCalFecha(proximoTurno.fecha);
    }
    onChangeView('calendario');
  }

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); } else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); } else setCalMonth((m) => m + 1);
  }

  return (
    <div className="page">
      <div className="detalle-head" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Hola, <span style={{ color: 'var(--pink)' }}>{primerNombre}</span></h1>
          <p className="sub" style={{ margin: '4px 0 0' }}>{fechaHoyLabel()}</p>
        </div>
      </div>

      <div className="patient-nav">
        <button className={view === 'hoy' ? 'active' : ''} onClick={() => onChangeView('hoy')}>Hoy</button>
        <button className={view === 'calendario' ? 'active' : ''} onClick={irACalendario}>Calendario</button>
        <button className={view === 'plan' ? 'active' : ''} onClick={() => onChangeView('plan')}>Mi plan</button>
        <button className={view === 'medidas' ? 'active' : ''} onClick={() => onChangeView('medidas')}>Mediciones</button>
        <button className={view === 'reporte' ? 'active' : ''} onClick={() => onChangeView('reporte')}>Reporte de mediciones</button>
      </div>

      {view === 'hoy' && (
        <>
          {proximoTurno && (
            <button
              className="turno-chip turno-chip-btn"
              style={{ width: '100%', marginBottom: 20 }}
              onClick={irACalendario}
            >
              <span className="ic">📅</span>
              <div>
                <b>
                  {proximoTurno.fecha === HOY_KEY ? 'Turno hoy' : 'Próximo turno'} · {new Date(proximoTurno.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })} a las {proximoTurno.hora}
                </b>
                <span>{proximoTurno.motivo || 'Sin motivo especificado'}</span>
              </div>
            </button>
          )}

          <div className="progress">
            {MEAL_ORDER.map((k) => <div key={k} className={'bar' + (saved[k] ? ' on' : '')} />)}
          </div>
          <p className="progress-label">{filledCount} de {MEAL_ORDER.length} comidas registradas hoy</p>

          <div className="hoy-grid">
            {MEAL_ORDER.map((k) => {
              const entry = saved[k];
              return (
                <div key={k} className="mealp">
                  <div className="mealp-top">
                    <div className="meal-name2"><span className="ic">{ICONS[k]}</span>{MEAL_LABELS[k]}</div>
                  </div>
                  <textarea
                    className="box"
                    rows={2}
                    placeholder="¿Qué comiste?"
                    defaultValue={entry ? entry.txt : ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value }))}
                  />
                  {entry ? (
                    <div className="saved">✓ Guardado {entry.time ? 'a las ' + entry.time : ''}</div>
                  ) : (
                    <button className="btn-save" onClick={() => saveMeal(k)}>Guardar</button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {view === 'calendario' && (
        <div className="cal-layout">
          <div className="cal-left">
            <div className="monthbar">
              <span className="navbtn" onClick={prevMonth}>‹</span>
              <b>{MONTH_NAMES[calMonth]} {calYear}</b>
              <span className="navbtn" onClick={nextMonth}>›</span>
            </div>
            <div className="dow">{DAY_LETTERS.map((d, i) => <span key={i}>{d}</span>)}</div>
            <div className="calgrid">
              {buildCalendarCells({ year: calYear, month: calMonth, patient, selectedFecha: calFecha, onSelect: setCalFecha })}
            </div>
            <div className="legend">
              <span><span className="dot g"></span>Completo</span>
              <span><span className="dot a"></span>Parcial</span>
              <span><span className="dot m"></span>Sin registrar</span>
              <span><span className="dot-ring"></span>Turno</span>
            </div>
          </div>
          <div className="cal-right">
            <h4>
              {new Date(calFecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
              {calFecha === HOY_KEY ? ' (hoy)' : ''}
            </h4>
            {turnoDelDiaSeleccionado && (
              <div className="turno-chip">
                <span className="ic">📅</span>
                <div>
                  <b>Turno {turnoDelDiaSeleccionado.hora}</b>
                  <span>{turnoDelDiaSeleccionado.motivo || 'Sin motivo especificado'}</span>
                </div>
              </div>
            )}
            {calHasData ? (
              MEAL_ORDER.filter((k) => calRegSeleccionado[k]).map((k) => (
                <div key={k} className="row2"><span className="tag">{MEAL_LABELS[k]}</span><span className="txt">{calRegSeleccionado[k].txt}</span></div>
              ))
            ) : (
              !turnoDelDiaSeleccionado && <p className="empty-day">Sin registros este día.</p>
            )}
          </div>
        </div>
      )}

      {view === 'plan' && (
        <div className="plan-box">
          <h4>Tu plan de alimentación</h4>
          <p className="turnos-sub" style={{ marginBottom: 18 }}>Descargá el archivo que te armó tu nutricionista.</p>
          <PlanesLista planes={patient.planes || []} vacio="Todavía no tenés un plan cargado. Tu nutricionista lo va a subir acá." />
        </div>
      )}

      {view === 'reporte' && (
        <div className="plan-box" style={{ maxWidth: 900 }}>
          <h4>Reporte de mediciones</h4>
          <p className="turnos-sub" style={{ marginBottom: 18 }}>
            Acá aparecen las comparaciones entre mediciones que tu nutricionista decidió compartir con vos.
          </p>
          {(patient.reportes || []).length > 0 ? (
            (patient.reportes || []).map((r) => (
              <div key={r.id} className="reporte-item">
                <p className="reporte-compartido">Compartido el {fechaLarga((r.creado || '').slice(0, 10))}</p>
                {r.a && r.b && <ComparacionTabla a={r.a} b={r.b} />}
              </div>
            ))
          ) : (
            <p className="turno-empty">
              Todavía no hay reportes. Si querés ver cómo evolucionaron tus mediciones, pedíselo a tu nutricionista.
            </p>
          )}
        </div>
      )}

      {view === 'medidas' && (
        <div className="medidas-box">
          {patient.medidas.length > 0 ? (
            <table className="medidas-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  {columnasMedidas(patient.medidas).map((c) => <th key={c.key}>{c.label}</th>)}
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {patient.medidas.map((m) => (
                  <tr key={m.fecha}>
                    <td>{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                    {columnasMedidas(patient.medidas).map((c) => <td key={c.key} data-label={c.label}>{formatMedida(c, m[c.key])}</td>)}
                    <td data-label="Notas">{m.notas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-day">Tu nutricionista todavía no compartió tus mediciones. Si querés verlas, pedíselas en tu próxima consulta.</p>
          )}
        </div>
      )}
    </div>
  );
}

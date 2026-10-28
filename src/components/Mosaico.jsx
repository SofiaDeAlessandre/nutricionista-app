import { useMemo, useState } from 'react';
import {
  statusOf, avatarColor, ESTADO_LABEL,
  TODAY, MONTH_NAMES, DAY_LETTERS, fechaKey, daysInMonth, firstWeekdayMonday,
} from '../data/patients.js';

const HOY_KEY = fechaKey(TODAY.year, TODAY.month, TODAY.day);

function buildMiniCalendarCells({ year, month, turnos, selectedFecha, onSelect }) {
  const isCurrentMonth = year === TODAY.year && month === TODAY.month;
  const total = daysInMonth(year, month);
  const firstDay = firstWeekdayMonday(year, month);
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div key={'b' + i} className="cell blank" />);
  for (let d = 1; d <= total; d++) {
    const fecha = fechaKey(year, month, d);
    const isToday = isCurrentMonth && d === TODAY.day;
    const hasTurno = turnos.some((t) => t.fecha === fecha);
    cells.push(
      <div
        key={fecha}
        className={'cell home' + (isToday ? ' today' : '') + (hasTurno ? ' turno' : '') + (fecha === selectedFecha ? ' sel' : '')}
        onClick={() => onSelect(fecha)}
      >
        <span>{d}</span>
      </div>
    );
  }
  return cells;
}

export default function Mosaico({ patients, onOpenPatient, onOpenAccesos, onOpenIngresos }) {
  const [query, setQuery] = useState('');
  const [calYear, setCalYear] = useState(TODAY.year);
  const [calMonth, setCalMonth] = useState(TODAY.month);
  const [selectedFecha, setSelectedFecha] = useState(HOY_KEY);

  const entries = useMemo(() => Object.entries(patients), [patients]);
  const filtered = entries.filter(([, p]) => p.name.toLowerCase().includes(query.toLowerCase()));

  const allTurnos = useMemo(() => {
    const list = [];
    entries.forEach(([key, p]) => {
      (p.turnos || []).forEach((t) => list.push({ ...t, patientKey: key, patientName: p.name, genero: p.genero, initials: p.initials }));
    });
    return list.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  }, [entries]);

  const proximosTurnos = useMemo(
    () => allTurnos.filter((t) => t.fecha >= HOY_KEY).slice(0, 6),
    [allTurnos]
  );

  const turnosDelDiaSeleccionado = useMemo(
    () => allTurnos.filter((t) => t.fecha === selectedFecha),
    [allTurnos, selectedFecha]
  );

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); } else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); } else setCalMonth((m) => m + 1);
  }

  return (
    <div className="page">
      <div className="mosaico-head">
        <div>
          <h1>Hola, <span style={{ color: 'var(--pink)' }}>Florencia</span></h1>
          <p className="sub">{entries.length} pacientes activos hoy</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="pill-btn" onClick={onOpenIngresos}>
            <span className="ic">💰</span> Ingresos
          </button>
          <button className="pill-btn" onClick={onOpenAccesos}>
            <span className="ic">👥</span> Gestionar accesos
          </button>
        </div>
      </div>

      <div className="mosaico-layout">
        <div className="mosaico-main">
          <div className="searchbar">
            <span>🔍</span>
            <input
              placeholder="Buscar paciente..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="plist">
            {filtered.map(([key, p]) => {
              const st = statusOf(p);
              return (
                <button key={key} className="pcard" onClick={() => onOpenPatient(key)}>
                  <div className="avatar" style={{ background: avatarColor(p.genero) }}>{p.initials}</div>
                  <div>
                    <div className="name">{p.name}</div>
                    <div className="status">
                      {p.acceso === 'activo' ? (
                        <>
                          <span className={'dot ' + st.cls}></span>{st.label}
                        </>
                      ) : (
                        <span className={'estado-badge ' + p.acceso}>{ESTADO_LABEL[p.acceso]}</span>
                      )}
                    </div>
                  </div>
                  <span className="chev">›</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mosaico-side">
          <div className="side-card">
            <div className="monthbar">
              <span className="navbtn" onClick={prevMonth}>‹</span>
              <b>{MONTH_NAMES[calMonth]} {calYear}</b>
              <span className="navbtn" onClick={nextMonth}>›</span>
            </div>
            <div className="dow">
              {DAY_LETTERS.map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div className="calgrid">
              {buildMiniCalendarCells({
                year: calYear, month: calMonth, turnos: allTurnos,
                selectedFecha, onSelect: setSelectedFecha,
              })}
            </div>
            <div className="cal-legend-mini">
              <span><span className="swatch today"></span>Hoy</span>
              <span><span className="swatch turno"></span>Turno</span>
            </div>
            {turnosDelDiaSeleccionado.length > 0 && (
              <div className="cal-day-turnos">
                {turnosDelDiaSeleccionado.map((t) => (
                  <button
                    key={t.patientKey + t.fecha + t.hora}
                    className="turno-chip turno-chip-btn"
                    onClick={() => onOpenPatient(t.patientKey)}
                  >
                    <span className="ic">📅</span>
                    <div>
                      <b>{t.hora} · {t.patientName}</b>
                      <span>{t.motivo || 'Sin motivo especificado'}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="side-card">
            <h4>Próximos turnos</h4>
            {proximosTurnos.length > 0 ? (
              <div className="turnos-list">
                {proximosTurnos.map((t) => {
                  const d = new Date(t.fecha + 'T00:00:00');
                  return (
                    <button
                      key={t.patientKey + t.fecha + t.hora}
                      className="turno-card home"
                      onClick={() => onOpenPatient(t.patientKey)}
                    >
                      <div className="turno-date">
                        <b>{d.getDate()}</b>
                        <span>{MONTH_NAMES[d.getMonth()].slice(0, 3)}</span>
                      </div>
                      <div className="turno-info">
                        <b>{t.hora} — {t.motivo || 'Turno'}</b>
                        <span>{t.patientName}{t.fecha === HOY_KEY ? ' · hoy' : ''}</span>
                      </div>
                      <span className="avatar mini" style={{ background: avatarColor(t.genero) }}>{t.initials}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="turno-empty">No hay turnos agendados todavía.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

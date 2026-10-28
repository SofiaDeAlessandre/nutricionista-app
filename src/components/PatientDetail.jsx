import { useState } from 'react';
import {
  MEAL_ORDER, MEAL_LABELS,
  statusForDay, avatarColor, MEDIDA_CAMPOS, columnasMedidas, formatMedida, parseDecimal,
  TODAY, MONTH_NAMES, fechaKey, daysInMonth, firstWeekdayMonday,
} from '../data/patients.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import PlanesLista from './PlanesLista.jsx';
import ComparacionTabla from './ComparacionTabla.jsx';
import { fechaLarga } from '../lib/format.js';

const TABS = [
  { key: 'clinica', label: 'Historia clínica' },
  { key: 'calendario', label: 'Comidas por días' },
  { key: 'plan', label: 'Plan asignado' },
  { key: 'medidas', label: 'Mediciones' },
  { key: 'comparacion', label: 'Comparación mediciones' },
  { key: 'turnos', label: 'Turnos' },
  { key: 'consultas', label: 'Consultas' },
];

// Igual que registroDelDia, pero indexado por número de día en vez de por índice
// de semana — lo usamos en el calendario, donde se puede clickear cualquier día.
function registroPorDia(p, day) {
  if (day === TODAY.day) {
    const reg = {};
    MEAL_ORDER.forEach((k) => { reg[k] = p.log[k]; });
    return reg;
  }
  const h = p.history[day] || {};
  const reg = {};
  MEAL_ORDER.forEach((k) => { reg[k] = h[k] ? { txt: h[k], time: null } : null; });
  return reg;
}

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
    const known = isCurrentMonth && d <= TODAY.day;
    const cls = known ? statusForDay(patient, d) : 'm';
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

const MEDIDA_VACIA = { fecha: '', notas: '', ...Object.fromEntries(MEDIDA_CAMPOS.map((c) => [c.key, ''])) };
const TURNO_VACIO = { fecha: '', hora: '', motivo: '', avisar: true, tipo: null };
const TIPO_LABEL = { primera: 'Primera consulta', control: 'Control' };
const HOY_KEY = fechaKey(TODAY.year, TODAY.month, TODAY.day);

function inicialesDe(nombre) {
  const partes = nombre.trim().split(/\s+/);
  const first = partes[0]?.[0] || '';
  const last = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export default function PatientDetail({ patientKey, patients, onUpdatePatient, onAddTurno, onUpdateTurno, onCancelTurno, onSubirPlan, onEliminarPlan, onCompartirReporte, onQuitarReporte, onCompartirMediciones, onQuitarMediciones, onAddConsulta, onUpdateConsulta, onDeleteConsulta }) {
  const patient = patients[patientKey];
  const [tab, setTab] = useState('clinica');
  const [calYear, setCalYear] = useState(TODAY.year);
  const [calMonth, setCalMonth] = useState(TODAY.month);
  const [calFecha, setCalFecha] = useState(HOY_KEY);
  const [clinica, setClinica] = useState(patient.historiaClinica);
  const [clinicaSaved, setClinicaSaved] = useState(false);
  const [planFecha, setPlanFecha] = useState(HOY_KEY);
  const [planArchivo, setPlanArchivo] = useState(null);
  const [planInputKey, setPlanInputKey] = useState(0); // para vaciar el selector de archivo
  const [subiendoPlan, setSubiendoPlan] = useState(false);
  const [planMsg, setPlanMsg] = useState(null); // { tipo: 'ok' | 'error', txt }
  const [confirmDelPlan, setConfirmDelPlan] = useState(null);
  const [consFecha, setConsFecha] = useState(HOY_KEY);
  const [consTipo, setConsTipo] = useState(null); // 'primera' | 'control'
  const [consEditId, setConsEditId] = useState(null);
  const [consMsg, setConsMsg] = useState(null); // { tipo: 'ok' | 'error', txt }
  const [guardandoCons, setGuardandoCons] = useState(false);
  const [confirmDelCons, setConfirmDelCons] = useState(null);
  const [compDesde, setCompDesde] = useState(null); // índice (en patient.medidas) de la medición de partida
  const [compHasta, setCompHasta] = useState(null);
  const [confirmCompartir, setConfirmCompartir] = useState(false);
  const [compMsg, setCompMsg] = useState(null);
  const [confirmQuitarReporte, setConfirmQuitarReporte] = useState(null);
  const [addingMedida, setAddingMedida] = useState(false);
  const [nuevaMedida, setNuevaMedida] = useState(MEDIDA_VACIA);
  const [medidaError, setMedidaError] = useState('');
  const [editandoMedidaIdx, setEditandoMedidaIdx] = useState(null); // índice de la medición que se está editando
  const [nuevoTurno, setNuevoTurno] = useState(TURNO_VACIO);
  const [confirmTurno, setConfirmTurno] = useState(false);
  const [confirmCancelTurno, setConfirmCancelTurno] = useState(null);
  const [editingTurnoId, setEditingTurnoId] = useState(null);
  const [editandoDatos, setEditandoDatos] = useState(false);
  const [nombreEdit, setNombreEdit] = useState(patient.name);
  const [generoEdit, setGeneroEdit] = useState(patient.genero);

  const calIsCurrentMonth = calYear === TODAY.year && calMonth === TODAY.month;
  const calSelectedDay = Number(calFecha.split('-')[2]);
  const calReg = calIsCurrentMonth ? registroPorDia(patient, calSelectedDay) : {};
  const calHasData = MEAL_ORDER.some((k) => calReg[k]);
  const proximosTurnos = (patient.turnos || [])
    .filter((t) => t.fecha >= HOY_KEY)
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  }

  async function handleSubirPlan(e) {
    e.preventDefault();
    if (!planArchivo || !planFecha) return;
    if (planArchivo.size > 15 * 1024 * 1024) {
      setPlanMsg({ tipo: 'error', txt: 'El archivo pesa más de 15 MB. Probá con uno más liviano.' });
      return;
    }
    setSubiendoPlan(true);
    setPlanMsg(null);
    try {
      await onSubirPlan(patientKey, planArchivo, planFecha);
      setPlanArchivo(null);
      setPlanInputKey((k) => k + 1);
      setPlanMsg({ tipo: 'ok', txt: '✓ Plan subido' });
    } catch (err) {
      console.error(err);
      setPlanMsg({ tipo: 'error', txt: 'No se pudo subir el archivo. Revisá tu conexión y probá de nuevo.' });
    } finally {
      setSubiendoPlan(false);
    }
  }

  async function confirmarEliminarPlan() {
    const plan = confirmDelPlan;
    setConfirmDelPlan(null);
    try {
      await onEliminarPlan(patientKey, plan);
    } catch (err) {
      console.error(err);
      window.alert('No se pudo eliminar el plan. Probá de nuevo.');
    }
  }

  function handleGuardarClinica() {
    onUpdatePatient(patientKey, { historiaClinica: clinica });
    setClinicaSaved(true);
  }

  // ----- Consultas realizadas -----
  const consultas = patient.consultas || [];
  const nPrimeras = consultas.filter((c) => c.tipo === 'primera').length;
  const nControles = consultas.filter((c) => c.tipo === 'control').length;

  function limpiarFormConsulta() {
    setConsEditId(null);
    setConsFecha(HOY_KEY);
    setConsTipo(null);
  }

  function abrirEditarConsulta(c) {
    setConsEditId(c.id);
    setConsFecha(c.fecha);
    setConsTipo(c.tipo);
    setConsMsg(null);
  }

  async function handleGuardarConsulta(e) {
    e.preventDefault();
    if (!consFecha) return;
    if (consFecha > HOY_KEY) {
      setConsMsg({ tipo: 'error', txt: 'La fecha no puede ser futura: acá se registran consultas ya realizadas.' });
      return;
    }
    if (!consTipo) {
      setConsMsg({ tipo: 'error', txt: 'Elegí si fue primera consulta o control.' });
      return;
    }
    setGuardandoCons(true);
    setConsMsg(null);
    try {
      if (consEditId) await onUpdateConsulta(patientKey, consEditId, { fecha: consFecha, tipo: consTipo });
      else await onAddConsulta(patientKey, { fecha: consFecha, tipo: consTipo });
      limpiarFormConsulta();
      setConsMsg({ tipo: 'ok', txt: '✓ Consulta guardada' });
    } catch (err) {
      console.error(err);
      setConsMsg({
        tipo: 'error',
        txt: err?.code === '23505'
          ? 'Ya hay una consulta cargada para ese día. Editala desde la lista.'
          : 'No se pudo guardar la consulta. Probá de nuevo.',
      });
    } finally {
      setGuardandoCons(false);
    }
  }

  async function confirmarEliminarConsulta() {
    const c = confirmDelCons;
    setConfirmDelCons(null);
    try {
      await onDeleteConsulta(patientKey, c.id);
      if (consEditId === c.id) limpiarFormConsulta();
    } catch (err) {
      console.error(err);
      window.alert('No se pudo eliminar la consulta. Probá de nuevo.');
    }
  }

  // ----- Comparación de mediciones -----
  const nMed = patient.medidas.length;
  const idxDesde = Math.min(compDesde ?? Math.max(nMed - 2, 0), Math.max(nMed - 1, 0));
  const idxHasta = Math.min(compHasta ?? Math.max(nMed - 1, 0), Math.max(nMed - 1, 0));
  const medDesde = patient.medidas[idxDesde];
  const medHasta = patient.medidas[idxHasta];
  const yaCompartida = (patient.reportes || []).some((r) => {
    if (!medDesde || !medHasta) return false;
    const [fa, fb] = medDesde.fecha <= medHasta.fecha ? [medDesde.fecha, medHasta.fecha] : [medHasta.fecha, medDesde.fecha];
    return r.fechaA === fa && r.fechaB === fb;
  });

  // ----- Mediciones visibles para el paciente -----
  const [medMsg, setMedMsg] = useState(null);
  const [medBusy, setMedBusy] = useState(false);
  const comp = patient.compartidas;
  const sinActualizar = comp ? JSON.stringify(comp.datos) !== JSON.stringify(patient.medidas) : false;

  async function accionMediciones(fn, okTxt) {
    setMedBusy(true);
    setMedMsg(null);
    try {
      await fn(patientKey);
      setMedMsg({ tipo: 'ok', txt: okTxt });
    } catch (err) {
      console.error(err);
      setMedMsg({ tipo: 'error', txt: 'No se pudo guardar. Probá de nuevo.' });
    } finally {
      setMedBusy(false);
    }
  }

  async function confirmarCompartirReporte() {
    setConfirmCompartir(false);
    setCompMsg(null);
    try {
      await onCompartirReporte(patientKey, medDesde, medHasta);
      setCompMsg({ tipo: 'ok', txt: '✓ Compartido: el paciente ya lo ve en su solapa "Reporte de mediciones".' });
    } catch (err) {
      console.error(err);
      setCompMsg({ tipo: 'error', txt: 'No se pudo compartir el reporte. Probá de nuevo.' });
    }
  }

  async function confirmarQuitarReporte() {
    const r = confirmQuitarReporte;
    setConfirmQuitarReporte(null);
    try {
      await onQuitarReporte(patientKey, r.id);
    } catch (err) {
      console.error(err);
      window.alert('No se pudo quitar el reporte. Probá de nuevo.');
    }
  }

  function cerrarFormMedida() {
    setAddingMedida(false);
    setEditandoMedidaIdx(null);
    setNuevaMedida(MEDIDA_VACIA);
    setMedidaError('');
  }

  // Editar una medición ya cargada: precarga el formulario con sus datos.
  function abrirEditarMedida(m, idx) {
    const form = { fecha: m.fecha, notas: m.notas || '' };
    MEDIDA_CAMPOS.forEach((c) => { form[c.key] = m[c.key] === undefined || m[c.key] === null ? '' : String(m[c.key]).replace('.', ','); });
    setMedidaError('');
    setNuevaMedida(form);
    setEditandoMedidaIdx(idx);
    setAddingMedida(true);
    setTimeout(() => document.querySelector('.medida-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }

  function handleAgregarMedida(e) {
    e.preventDefault();
    if (!nuevaMedida.fecha) return;
    const nueva = { fecha: nuevaMedida.fecha, notas: nuevaMedida.notas };
    for (const c of MEDIDA_CAMPOS) {
      const v = parseDecimal(nuevaMedida[c.key]);
      const nombre = c.label.replace(/\s*\(.*\)$/, '');
      if (Number.isNaN(v)) {
        setMedidaError(`${nombre}: escribí solo números, con coma o punto para los decimales (ej: 77,5).`);
        return;
      }
      if (v < c.min || v > c.max) {
        setMedidaError(`${nombre}: el valor tiene que estar entre ${c.min} y ${c.max}. Revisá que no haya un error de tipeo.`);
        return;
      }
      nueva[c.key] = v;
    }
    setMedidaError('');
    const porFecha = (a, b) => a.fecha.localeCompare(b.fecha);
    if (editandoMedidaIdx !== null) {
      onUpdatePatient(patientKey, (prev) => ({
        medidas: prev.medidas.map((m, i) => (i === editandoMedidaIdx ? { ...m, ...nueva } : m)).sort(porFecha),
      }));
    } else {
      onUpdatePatient(patientKey, (prev) => ({ medidas: [...prev.medidas, nueva].sort(porFecha) }));
    }
    cerrarFormMedida();
  }

  function handleAgregarTurno(e) {
    e.preventDefault();
    if (!nuevoTurno.fecha || !nuevoTurno.hora) return;
    setConfirmTurno(true);
  }

  function confirmarAgregarTurno() {
    const datos = { fecha: nuevoTurno.fecha, hora: nuevoTurno.hora, motivo: nuevoTurno.motivo, avisar: nuevoTurno.avisar, tipo: nuevoTurno.tipo };
    if (editingTurnoId) {
      onUpdateTurno(patientKey, editingTurnoId, datos);
    } else {
      onAddTurno(patientKey, datos);
    }
    const [y, m] = nuevoTurno.fecha.split('-').map(Number);
    setCalYear(y);
    setCalMonth(m - 1);
    setCalFecha(nuevoTurno.fecha);
    setNuevoTurno(TURNO_VACIO);
    setEditingTurnoId(null);
    setConfirmTurno(false);
  }

  // Cambiar de solapa. Al entrar a "Turnos" precargamos la fecha del formulario con el
  // día seleccionado en el calendario, así no hay que volver a tipearla.
  function irATab(key) {
    setTab(key);
    if (key === 'turnos' && !editingTurnoId) {
      setNuevoTurno((t) => (t.fecha ? t : { ...t, fecha: calFecha }));
    }
  }

  // Editar un turno existente: precarga el formulario (que está en la solapa Turnos) con sus datos.
  function abrirEditarTurno(t) {
    setEditingTurnoId(t.id);
    setNuevoTurno({ fecha: t.fecha, hora: t.hora, motivo: t.motivo || '', avisar: t.avisar ?? true, tipo: t.tipo || null });
    const [y, m] = t.fecha.split('-').map(Number);
    setCalYear(y);
    setCalMonth(m - 1);
    setCalFecha(t.fecha);
    setTab('turnos');
  }

  // Cancela la edición (o limpia el formulario) y vuelve a "turno nuevo".
  function cancelarFormularioTurno() {
    setEditingTurnoId(null);
    setNuevoTurno({ ...TURNO_VACIO, fecha: calFecha });
  }

  function abrirEdicionDatos() {
    setNombreEdit(patient.name);
    setGeneroEdit(patient.genero);
    setEditandoDatos(true);
  }

  function guardarDatos(e) {
    e.preventDefault();
    if (!nombreEdit.trim()) return;
    onUpdatePatient(patientKey, {
      name: nombreEdit.trim(),
      genero: generoEdit,
      initials: inicialesDe(nombreEdit),
    });
    setEditandoDatos(false);
  }

  function pedirCancelarTurno(t) {
    setConfirmCancelTurno(t);
  }

  function confirmarCancelarTurno() {
    if (confirmCancelTurno) {
      const { fecha, hora } = confirmCancelTurno;
      onCancelTurno(patientKey, fecha, hora);
    }
    setConfirmCancelTurno(null);
  }

  return (
    <div className="page">
      <div className="detalle-head">
        <div className="avatar" style={{ background: avatarColor(patient.genero), width: 44, height: 44 }}>{patient.initials}</div>
        <div className="who">
          <b>{patient.name}</b>
          <span>Plan nutricional activo</span>
        </div>
        {!editandoDatos && (
          <button
            type="button"
            className="btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={abrirEdicionDatos}
            title="Editar nombre o género"
          >
            ✎ Editar datos
          </button>
        )}
      </div>

      {editandoDatos && (
        <form className="invite-form" style={{ marginBottom: 24 }} onSubmit={guardarDatos}>
          <div className="field">
            <label>Nombre del paciente</label>
            <input value={nombreEdit} onChange={(e) => setNombreEdit(e.target.value)} placeholder="Nombre y apellido" />
          </div>
          <div className="field" style={{ flex: '0 0 auto', minWidth: 180 }}>
            <label>Género</label>
            <div className="role-segs" style={{ marginBottom: 0 }}>
              <button type="button" className={'role-seg' + (generoEdit === 'F' ? ' active f' : '')} onClick={() => setGeneroEdit('F')}>
                Femenino
              </button>
              <button type="button" className={'role-seg' + (generoEdit === 'M' ? ' active m' : '')} onClick={() => setGeneroEdit('M')}>
                Masculino
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '13px 22px' }}>
            Guardar
          </button>
          <button type="button" className="btn-sm" onClick={() => setEditandoDatos(false)}>
            Cancelar
          </button>
        </form>
      )}

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={'tab' + (tab === t.key ? ' active' : '')}
            onClick={(ev) => {
              irATab(t.key);
              ev.currentTarget.scrollIntoView?.({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'plan' && (
        <div className="turnos-layout">
          <div className="turnos-card nuevo">
            <h4>Subir plan de alimentación</h4>
            <p className="turnos-sub">
              Subí el archivo que armaste (PDF, Word o imagen). El paciente lo descarga desde su vista.
            </p>
            <form className="turno-form" onSubmit={handleSubirPlan}>
              <div className="field">
                <label>Fecha del plan</label>
                <input type="date" value={planFecha} onChange={(e) => setPlanFecha(e.target.value)} required />
              </div>
              <div className="field">
                <label>Archivo · hasta 15 MB</label>
                <input
                  key={planInputKey}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => { setPlanArchivo(e.target.files?.[0] || null); setPlanMsg(null); }}
                  required
                />
              </div>
              {planMsg && (
                <p className={planMsg.tipo === 'ok' ? 'saved-msg' : 'login-error'} style={{ margin: 0 }}>{planMsg.txt}</p>
              )}
              <div className="row-actions">
                <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '11px 18px' }} disabled={subiendoPlan}>
                  {subiendoPlan ? 'Subiendo…' : 'Subir plan'}
                </button>
              </div>
            </form>
          </div>

          <div className="turnos-card proximo">
            <h4>Planes cargados</h4>
            <PlanesLista
              planes={patient.planes || []}
              onEliminar={setConfirmDelPlan}
              vacio="Todavía no cargaste ningún plan para este paciente."
            />
          </div>
        </div>
      )}

      {tab === 'calendario' && (
        <div className="turnos-layout">
          <div className="turnos-card dia">
            <h4>Elegí un día</h4>
            <p className="turnos-sub" style={{ marginBottom: 16 }}>Tocá una fecha para ver lo que cargó el paciente.</p>
            <div className="monthbar">
              <span className="navbtn" onClick={prevMonth}>‹</span>
              <b>{MONTH_NAMES[calMonth]} {calYear}</b>
              <span className="navbtn" onClick={nextMonth}>›</span>
            </div>
            <div className="dow">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div className="calgrid">
              {buildCalendarCells({ year: calYear, month: calMonth, patient, selectedFecha: calFecha, onSelect: setCalFecha })}
            </div>
            <div className="legend">
              <span><span className="dot g"></span>Completo</span>
              <span><span className="dot a"></span>Parcial</span>
              <span><span className="dot m"></span>Sin registrar</span>
            </div>
          </div>
          <div className="turnos-card proximo">
            <h4>Comidas cargadas por el paciente</h4>
            <p className="turnos-sub" style={{ marginBottom: 18 }}>
              {fechaLarga(calFecha)}{calFecha === HOY_KEY ? ' (hoy)' : ''}
            </p>
            {calHasData ? (
              MEAL_ORDER.filter((k) => calReg[k]).map((k) => (
                <div key={k} className="row2">
                  <span className="tag">{MEAL_LABELS[k]}</span>
                  <span className="txt">{calReg[k].txt}</span>
                </div>
              ))
            ) : (
              <p className="empty-day">El paciente no cargó comidas este día.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'comparacion' && (
        nMed < 2 ? (
          <div className="turnos-card proximo">
            <h4>Comparación de mediciones</h4>
            <p className="turno-empty">Necesitás al menos dos mediciones cargadas para poder compararlas.</p>
          </div>
        ) : (
          <div className="turnos-layout comp-layout">
            <div className="turnos-card nuevo">
              <h4>Elegí qué comparar</h4>
              <p className="turnos-sub">Solo la ves vos. El paciente no la ve salvo que se la compartas.</p>
              <div className="turno-form">
                <div className="field">
                  <label>Medición de partida</label>
                  <select value={idxDesde} onChange={(e) => { setCompDesde(Number(e.target.value)); setCompMsg(null); }}>
                    {patient.medidas.map((m, i) => <option key={i} value={i}>{fechaLarga(m.fecha)}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Comparar contra</label>
                  <select value={idxHasta} onChange={(e) => { setCompHasta(Number(e.target.value)); setCompMsg(null); }}>
                    {patient.medidas.map((m, i) => <option key={i} value={i}>{fechaLarga(m.fecha)}</option>)}
                  </select>
                </div>
                <p className="turnos-sub" style={{ margin: 0 }}>
                  La diferencia siempre es la medición más reciente menos la más antigua.
                </p>
              </div>
            </div>

            <div className="turnos-card proximo">
              <h4>Diferencias entre mediciones</h4>
              {medDesde && medHasta && <ComparacionTabla a={medDesde} b={medHasta} />}

              <div className="comp-compartir">
                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: 'auto', padding: '11px 18px' }}
                  disabled={yaCompartida || idxDesde === idxHasta}
                  onClick={() => setConfirmCompartir(true)}
                >
                  Compartir con el paciente
                </button>
                {yaCompartida && <span className="saved-msg">Esta comparación ya está compartida</span>}
                {idxDesde === idxHasta && <span className="turnos-sub">Elegí dos mediciones distintas para compartir.</span>}
                {compMsg && <span className={compMsg.tipo === 'ok' ? 'saved-msg' : 'login-error'}>{compMsg.txt}</span>}
              </div>

              <h5 className="turnos-despues">Compartidos con el paciente</h5>
              {(patient.reportes || []).length > 0 ? (
                <div className="plan-lista">
                  {patient.reportes.map((r) => (
                    <div key={r.id} className="plan-item">
                      <div className="plan-ic">📊</div>
                      <div className="plan-info">
                        <b>{fechaLarga(r.fechaA)} → {fechaLarga(r.fechaB)}</b>
                        <span>Compartido el {fechaLarga((r.creado || '').slice(0, 10))}</span>
                      </div>
                      <div className="plan-acciones">
                        <button type="button" className="btn-sm danger" onClick={() => setConfirmQuitarReporte(r)}>Dejar de compartir</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="turno-empty">Todavía no compartiste ningún reporte con este paciente.</p>
              )}
            </div>
          </div>
        )
      )}

      {tab === 'consultas' && (
        <div className="turnos-layout">
          <div className="turnos-card nuevo">
            <h4>{consEditId ? 'Editar consulta' : 'Registrar consulta'}</h4>
            <p className="turnos-sub">Cargá cada consulta que realizaste. Con esto se arma el reporte de ingresos.</p>
            <form className="turno-form" onSubmit={handleGuardarConsulta}>
              <div className="field">
                <label>Fecha de consulta</label>
                <input
                  type="date"
                  value={consFecha}
                  max={HOY_KEY}
                  onChange={(e) => { setConsFecha(e.target.value); setConsMsg(null); }}
                  required
                />
              </div>
              <div className="field">
                <label>Tipo de consulta</label>
                <div className="tipo-checks">
                  {['primera', 'control'].map((k) => (
                    <label key={k} className="tipo-check">
                      <input
                        type="checkbox"
                        checked={consTipo === k}
                        onChange={(e) => { setConsTipo(e.target.checked ? k : null); setConsMsg(null); }}
                      />
                      <span>{TIPO_LABEL[k]}</span>
                    </label>
                  ))}
                </div>
              </div>
              {consMsg && <p className={consMsg.tipo === 'ok' ? 'saved-msg' : 'login-error'} style={{ margin: 0 }}>{consMsg.txt}</p>}
              <div className="row-actions">
                <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '11px 18px' }} disabled={guardandoCons}>
                  {guardandoCons ? 'Guardando…' : consEditId ? 'Guardar cambios' : 'Guardar consulta'}
                </button>
                {consEditId && (
                  <button type="button" className="btn-sm" onClick={() => { limpiarFormConsulta(); setConsMsg(null); }}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="turnos-card proximo">
            <h4>Consultas registradas</h4>
            <p className="turnos-sub" style={{ marginBottom: 16 }}>
              {consultas.length} en total · {nPrimeras} {nPrimeras === 1 ? 'primera consulta' : 'primeras consultas'} · {nControles} {nControles === 1 ? 'control' : 'controles'}
            </p>
            {consultas.length > 0 ? (
              <div className="plan-lista">
                {consultas.map((c) => (
                  <div key={c.id} className="plan-item">
                    <div className="plan-info">
                      <b>
                        {fechaLarga(c.fecha)}
                        <span className={'plan-badge' + (c.tipo === 'control' ? ' control' : '')}>{TIPO_LABEL[c.tipo]}</span>
                      </b>
                    </div>
                    <div className="plan-acciones">
                      <button type="button" className="btn-sm" onClick={() => abrirEditarConsulta(c)}>✎ Editar</button>
                      <button type="button" className="btn-sm danger" onClick={() => setConfirmDelCons(c)}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="turno-empty">Todavía no registraste ninguna consulta de este paciente.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'turnos' && (
        <div className="turnos-layout">
          <div className="turnos-card nuevo">
            <h4>{editingTurnoId ? 'Editar turno' : 'Asignar nuevo turno'}</h4>
            <p className="turnos-sub">
              {editingTurnoId ? 'Cambiá los datos y guardá.' : 'El paciente lo ve apenas entra a la app.'}
            </p>
            <form className="turno-form" onSubmit={handleAgregarTurno}>
              <div className="field">
                <label>Fecha</label>
                <input
                  type="date"
                  value={nuevoTurno.fecha}
                  onChange={(e) => setNuevoTurno((t) => ({ ...t, fecha: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>Hora</label>
                <input
                  type="time"
                  value={nuevoTurno.hora}
                  onChange={(e) => setNuevoTurno((t) => ({ ...t, hora: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>Motivo</label>
                <input
                  value={nuevoTurno.motivo}
                  onChange={(e) => setNuevoTurno((t) => ({ ...t, motivo: e.target.value }))}
                  placeholder="Control mensual, primera consulta..."
                />
              </div>
              <div className="row-actions">
                <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '11px 18px' }}>
                  {editingTurnoId ? 'Guardar cambios' : 'Guardar turno'}
                </button>
                {editingTurnoId && (
                  <button type="button" className="btn-sm" onClick={cancelarFormularioTurno}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="turnos-card proximo">
            <h4>Próximo turno</h4>
            {proximosTurnos.length > 0 ? (
              <>
                {(() => {
                  const t = proximosTurnos[0];
                  const d = new Date(t.fecha + 'T00:00:00');
                  return (
                    <div className="proximo-destacado">
                      <div className="turno-date grande">
                        <b>{d.getDate()}</b>
                        <span>{MONTH_NAMES[d.getMonth()].slice(0, 3)}</span>
                      </div>
                      <div className="proximo-info">
                        <b>{t.hora} hs</b>
                        <span>
                          {t.fecha === HOY_KEY ? 'Hoy' : d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                        <span>{t.motivo || 'Sin motivo especificado'}</span>
                      </div>
                      <div className="proximo-acciones">
                        <button type="button" className="btn-sm" onClick={() => abrirEditarTurno(t)}>✎ Editar</button>
                        <button type="button" className="btn-sm danger" onClick={() => pedirCancelarTurno(t)}>Cancelar</button>
                      </div>
                    </div>
                  );
                })()}

                {proximosTurnos.length > 1 && (
                  <>
                    <h5 className="turnos-despues">Después</h5>
                    <div className="turnos-lista">
                      {proximosTurnos.slice(1).map((t) => {
                        const d = new Date(t.fecha + 'T00:00:00');
                        return (
                          <div key={t.fecha + t.hora} className="turno-card">
                            <div className="turno-date">
                              <b>{d.getDate()}</b>
                              <span>{MONTH_NAMES[d.getMonth()].slice(0, 3)}</span>
                            </div>
                            <div className="turno-info">
                              <b>{t.hora} — {t.motivo || 'Turno'}</b>
                              <span>{d.toLocaleDateString('es-AR', { weekday: 'long' })}</span>
                            </div>
                            <button className="turno-edit" title="Editar turno" onClick={() => abrirEditarTurno(t)}>✎</button>
                            <button className="turno-cancel" title="Cancelar turno" onClick={() => pedirCancelarTurno(t)}>×</button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="turno-empty">No hay turnos agendados todavía.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'clinica' && (
        <div className="clinica-box">
          <span className="badge">Solo vos la ves — el paciente no accede a esta solapa</span>
          <textarea
            value={clinica}
            onChange={(e) => {
              setClinica(e.target.value);
              setClinicaSaved(false);
            }}
          />
          <div className="save-row">
            <button className="btn-primary" style={{ width: 'auto', padding: '12px 22px' }} onClick={handleGuardarClinica}>
              Guardar cambios
            </button>
            {clinicaSaved && <span className="saved-msg">✓ Cambios guardados</span>}
          </div>
        </div>
      )}

      {tab === 'medidas' && (
        <div className="medidas-box">
          <div className="share-box">
            <p style={{ margin: 0 }}>
              {comp
                ? <>👁 <strong>El paciente ve sus mediciones</strong> (compartidas el {new Date(comp.actualizado).toLocaleDateString('es-AR')}{sinActualizar ? ' · hay cambios sin compartir' : ''}).</>
                : <>🔒 <strong>El paciente no ve sus mediciones.</strong> Solo las verá si las compartís.</>}
            </p>
            <div className="row-actions">
              {(!comp || sinActualizar) && (
                <button type="button" className="btn-sm" disabled={medBusy || patient.medidas.length === 0}
                  onClick={() => accionMediciones(onCompartirMediciones, comp ? '✓ Actualizado: el paciente ve las mediciones al día.' : '✓ Compartido: el paciente ya ve sus mediciones.')}>
                  {comp ? 'Actualizar lo compartido' : 'Compartir con el paciente'}
                </button>
              )}
              {comp && (
                <button type="button" className="btn-sm" disabled={medBusy}
                  onClick={() => accionMediciones(onQuitarMediciones, 'Dejaste de compartir las mediciones.')}>
                  Dejar de compartir
                </button>
              )}
            </div>
            {medMsg && <p className={medMsg.tipo === 'error' ? 'login-error' : 'edit-hint'} style={{ margin: 0 }}>{medMsg.txt}</p>}
          </div>
          {patient.medidas.length > 0 ? (
            <table className="medidas-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  {columnasMedidas(patient.medidas).map((c) => <th key={c.key}>{c.label}</th>)}
                  <th>Notas de la consulta</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {patient.medidas.map((m, idx) => (
                  <tr key={m.fecha + '-' + idx}>
                    <td>{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                    {columnasMedidas(patient.medidas).map((c) => <td key={c.key} data-label={c.label}>{formatMedida(c, m[c.key])}</td>)}
                    <td data-label="Notas">{m.notas}</td>
                    <td>
                      <button type="button" className="btn-sm" onClick={() => abrirEditarMedida(m, idx)} title="Editar esta medición">
                        ✎ Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-day">Todavía no hay mediciones cargadas.</p>
          )}

          <div className="medidas-foot">
            {addingMedida ? (
              <form className="medida-form" onSubmit={handleAgregarMedida}>
                <p className="edit-hint" style={{ margin: 0, width: '100%' }}>
                  {editandoMedidaIdx !== null ? 'Editando medición' : 'Medición nueva'}
                </p>
                <div className="field">
                  <label>Fecha</label>
                  <input
                    type="date"
                    value={nuevaMedida.fecha}
                    onChange={(e) => setNuevaMedida((m) => ({ ...m, fecha: e.target.value }))}
                    required
                  />
                </div>
                {MEDIDA_CAMPOS.map((c) => (
                  <div className="field" key={c.key}>
                    <label>{c.label}{c.obligatorio ? '' : ' · opcional'}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={c.decimales ? '0,0' : '0'}
                      value={nuevaMedida[c.key]}
                      onChange={(e) => { setNuevaMedida((m) => ({ ...m, [c.key]: e.target.value })); setMedidaError(''); }}
                      required={!!c.obligatorio}
                    />
                  </div>
                ))}
                <div className="field" style={{ flex: '2 1 220px' }}>
                  <label>Notas</label>
                  <input
                    value={nuevaMedida.notas}
                    onChange={(e) => setNuevaMedida((m) => ({ ...m, notas: e.target.value }))}
                    placeholder="Notas de la consulta"
                  />
                </div>
                {medidaError && <p className="login-error" style={{ width: '100%', margin: 0 }}>{medidaError}</p>}
                <div className="row-actions">
                  <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '13px 18px' }}>
                    {editandoMedidaIdx !== null ? 'Guardar cambios' : 'Guardar'}
                  </button>
                  <button type="button" className="btn-sm" onClick={cerrarFormMedida}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => setAddingMedida(true)}>
                + Cargar medición
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmTurno}
        title={editingTurnoId ? '¿Guardar los cambios del turno?' : '¿Confirmar el turno?'}
        message={
          nuevoTurno.fecha
            ? `Turno para ${patient.name} el ${new Date(nuevoTurno.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })} a las ${nuevoTurno.hora}. Va a verlo apenas entre a la app.`
            : ''
        }
        confirmLabel={editingTurnoId ? 'Sí, guardar cambios' : 'Sí, guardar turno'}
        onConfirm={confirmarAgregarTurno}
        onCancel={() => setConfirmTurno(false)}
      />

      <ConfirmDialog
        open={!!confirmDelCons}
        title="¿Eliminar esta consulta?"
        message={confirmDelCons ? `Se va a borrar la consulta del ${fechaLarga(confirmDelCons.fecha)} (${TIPO_LABEL[confirmDelCons.tipo]}). Deja de contar en el reporte de ingresos.` : ''}
        confirmLabel="Sí, eliminar"
        danger
        onConfirm={confirmarEliminarConsulta}
        onCancel={() => setConfirmDelCons(null)}
      />

      <ConfirmDialog
        open={confirmCompartir}
        title="¿Compartir esta comparación?"
        message={
          medDesde && medHasta
            ? `${patient.name} va a poder ver la comparación entre el ${fechaLarga(medDesde.fecha <= medHasta.fecha ? medDesde.fecha : medHasta.fecha)} y el ${fechaLarga(medDesde.fecha <= medHasta.fecha ? medHasta.fecha : medDesde.fecha)} en su solapa "Reporte de mediciones".`
            : ''
        }
        confirmLabel="Sí, compartir"
        onConfirm={confirmarCompartirReporte}
        onCancel={() => setConfirmCompartir(false)}
      />

      <ConfirmDialog
        open={!!confirmQuitarReporte}
        title="¿Dejar de compartir este reporte?"
        message="El paciente ya no va a poder verlo. Podés volver a compartirlo cuando quieras."
        confirmLabel="Sí, dejar de compartir"
        danger
        onConfirm={confirmarQuitarReporte}
        onCancel={() => setConfirmQuitarReporte(null)}
      />

      <ConfirmDialog
        open={!!confirmDelPlan}
        title="¿Eliminar este plan?"
        message={
          confirmDelPlan
            ? `Se va a borrar el plan del ${fechaLarga(confirmDelPlan.fecha)} (${confirmDelPlan.nombre}). El paciente ya no va a poder descargarlo.`
            : ''
        }
        confirmLabel="Sí, eliminar"
        danger
        onConfirm={confirmarEliminarPlan}
        onCancel={() => setConfirmDelPlan(null)}
      />

      <ConfirmDialog
        open={!!confirmCancelTurno}
        title="¿Cancelar este turno?"
        message={
          confirmCancelTurno
            ? `Se va a eliminar el turno del ${new Date(confirmCancelTurno.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })} a las ${confirmCancelTurno.hora}.`
            : ''
        }
        confirmLabel="Sí, cancelar turno"
        danger
        onConfirm={confirmarCancelarTurno}
        onCancel={() => setConfirmCancelTurno(null)}
      />
    </div>
  );
}

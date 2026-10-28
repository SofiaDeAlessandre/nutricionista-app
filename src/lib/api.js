import { supabase } from './supabaseClient.js';

// Convierte una fila de la tabla "pacientes" + sus turnos al mismo formato
// que ya usaban todos los componentes en la versión mock, para no tener que
// reescribir Mosaico/PatientDetail/PatientDashboard/GestionAccesos.
function mapPacienteRow(row, turnosDeEstePaciente, planesDeEstePaciente, reportesDeEstePaciente, consultasDeEstePaciente, compartidaDeEstePaciente, clinicoDeEstePaciente) {
  return {
    name: row.nombre,
    initials: row.iniciales,
    genero: row.genero,
    email: row.email,
    acceso: row.acceso,
    plan: row.plan || {},
    log: row.log || {},
    history: row.history || {},
    // Mediciones e historia clínica viven en "datos_clinicos" (solo staff). Si todavía no existe esa tabla, se usa la ficha.
    medidas: (clinicoDeEstePaciente ? clinicoDeEstePaciente.medidas : row.medidas) || [],
    // Foto de las mediciones que la nutricionista autorizó mostrarle al paciente (null = no compartió).
    compartidas: compartidaDeEstePaciente ? { datos: compartidaDeEstePaciente.datos || [], actualizado: compartidaDeEstePaciente.updated_at } : null,
    historiaClinica: (clinicoDeEstePaciente ? clinicoDeEstePaciente.historia_clinica : row.historia_clinica) || '',
    consultas: (consultasDeEstePaciente || [])
      .map((c) => ({ id: c.id, fecha: c.fecha, tipo: c.tipo }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    reportes: (reportesDeEstePaciente || [])
      .map((r) => ({ id: r.id, fechaA: r.fecha_a, fechaB: r.fecha_b, a: r.datos?.a, b: r.datos?.b, creado: r.created_at }))
      .sort((x, y) => y.creado.localeCompare(x.creado)),
    planes: (planesDeEstePaciente || [])
      .map((pl) => ({
        id: pl.id,
        fecha: pl.fecha, // fecha del plan (la elige la nutricionista)
        nombre: pl.nombre_archivo,
        ruta: pl.ruta,
        tamano: pl.tamano,
        creado: pl.created_at,
      }))
      .sort((a, b) => (b.fecha + b.creado).localeCompare(a.fecha + a.creado)),
    turnos: (turnosDeEstePaciente || []).map((t) => ({
      id: t.id,
      fecha: t.fecha,
      hora: (t.hora || '').slice(0, 5),
      motivo: t.motivo || '',
      avisar: t.avisar,
      tipo: t.tipo || null, // 'primera' | 'control' | null (sin clasificar)
    })),
  };
}

function buildPatientsDict(pacientes, turnos, planes, reportes, consultas, compartidas, clinicos) {
  const dict = {};
  (pacientes || []).forEach((p) => {
    dict[p.id] = mapPacienteRow(
      p,
      (turnos || []).filter((t) => t.paciente_id === p.id),
      (planes || []).filter((pl) => pl.paciente_id === p.id),
      (reportes || []).filter((r) => r.paciente_id === p.id),
      (consultas || []).filter((c) => c.paciente_id === p.id),
      (compartidas || []).find((c) => c.paciente_id === p.id) || null,
      (clinicos || []).find((c) => c.paciente_id === p.id) || null
    );
  });
  return dict;
}

export async function checkIsStaff(userId) {
  const { data, error } = await supabase.from('staff').select('id').eq('id', userId).maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function fetchAllPacientes() {
  const [{ data: pacientes, error: e1 }, { data: turnos, error: e2 }] = await Promise.all([
    supabase.from('pacientes').select('*').order('created_at', { ascending: true }),
    supabase.from('turnos').select('*').order('fecha', { ascending: true }).order('hora', { ascending: true }),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const [planes, reportes, consultas, compartidas, clinicos] = await Promise.all([fetchPlanes(), fetchReportes(), fetchConsultas(), fetchCompartidas(), fetchClinicos()]);
  return buildPatientsDict(pacientes, turnos, planes, reportes, consultas, compartidas, clinicos);
}

// Los planes se piden aparte: si todavía no se corrió el SQL de planes en Supabase,
// el resto de la app sigue funcionando (solo que sin planes).
async function fetchPlanes(pacienteId) {
  let q = supabase.from('planes').select('*');
  if (pacienteId) q = q.eq('paciente_id', pacienteId);
  const { data, error } = await q;
  if (error) {
    console.warn('No se pudieron cargar los planes:', error.message);
    return [];
  }
  return data || [];
}

// Igual que los planes: si todavía no se corrió el SQL, el resto de la app sigue andando.
async function fetchReportes(pacienteId) {
  let q = supabase.from('reportes_mediciones').select('*');
  if (pacienteId) q = q.eq('paciente_id', pacienteId);
  const { data, error } = await q;
  if (error) {
    console.warn('No se pudieron cargar los reportes de mediciones:', error.message);
    return [];
  }
  return data || [];
}

// Datos clínicos (mediciones + historia clínica): solo los puede leer la nutricionista.
async function fetchClinicos() {
  const { data, error } = await supabase.from('datos_clinicos').select('*');
  if (error) {
    console.warn('No se pudieron cargar los datos clínicos:', error.message);
    return [];
  }
  return data || [];
}

// Mediciones que la nutricionista autorizó mostrar. Si todavía no se corrió el SQL, nadie ve mediciones.
async function fetchCompartidas(pacienteId) {
  let q = supabase.from('mediciones_compartidas').select('*');
  if (pacienteId) q = q.eq('paciente_id', pacienteId);
  const { data, error } = await q;
  if (error) {
    console.warn('No se pudieron cargar las mediciones compartidas:', error.message);
    return [];
  }
  return data || [];
}

// Las consultas son solo para la nutricionista. Si todavía no se corrió el SQL, el resto sigue andando.
async function fetchConsultas() {
  const { data, error } = await supabase.from('consultas').select('*');
  if (error) {
    console.warn('No se pudieron cargar las consultas:', error.message);
    return [];
  }
  return data || [];
}

export async function fetchOwnPaciente(userId) {
  const [{ data: paciente, error: e1 }, { data: turnos, error: e2 }] = await Promise.all([
    supabase.from('pacientes').select('*').eq('id', userId).single(),
    supabase.from('turnos').select('*').eq('paciente_id', userId).order('fecha', { ascending: true }),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const [planes, reportes, compartidas] = await Promise.all([fetchPlanes(userId), fetchReportes(userId), fetchCompartidas(userId)]);
  const dict = buildPatientsDict([paciente], turnos, planes, reportes, [], compartidas);
  // El paciente solo ve las mediciones que la nutricionista autorizó (nunca la ficha completa).
  const yo = dict[userId];
  if (yo) yo.medidas = yo.compartidas ? yo.compartidas.datos : [];
  return dict;
}

// Traduce el "partial" con forma mock (plan, log, history, medidas,
// historiaClinica, acceso) a las columnas reales de la tabla pacientes.
export async function persistPaciente(id, partial) {
  const dbPatch = {};
  if ('acceso' in partial) dbPatch.acceso = partial.acceso;
  if ('plan' in partial) dbPatch.plan = partial.plan;
  if ('log' in partial) dbPatch.log = partial.log;
  if ('history' in partial) dbPatch.history = partial.history;
  // Mediciones e historia clínica van a la tabla privada (solo staff).
  const clinico = {};
  if ('medidas' in partial) clinico.medidas = partial.medidas;
  if ('historiaClinica' in partial) clinico.historia_clinica = partial.historiaClinica;
  if (Object.keys(clinico).length > 0) {
    const { error: errC } = await supabase.from('datos_clinicos').upsert({ paciente_id: id, ...clinico });
    if (errC) throw errC;
  }
  if ('name' in partial) dbPatch.nombre = partial.name;
  if ('genero' in partial) dbPatch.genero = partial.genero;
  if ('initials' in partial) dbPatch.iniciales = partial.initials;
  if (Object.keys(dbPatch).length === 0) return;
  const { error } = await supabase.from('pacientes').update(dbPatch).eq('id', id);
  if (error) throw error;
}

export async function addTurno(pacienteId, turno) {
  const { data, error } = await supabase
    .from('turnos')
    .insert({
      paciente_id: pacienteId,
      fecha: turno.fecha,
      hora: turno.hora,
      motivo: turno.motivo || '',
      avisar: turno.avisar ?? true,
      tipo: turno.tipo || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data; // incluye el id generado, para poder editar el turno al toque
}

export async function deleteTurno(pacienteId, fecha, hora) {
  const { error } = await supabase
    .from('turnos')
    .delete()
    .eq('paciente_id', pacienteId)
    .eq('fecha', fecha)
    .eq('hora', hora);
  if (error) throw error;
}

export async function updateTurno(turnoId, { fecha, hora, motivo, tipo }) {
  const { error } = await supabase
    .from('turnos')
    .update({ fecha, hora, motivo: motivo || '', tipo: tipo || null })
    .eq('id', turnoId);
  if (error) throw error;
}

// ---------- Ingresos: valores configurables por mes ----------
// Cada fila guarda, para un mes (primer día del mes), el valor de la primera
// consulta, el valor del control y el % que se queda la nutricionista. Para un
// mes sin fila propia se usa la más reciente anterior (ver Ingresos.jsx).
export async function fetchConfigIngresos() {
  const { data, error } = await supabase
    .from('config_ingresos')
    .select('*')
    .order('mes', { ascending: true });
  if (error) throw error;
  return (data || []).map((r) => ({
    mes: r.mes, // 'YYYY-MM-01'
    valorConsulta: Number(r.valor_consulta),
    valorControl: Number(r.valor_control),
    porcentaje: Number(r.porcentaje),
  }));
}

export async function saveConfigIngresos({ mes, valorConsulta, valorControl, porcentaje }) {
  const { error } = await supabase
    .from('config_ingresos')
    .upsert(
      { mes, valor_consulta: valorConsulta, valor_control: valorControl, porcentaje },
      { onConflict: 'mes' }
    );
  if (error) throw error;
}

// ---------- Consultas realizadas (primera consulta / control) ----------
export async function addConsulta(pacienteId, { fecha, tipo }) {
  const { data, error } = await supabase
    .from('consultas')
    .insert({ paciente_id: pacienteId, fecha, tipo })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateConsulta(consultaId, { fecha, tipo }) {
  const { error } = await supabase.from('consultas').update({ fecha, tipo }).eq('id', consultaId);
  if (error) throw error;
}

export async function deleteConsulta(consultaId) {
  const { error } = await supabase.from('consultas').delete().eq('id', consultaId);
  if (error) throw error;
}

// ---------- Mediciones compartidas (todas las mediciones, autorizadas por la nutricionista) ----------
// Guarda una copia de las mediciones actuales. Volver a compartir actualiza la copia.
export async function compartirMediciones(pacienteId, medidas) {
  const { data, error } = await supabase
    .from('mediciones_compartidas')
    .upsert({ paciente_id: pacienteId, datos: medidas, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function quitarMedicionesCompartidas(pacienteId) {
  const { error } = await supabase.from('mediciones_compartidas').delete().eq('paciente_id', pacienteId);
  if (error) throw error;
}

// ---------- Reportes de mediciones (comparaciones compartidas con el paciente) ----------
// Se guarda una copia de las dos mediciones comparadas. Solo la nutricionista los crea y los quita.
export async function compartirReporte(pacienteId, medicionA, medicionB) {
  const [a, b] = medicionA.fecha <= medicionB.fecha ? [medicionA, medicionB] : [medicionB, medicionA];
  const { data, error } = await supabase
    .from('reportes_mediciones')
    .insert({ paciente_id: pacienteId, fecha_a: a.fecha, fecha_b: b.fecha, datos: { a, b } })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function quitarReporte(reporteId) {
  const { error } = await supabase.from('reportes_mediciones').delete().eq('id', reporteId);
  if (error) throw error;
}

// ---------- Planes de alimentación (archivos) ----------
// Los archivos van al bucket privado "planes" de Supabase Storage, en una carpeta
// por paciente (<pacienteId>/<archivo>), y cada archivo tiene una fila en la tabla
// "planes" con su fecha. Solo la nutricionista sube/borra; el paciente solo descarga lo suyo.
const BUCKET_PLANES = 'planes';
const MIME_POR_EXTENSION = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

export async function subirPlan(pacienteId, archivo, fecha) {
  const ext = (archivo.name.split('.').pop() || '').toLowerCase();
  const limpio = archivo.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
  const ruta = `${pacienteId}/${crypto.randomUUID()}-${limpio}`;
  const contentType = archivo.type || MIME_POR_EXTENSION[ext] || 'application/octet-stream';

  const { error: upErr } = await supabase.storage.from(BUCKET_PLANES).upload(ruta, archivo, { contentType, upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from('planes')
    .insert({ paciente_id: pacienteId, fecha, nombre_archivo: archivo.name, ruta, tipo: contentType, tamano: archivo.size })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(BUCKET_PLANES).remove([ruta]); // no dejar el archivo huérfano
    throw error;
  }
  return data;
}

export async function eliminarPlan(plan) {
  const { error } = await supabase.from('planes').delete().eq('id', plan.id);
  if (error) throw error;
  const { error: errFile } = await supabase.storage.from(BUCKET_PLANES).remove([plan.ruta]);
  if (errFile) console.warn('Se borró el plan pero quedó el archivo en Storage:', errFile.message);
}

// Borra los archivos de un paciente (se usa antes de eliminarlo por completo,
// porque al borrar el usuario las filas se van en cascada pero los archivos no).
export async function borrarArchivosDePlanes(rutas) {
  if (!rutas || rutas.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET_PLANES).remove(rutas);
  if (error) console.warn('No se pudieron borrar algunos archivos de planes:', error.message);
}

// Genera un link temporal (2 minutos) y dispara la descarga con el nombre original.
export async function descargarPlan(plan) {
  const { data, error } = await supabase.storage
    .from(BUCKET_PLANES)
    .createSignedUrl(plan.ruta, 120, { download: plan.nombre });
  if (error) throw error;
  const a = document.createElement('a');
  a.href = data.signedUrl;
  a.download = plan.nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Cuando una Edge Function responde con un status distinto de 2xx, supabase-js
// tira un error "genérico" (FunctionsHttpError) y no nos da el mensaje real
// que mandamos nosotros en el body ({ error: "..." }). Hay que leerlo a mano
// desde el Response que viene en error.context.
async function mensajeDeErrorFuncion(error) {
  try {
    if (error?.context && typeof error.context.json === 'function') {
      const body = await error.context.json();
      if (body?.error) return body.error;
    }
  } catch {
    // si no se pudo parsear, seguimos con el mensaje genérico de abajo
  }
  return error?.message || 'Error desconocido';
}

export async function invitarPaciente({ nombre, email, genero }) {
  const { data, error } = await supabase.functions.invoke('invite-patient', {
    body: { nombre, email, genero },
  });
  if (error) throw new Error(await mensajeDeErrorFuncion(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

// Da de alta al paciente directo, sin mandar ningún mail: genera una
// contraseña temporal y la devuelve para que Florencia se la pase al
// paciente por el medio que prefiera (WhatsApp, en persona, etc). El
// paciente entra con su email + esa contraseña.
export async function crearPacienteConClave({ nombre, email, genero }) {
  const { data, error } = await supabase.functions.invoke('create-patient', {
    body: { nombre, email, genero },
  });
  if (error) throw new Error(await mensajeDeErrorFuncion(error));
  if (data?.error) throw new Error(data.error);
  return data; // { ok, user, password }
}

// Borra al paciente por completo: su usuario de Supabase Auth y, en cascada,
// su ficha y sus turnos. Pensado para que Florencia (que no tiene acceso al
// panel de Supabase) pueda deshacer una invitación o un alta mal hecha desde
// la propia app.
export async function eliminarPaciente(pacienteId) {
  const { data, error } = await supabase.functions.invoke('delete-patient', {
    body: { pacienteId },
  });
  if (error) throw new Error(await mensajeDeErrorFuncion(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

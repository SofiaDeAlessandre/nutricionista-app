export const MEAL_ORDER = ['desayuno', 'colacion', 'almuerzo', 'merienda', 'cena'];

export const MEAL_LABELS = {
  desayuno: 'Desayuno',
  colacion: 'Colación',
  almuerzo: 'Almuerzo',
  merienda: 'Merienda',
  cena: 'Cena',
};

export const DET_DATES = [25, 26, 27, 28, 29, 30, 31];
export const DET_DAY_LABELS = {
  25: 'Lunes 25', 26: 'Martes 26', 27: 'Miércoles 27 (hoy)',
  28: 'Jueves 28', 29: 'Viernes 29', 30: 'Sábado 30', 31: 'Domingo 31',
};
export const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// "Hoy": la fecha real del momento en que se abre la app (hora de la computadora/celular).
const _ahora = new Date();
export const TODAY = { year: _ahora.getFullYear(), month: _ahora.getMonth(), day: _ahora.getDate() }; // month: 0 = enero
export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function fechaKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
export function firstWeekdayMonday(year, month) {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

// Campos de cada medición. Todos son obligatorios al cargar una medición nueva.
// Para sumar un campo, agregalo acá (con obligatorio: true si hay que pedirlo siempre):
// aparece solo en el formulario y en las tablas (de la nutricionista y del paciente).
export const MEDIDA_CAMPOS = [
  { key: 'peso', label: 'Peso (kg)', decimales: 1, obligatorio: true, min: 20, max: 400 },
  { key: 'cintura', label: 'Cintura (cm)', obligatorio: true, min: 30, max: 250 },
  { key: 'cadera', label: 'Cadera (cm)', obligatorio: true, min: 30, max: 250 },
  { key: 'grasa', label: 'Grasa corporal (%)', decimales: 1, obligatorio: true, min: 1, max: 80 },
  { key: 'musculo', label: 'Masa muscular (kg)', decimales: 1, obligatorio: true, min: 5, max: 200 },
];

// Convierte lo que se escribió en un campo de medición a número. Acepta coma o punto
// como separador decimal ("77,5" y "77.5" dan 77.5). Devuelve NaN si no es un número válido
// (por ejemplo "1.234,5" o letras), para no guardar nunca un valor mal interpretado.
export function parseDecimal(texto) {
  const t = String(texto ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  return Number(t);
}

const tieneValor = (v) => v !== undefined && v !== null && v !== '';

// Columnas a mostrar en una tabla: siempre peso y cintura; los demás solo si
// al menos una medición los cargó (así la tabla no se llena de columnas vacías).
export function columnasMedidas(medidas) {
  return MEDIDA_CAMPOS.filter((c) => c.obligatorio || (medidas || []).some((m) => tieneValor(m[c.key])));
}

export function formatMedida(campo, valor) {
  if (!tieneValor(valor)) return '—';
  const n = Number(valor);
  return campo.decimales ? n.toFixed(campo.decimales) : String(n);
}

// Mediciones corporales: cargadas por consulta, visibles para la nutricionista y el paciente.
const measurementSeries = (base) => ([
  { fecha: '2026-07-02', peso: base.peso + 2.4, cintura: base.cintura + 3, notas: 'Primera consulta' },
  { fecha: '2026-08-01', peso: base.peso + 1.1, cintura: base.cintura + 1.5, notas: 'Buena adherencia al plan' },
  { fecha: '2026-08-27', peso: base.peso, cintura: base.cintura, notas: 'Sigue bajando de a poco' },
]);

// Historia clínica: solo la ve la nutricionista.
const clinicalNote = (txt) => txt;

export const PATIENTS = {
  sofia: {
    name: 'Sofía De Dalessandre', initials: 'SD', genero: 'F',
    plan: {
      desayuno: 'Tostada de pan integral con huevo y clara + puñado de almendras + café',
      colacion: 'Yogur descremado light',
      almuerzo: 'Milanesa de pollo al horno con ensalada de zanahoria y huevo duro',
      merienda: 'Infusión + tostada de arroz con queso untable y jamón',
      cena: 'Pechuga de pollo con verduras a elección, al horno o salteadas',
    },
    log: {
      desayuno: { txt: 'Tostada de pan integral con huevo y clara + almendras + café', time: '08:15' },
      colacion: { txt: 'Yogur descremado light', time: '11:00' },
      almuerzo: { txt: 'Milanesa de pollo al horno con ensalada de zanahoria y huevo duro', time: '13:40' },
      merienda: { txt: 'Infusión + tostada de arroz con queso untable y jamón', time: '17:30' },
      cena: null,
    },
    history: {
      27: { desayuno: 'Tostada integral con huevo y clara + almendras + café', colacion: 'Yogur descremado light', almuerzo: 'Milanesa de pollo al horno con ensalada de zanahoria', merienda: 'Infusión + tostada de arroz con queso y jamón' },
      26: { desayuno: 'Tostada de arroz con queso untable + huevo', colacion: 'Una fruta', almuerzo: 'Bife con verduras cocidas y media papa', merienda: 'Yogur light con frutos secos', cena: 'Tortilla de espinaca con ensalada' },
      25: { desayuno: 'Rapidita integral con huevo, clara y palta', colacion: 'Barrita Integra', almuerzo: 'Tarta de verdura y pollo + ensalada', merienda: 'Infusión + panqueque de avena', cena: 'Omelette de queso con sopa de verduras' },
      24: { desayuno: 'Tostada integral con huevo', almuerzo: 'Milanesa al horno con ensalada' },
      23: { desayuno: 'Tostada de arroz con queso y huevo', colacion: 'Yogur descremado', almuerzo: 'Pechuga con calabaza y queso por salud', merienda: 'Infusión + fruta', cena: 'Revuelto de zapallitos' },
    },
    medidas: measurementSeries({ peso: 68.2, cintura: 82 }),
    historiaClinica: clinicalNote(
      'Sin patologías de base declaradas. Objetivo: bajar de peso de forma sostenida, buena adherencia. ' +
      'Refiere horarios laborales cambiantes que a veces complican el almuerzo. Se ajustó plan para incluir opciones rápidas.'
    ),
    turnos: [
      { fecha: '2026-08-29', hora: '16:00', motivo: 'Control de peso' },
      { fecha: '2026-09-10', hora: '11:00', motivo: 'Consulta de seguimiento' },
    ],
  },
  martina: {
    name: 'Martina Ruiz', initials: 'MR', genero: 'F',
    plan: {
      desayuno: 'Infusión + tostada integral con queso untable y fruta',
      colacion: 'Barrita Integra',
      almuerzo: '1 bife con verduras cocidas y media papa',
      merienda: 'Yogur descremado light + frutos secos',
      cena: 'Tortilla de espinaca con ensalada a elección',
    },
    log: {
      desayuno: { txt: 'Infusión + tostada integral con queso untable y una mandarina', time: '08:40' },
      colacion: { txt: 'Barrita Integra', time: '11:15' },
      almuerzo: { txt: 'Bife con verduras al horno y media papa', time: '13:50' },
      merienda: null,
      cena: null,
    },
    history: { 27: { desayuno: 'Infusión + tostada integral con queso y mandarina', colacion: 'Barrita Integra', almuerzo: 'Bife con verduras al horno y media papa' } },
    medidas: measurementSeries({ peso: 61.5, cintura: 74 }),
    historiaClinica: clinicalNote('Hipotiroidismo compensado bajo tratamiento médico. Controlar consumo de sodio. Buena tolerancia al plan actual.'),
  },
  carlos: {
    name: 'Carlos Gómez', initials: 'CG', genero: 'M',
    plan: {
      desayuno: 'Infusión + dos tostadas de arroz con queso untable y huevo',
      colacion: 'Un puñado de frutos secos',
      almuerzo: 'Pechuga de pollo con calabaza y queso por salud',
      merienda: 'Yogur natural con fruta',
      cena: 'Sopa de verduras sin fideos + omelette de queso',
    },
    log: { desayuno: null, colacion: null, almuerzo: null, merienda: null, cena: null },
    history: {},
    medidas: measurementSeries({ peso: 89.0, cintura: 101 }),
    historiaClinica: clinicalNote('Hipertensión arterial, en tratamiento. Sin registros de carga esta semana — hacer seguimiento telefónico.'),
  },
  elena: {
    name: 'Elena Beltrán', initials: 'EB', genero: 'F',
    plan: {
      desayuno: 'Infusión + rapidita integral con huevo y palta',
      colacion: 'Una fruta',
      almuerzo: 'Milanesa de pollo al horno con ensalada de zanahoria',
      merienda: 'Infusión + panqueque de avena',
      cena: 'Tortilla de espinaca o acelga con ensalada a elección',
    },
    log: {
      desayuno: { txt: 'Rapidita integral con huevo y un cuarto de palta', time: '07:50' },
      colacion: { txt: 'Una manzana', time: '10:30' },
      almuerzo: { txt: 'Milanesa de pollo al horno con ensalada de zanahoria', time: '13:10' },
      merienda: { txt: 'Panqueque de avena con media banana', time: '17:00' },
      cena: { txt: 'Tortilla de espinaca con ensalada mixta', time: '21:15' },
    },
    history: { 27: { desayuno: 'Rapidita integral con huevo y palta', colacion: 'Una manzana', almuerzo: 'Milanesa al horno con ensalada de zanahoria', merienda: 'Panqueque de avena', cena: 'Tortilla de espinaca con ensalada mixta' } },
    medidas: measurementSeries({ peso: 57.8, cintura: 68 }),
    historiaClinica: clinicalNote('Sin antecedentes relevantes. Deportista amateur (running 3 veces por semana), plan ajustado a su gasto energético.'),
  },
  julian: {
    name: 'Julián Peralta', initials: 'JP', genero: 'M',
    plan: {
      desayuno: 'Infusión + 2 huevos revueltos con tostadas integrales',
      colacion: 'Un puñado de almendras',
      almuerzo: 'Bife con verduras cocidas y media papa',
      merienda: 'Yogur natural con avena',
      cena: 'Pechuga de pollo con ensalada mixta',
    },
    log: {
      desayuno: { txt: 'Infusión + 2 huevos revueltos con tostadas', time: '08:05' },
      colacion: { txt: 'Un puñado de almendras', time: '10:45' },
      almuerzo: { txt: 'Bife con verduras cocidas y media papa', time: '13:30' },
      merienda: null,
      cena: null,
    },
    history: { 27: { desayuno: 'Infusión + huevos revueltos con tostadas', colacion: 'Almendras', almuerzo: 'Bife con verduras cocidas y media papa' } },
    medidas: measurementSeries({ peso: 95.4, cintura: 108 }),
    historiaClinica: clinicalNote('Diabetes tipo 2, en seguimiento con clínico. Priorizar bajo índice glucémico en colaciones.'),
  },
  noelia: {
    name: 'Noelia Acosta', initials: 'NA', genero: 'F',
    plan: {
      desayuno: 'Infusión + yogur con granola casera',
      colacion: 'Una fruta de estación',
      almuerzo: 'Milanesa de pollo al horno con puré de calabaza',
      merienda: 'Licuado de banana con leche descremada',
      cena: 'Pechuga con calabaza y queso por salud',
    },
    log: {
      desayuno: { txt: 'Infusión + yogur con granola casera', time: '07:40' },
      colacion: { txt: 'Una manzana verde', time: '10:20' },
      almuerzo: { txt: 'Milanesa de pollo al horno con puré de calabaza', time: '13:15' },
      merienda: { txt: 'Licuado de banana con leche descremada', time: '17:10' },
      cena: { txt: 'Pechuga con calabaza y queso por salud', time: '21:00' },
    },
    history: { 27: { desayuno: 'Yogur con granola casera', colacion: 'Manzana verde', almuerzo: 'Milanesa al horno con puré de calabaza', merienda: 'Licuado de banana', cena: 'Pechuga con calabaza y queso' } },
    medidas: measurementSeries({ peso: 64.1, cintura: 76 }),
    historiaClinica: clinicalNote('Sin antecedentes relevantes. Embarazo de 14 semanas — plan supervisado junto a su obstetra.'),
  },
  matias: {
    name: 'Matías Fernández', initials: 'MF', genero: 'M',
    plan: {
      desayuno: 'Café con leche descremada + tostadas integrales con queso untable',
      colacion: 'Barrita de cereal',
      almuerzo: 'Arroz integral con pollo y verduras salteadas',
      merienda: 'Yogur descremado con nueces',
      cena: 'Sopa de verduras + omelette de queso',
    },
    log: { desayuno: null, colacion: null, almuerzo: null, merienda: null, cena: null },
    history: {},
    medidas: measurementSeries({ peso: 78.6, cintura: 92 }),
    historiaClinica: clinicalNote('Colesterol LDL elevado en último análisis. Reforzar consumo de fibra y controlar grasas saturadas.'),
  },
  valentina: {
    name: 'Valentina Suárez', initials: 'VS', genero: 'F',
    plan: {
      desayuno: 'Infusión + tostada integral con palta y huevo',
      colacion: 'Un puñado de frutos secos',
      almuerzo: 'Ensalada completa con atún y huevo duro',
      merienda: 'Yogur descremado light',
      cena: 'Tortilla de zapallitos con ensalada',
    },
    log: {
      desayuno: { txt: 'Infusión + tostada integral con palta y huevo', time: '08:20' },
      colacion: null,
      almuerzo: { txt: 'Ensalada completa con atún y huevo duro', time: '13:25' },
      merienda: null,
      cena: null,
    },
    history: { 27: { desayuno: 'Tostada integral con palta y huevo', almuerzo: 'Ensalada con atún y huevo duro' } },
    medidas: measurementSeries({ peso: 59.3, cintura: 71 }),
    historiaClinica: clinicalNote('Intolerancia leve a la lactosa, evita lácteos comunes, usa opciones deslactosadas o vegetales.'),
  },
};

export function statusOf(p) {
  const vals = MEAL_ORDER.map((k) => p.log[k]);
  const filled = vals.filter(Boolean).length;
  if (filled === MEAL_ORDER.length) return { cls: 'g', label: 'Completo hoy' };
  if (filled === 0) return { cls: 'm', label: 'Sin registrar' };
  const missing = MEAL_ORDER.filter((k) => !p.log[k]).map((k) => MEAL_LABELS[k]);
  return { cls: 'a', label: 'Falta ' + missing.join(', ').toLowerCase() };
}

export function registroDelDia(p, dayIndex) {
  const day = DET_DATES[dayIndex];
  if (dayIndex === 2) { // índice 2 = "hoy" en la vista del paciente
    const reg = {};
    MEAL_ORDER.forEach((k) => { reg[k] = p.log[k]; });
    return reg;
  }
  const h = p.history[day] || {};
  const reg = {};
  MEAL_ORDER.forEach((k) => { reg[k] = h[k] ? { txt: h[k], time: null } : null; });
  return reg;
}

export function statusForDay(p, day) {
  const h = day === TODAY.day
    ? Object.fromEntries(MEAL_ORDER.filter((k) => p.log[k]).map((k) => [k, p.log[k].txt]))
    : (p.history[day] || {});
  const filled = MEAL_ORDER.filter((k) => h[k]).length;
  if (filled === 0) return 'm';
  if (filled === MEAL_ORDER.length) return 'g';
  return 'a';
}

// ---------- Gestión de accesos / altas de pacientes ----------

export const ESTADO_LABEL = { activo: 'Activo', invitado: 'Invitación enviada', inactivo: 'Inactivo' };

// Verde para varones, rosa para mujeres — así lo pidió Florencia para el mosaico.
export function avatarColor(genero) {
  return genero === 'M' ? 'var(--green)' : 'var(--pink)';
}

export function initialsFromName(nombre) {
  const parts = nombre.trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function emailFromName(nombre) {
  const base = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, '.');
  return `${base}@gmail.com`;
}

// Paciente nuevo invitado desde "Gestión de accesos": arranca con el plan y las
// mediciones vacías para que la nutricionista los cargue antes o después de que
// el paciente confirme su cuenta.
export function blankPatient({ nombre, email, genero }) {
  return {
    name: nombre,
    initials: initialsFromName(nombre),
    genero: genero || 'F',
    email: email || emailFromName(nombre),
    plan: Object.fromEntries(MEAL_ORDER.map((k) => [k, ''])),
    log: Object.fromEntries(MEAL_ORDER.map((k) => [k, null])),
    history: {},
    medidas: [],
    historiaClinica: '',
    turnos: [],
    acceso: 'invitado',
  };
}

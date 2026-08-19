// ============================================================================
// Tiny in-game translation layer (English / Español).
//
// Design: the dictionary is keyed by the ENGLISH source string, so every
// existing `k.text(...)` call site keeps reading naturally in code while the
// rendered glyphs switch language. `t()` is the single entry point; it is
// applied inside the game's text helpers so nothing has to be threaded
// through the scene graph.
//
// Lookup order: exact match → line-by-line (multi-line blocks) → pattern
// rules (counters like "SCORE 1200") → the original English (never blank).
// ============================================================================

export type Lang = "en" | "es";

const STORAGE_KEY = "btt.lang";
export const LANG_EVENT = "btt-lang-change";

let current: Lang = "en";

function read(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

if (typeof window !== "undefined") current = read();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* private mode — language still applies for this session */
  }
  window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: lang }));
}

/** Spanish text for every player-facing English string in the game. */
const ES: Record<string, string> = {
  // ---- Title / shell -------------------------------------------------
  "BLAZING THE TRAIL": "ABRIENDO EL CAMINO",
  "to Coverage": "hacia la Cobertura",
  "PRESS START": "PULSA START",
  START: "EMPEZAR",
  "START GAME": "JUGAR",
  CONTROLS: "CONTROLES",
  "HOW TO PLAY": "CÓMO JUGAR",
  "PLAY AGAIN": "JUGAR OTRA VEZ",
  "TRY AGAIN": "INTENTAR DE NUEVO",
  BACK: "ATRÁS",
  CONTINUE: "CONTINUAR",
  "▶ CONTINUE": "▶ CONTINUAR",
  "FULL SCREEN": "PANTALLA COMPLETA",
  "FULLSCREEN": "PANTALLA COMPLETA",
  "EXIT FULL SCREEN": "SALIR DE PANTALLA COMPLETA",
  LANGUAGE: "IDIOMA",
  "THE JOURNEY": "EL RECORRIDO",
  "JOURNEY MAP": "MAPA DEL RECORRIDO",
  "Tap Anywhere to Continue": "Toca la pantalla para continuar",
  "Press Enter, Space, or Click to Continue":
    "Pulsa Enter, Espacio o haz clic para continuar",
  "Tap when you're READY": "Toca cuando estés LISTO",
  "Press Enter, Space, or Click when you're READY":
    "Pulsa Enter, Espacio o haz clic cuando estés LISTO",
  "Tap JUMP": "Toca SALTAR",
  "Jump (Up Arrow or Space)": "Salta (Flecha Arriba o Espacio)",
  "Tap the screen to enter your score\nand tell us what to improve":
    "Toca la pantalla para registrar tu puntuación\ny decirnos qué mejorar",
  "Press R or Enter to enter your score\nand tell us what to improve":
    "Pulsa R o Enter para registrar tu puntuación\ny decirnos qué mejorar",
  "MOVE": "MOVERSE",
  "JUMP": "SALTAR",
  "PAUSE": "PAUSA",
  "RESTART": "REINICIAR",
  "Arrow Keys or A / D": "Flechas o A / D",

  // ---- Awaiting Decision (calendar rain) ------------------------------
  "Dodge the dates for 10 seconds — then they stop.":
    "Esquiva las fechas 10 segundos: luego se detienen.",
  "Avoid the falling calendar dates for 10 seconds.":
    "Evita las fechas del calendario durante 10 segundos.",
  "If a date hits you, the 10 seconds start over.":
    "Si una fecha te golpea, los 10 segundos empiezan de nuevo.",
  "Make it 10 seconds and the dates stop falling —":
    "Aguanta 10 segundos y las fechas dejan de caer:",
  "then walk right through the unlocked door.":
    "luego camina a la derecha y cruza la puerta abierta.",
  "Hit! The 10 seconds start over.": "¡Golpe! Los 10 segundos empiezan de nuevo.",
  "Approved — the calendar stops. Head right to the door.":
    "Aprobado: el calendario se detiene. Ve a la derecha hacia la puerta.",

  // ---- Warm-up (practice trail) ---------------------------------------
  "WARM-UP · PRACTICE TRAIL": "CALENTAMIENTO · SENDERO DE PRÁCTICA",
  "WARM-UP": "CALENTAMIENTO",
  "TRAIL HEAD": "INICIO DEL SENDERO",
  "READY!": "¡LISTO!",
  COLLECT: "RECOGER",
  "DOUBLE JUMP": "SALTO DOBLE",
  "☐ DOUBLE JUMP": "☐ SALTO DOBLE",
  "✓ DOUBLE JUMP": "✓ SALTO DOBLE",
  "Tap JUMP again in mid-air to jump twice":
    "Toca SALTAR otra vez en el aire para saltar dos veces",
  "Press jump again in mid-air to jump twice":
    "Pulsa saltar otra vez en el aire para saltar dos veces",
  "Double jump! Tap jump again in mid-air for extra height.":
    "¡Salto doble! Toca saltar otra vez en el aire para llegar más alto.",
  "Double jump (press again in mid-air)": "Salto doble (pulsa otra vez en el aire)",
  "Double jump (tap again in mid-air)": "Salto doble (toca otra vez en el aire)",
  GRAB: "TOMAR",
  KEY: "LLAVE",
  "PICK ONE": "ELIGE UNO",
  "Practice here. Nothing can hurt you.": "Practica aquí. Nada puede hacerte daño.",
  "Practice here — nothing can hurt you. Move, jump and grab the pack.":
    "Practica aquí — nada puede hacerte daño. Muévete, salta y toma la mochila.",
  "Slide the joystick left and right": "Desliza la palanca a izquierda y derecha",
  "Arrow keys or A / D": "Flechas o A / D",
  "Tap the JUMP button": "Toca el botón SALTAR",
  "Space or Up Arrow to jump": "Espacio o Flecha Arriba para saltar",
  "Bump the brick above you": "Golpea el ladrillo de arriba",
  "Nice grab! That's how you pick things up.":
    "¡Bien hecho! Así se recogen las cosas.",
  "Try moving, jumping and grabbing the pack.":
    "Prueba moverte, saltar y tomar la mochila.",
  "You're ready — go through the door to start.":
    "Estás listo: cruza la puerta para empezar.",
  "SKIP WARM-UP": "SALTAR CALENTAMIENTO",
  "SKIP WARM-UP (ENTER)": "SALTAR CALENTAMIENTO (ENTER)",
  "☐ MOVE": "☐ MOVERSE",
  "✓ MOVE": "✓ MOVERSE",
  "☐ JUMP": "☐ SALTAR",
  "✓ JUMP": "✓ SALTAR",
  "☐ COLLECT": "☐ RECOGER",
  "✓ COLLECT": "✓ RECOGER",
  "Up Arrow, W or Space": "Flecha Arriba, W o Espacio",

  // ---- HUD -----------------------------------------------------------
  SCORE: "PUNTOS",
  TIME: "TIEMPO",
  LIVES: "VIDAS",
  APPLICATIONS: "SOLICITUDES",
  "ACTIVE UPGRADES": "MEJORAS ACTIVAS",
  "ASSETS · press D": "RECURSOS · pulsa D",
  "+1 LIFE!": "¡+1 VIDA!",
  "1-UP": "1-UP",
  "EXTRA LIFE": "VIDA EXTRA",
  "Extra life! You're back in the game.": "¡Vida extra! Vuelves al camino.",
  "Full on lives — bonus points instead!": "Vidas al máximo: ¡puntos extra!",

  // ---- Zone names / phases -------------------------------------------
  "Finding the Trail": "Encontrando el Camino",
  "Setting Up Camp": "Montando el Campamento",
  "Crossing River of Paperwork": "Cruzando el Río de Papeleo",
  "Crossing the River of Paperwork": "Cruzando el Río de Papeleo",
  "Gathering Supplies": "Reuniendo Provisiones",
  "Answering the Call": "Respondiendo la Llamada",
  "Waiting Mountain": "La Montaña de la Espera",
  "Choosing Your Path": "Eligiendo Tu Camino",
  "Boss Battle · Choosing Your Path": "Batalla Final · Eligiendo Tu Camino",
  "Coverage Begins": "Comienza la Cobertura",
  "Step 1 · Learn you may qualify": "Paso 1 · Descubre si puedes calificar",
  "Step 2 · Create your account": "Paso 2 · Crea tu cuenta",
  "Step 3 · Start your application": "Paso 3 · Inicia tu solicitud",
  "Step 4 · Gather your documents": "Paso 4 · Reúne tus documentos",
  "Step 5 · Respond to requests for info": "Paso 5 · Responde a las solicitudes de información",
  "Step 6 · Await a decision": "Paso 6 · Espera una decisión",
  "Step 7 · Choose a health plan": "Paso 7 · Elige un plan de salud",
  "Step 8 · Enroll in coverage": "Paso 8 · Inscríbete en la cobertura",

  // ---- Step / briefing screens ---------------------------------------
  "STEP 1 · SELECTING YOUR APPLICATION TYPE": "PASO 1 · ELIGIENDO TU TIPO DE SOLICITUD",
  "STEP 2 · CREATING YOUR ACCOUNT": "PASO 2 · CREANDO TU CUENTA",
  "STEP 3 · COMPLETING YOUR APPLICATION": "PASO 3 · COMPLETANDO TU SOLICITUD",
  "STEP 4 · GATHER YOUR DOCUMENTS": "PASO 4 · REÚNE TUS DOCUMENTOS",
  "STEP 5 · RESPOND TO REQUEST": "PASO 5 · RESPONDE A LA SOLICITUD",
  "STEP 6 · AWAITING DECISION": "PASO 6 · ESPERANDO LA DECISIÓN",
  "STEP 7 · SELECTING YOUR MANAGED CARE PLAN": "PASO 7 · ELIGIENDO TU PLAN DE SALUD",
  "STEP 8 · ENROLLED": "PASO 8 · INSCRITO",
  "STEP 8 · USING YOUR COVERAGE": "PASO 8 · USANDO TU COBERTURA",
  "Bring the application to the exit door.": "Lleva la solicitud a la puerta de salida.",
  "Collect the Username item.": "Recoge el Usuario.",
  "Collect the Password item.": "Recoge la Contraseña.",
  "Jump over the Account Locks.": "Salta sobre los Candados de Cuenta.",
  EXIT: "SALIDA",
  "Walk into the door to rejoin the trail":
    "Entra por la puerta para volver al camino",
  "Account Locks hurt — jump OVER them; stomping does not work.":
    "Los Candados de Cuenta hacen daño: salta sobre ellos o pierdes una vida.",
  "Evil Clipboards hurt — jump OVER them; stomping does not work.":
    "Los Portapapeles Malvados hacen daño: salta sobre ellos o pierdes una vida.",
  "Monster Envelopes hurt — jump OVER them; stomping does not work.":
    "Los Sobres Monstruo hacen daño: salta sobre ellos o pierdes una vida.",
  "A date that touches you costs a life and restarts the 10 seconds.":
    "Una hoja que te toque te cuesta una vida y reinicia los 10 segundos.",
  "! NEVER TOUCH A RED-MARKED ENEMY — JUMP OVER IT !":
    "¡ NUNCA TOQUES A UN ENEMIGO MARCADO EN ROJO — SALTA SOBRE ÉL !",
  AVOID: "EVITAR",
  "JUMP OVER — NO STOMPING!": "¡SALTA POR ENCIMA — NO LO PISES!",
  "You can't squash me — jump OVER, not on me!":
    "No puedes aplastarme: salta POR ENCIMA, no sobre mí.",
  "Jumping ON an enemy still hurts — clear it with a full jump.":
    "Caer SOBRE un enemigo también hace daño: sáltalo por completo.",
  ENEMY: "ENEMIGO",
  "No stomping! That would have cost a life — jump over enemies.":
    "¡No los pises! Eso te habría costado una vida: salta por encima de los enemigos.",
  "Perfect — over the top, never on top.":
    "Perfecto: por encima, nunca encima de él.",
  "Platforms fall away once you step on them — keep moving!":
    "Las plataformas caen al pisarlas: ¡no te detengas!",
  "Reaching the other side unlocks the exit door.":
    "Llegar al otro lado abre la puerta de salida.",
  "Collect all 3 required documents.": "Recoge los 3 documentos requeridos.",
  "Jump over the Evil Clipboards.": "Salta sobre los Portapapeles Malvados.",
  "Collect all 4 mailboxes.": "Recoge los 4 buzones.",
  "Jump over the Monster Envelopes.": "Salta sobre los Sobres Monstruo.",
  "Avoid the falling calendar dates.": "Esquiva las hojas de calendario que caen.",
  "Survive for 10 seconds without being hit.": "Sobrevive 10 segundos sin recibir golpes.",
  "The exit door unlocks automatically.": "La puerta de salida se abre automáticamente.",
  "Three managed care plans are waiting ahead.": "Tres planes de salud te esperan más adelante.",
  "Step up and pick ONE plan": "Sube y elige UN plan",
  "Choose the plan that best fits your household.":
    "Elige el plan que mejor le sirva a tu hogar.",
  "Choose a health plan and grab the key.": "Elige un plan de salud y toma la llave.",
  "Climb the staircase.": "Sube la escalera.",
  "Collect your Medical ID Card.": "Recoge tu Tarjeta Médica.",
  "Walk up to one and select it to move forward.":
    "Acércate a uno y selecciónalo para avanzar.",
  "Every journey starts by choosing how you'll apply.":
    "Todo recorrido empieza eligiendo cómo vas a solicitar.",
  "You need an account before you can apply online.":
    "Necesitas una cuenta antes de solicitar en línea.",
  "Cross the river of paperwork to reach the door.":
    "Cruza el río de papeleo para llegar a la puerta.",
  "Gather everything you need before continuing.":
    "Reúne todo lo que necesitas antes de continuar.",
  "The agency asked for more info — respond quickly.":
    "La agencia pidió más información: responde rápido.",
  "Wait for your decision — the door will unlock in time.":
    "Espera tu decisión: la puerta se abrirá a su tiempo.",
  "One final step remains before coverage begins.":
    "Queda un último paso antes de que comience la cobertura.",
  "Don't stop now — you're almost enrolled!": "¡No pares ahora, ya casi estás inscrito!",
  "Double-check your application before submitting.":
    "Revisa bien tu solicitud antes de enviarla.",
  "Stay on the trail — you're almost there.": "Sigue en el camino: ya casi llegas.",

  // ---- World labels / signs ------------------------------------------
  APPLICATION: "SOLICITUD",
  "APPLICATIO / N": "SOLICI / TUD",
  USERNAME: "USUARIO",
  PASSWORD: "CONTRASEÑA",
  "ACCOUNT LOCK": "CANDADO DE CUENTA",
  PLATFORM: "PLATAFORMA",
  "EVIL CLIPBOARD": "PORTAPAPELES MALVADO",
  MAILBOX: "BUZÓN",
  "MONSTER ENVELOPE": "SOBRE MONSTRUO",
  "FALLING DATE": "FECHA QUE CAE",
  "MEDICAL ID CARD": "TARJETA MÉDICA",
  PLAN: "PLAN",
  STAIRS: "ESCALERAS",
  SIGNATURE: "FIRMA",
  Signature: "Firma",
  HOUSEHOLD: "HOGAR",
  Household: "Hogar",
  INCOME: "INGRESOS",
  Income: "Ingresos",
  "ABOUT YOU": "SOBRE TI",
  "About You": "Sobre ti",
  MAIL: "CORREO",
  ONLINE: "EN LÍNEA",
  PHONE: "TELÉFONO",
  "IN PERSON": "EN PERSONA",
  "Apply by Mail": "Solicitar por Correo",
  "Apply Online": "Solicitar en Línea",
  "Apply by Phone": "Solicitar por Teléfono",
  "Apply In Person": "Solicitar en Persona",
  "LOOK OUT FOR BEARS!": "¡CUIDADO CON LOS OSOS!",
  "CROSS THE RIVER →": "CRUZA EL RÍO →",
  "GRAB KEY →": "TOMA LA LLAVE →",
  "SLIDE DOWN →": "BAJA POR EL POSTE →",
  "APPROVED! →": "¡APROBADO! →",
  "APPROVED!": "¡APROBADO!",
  "DOOR OPEN  →": "PUERTA ABIERTA  →",
  "Go right to the door": "Ve a la derecha hacia la puerta",
  "AWAITING DECISION": "ESPERANDO DECISIÓN",
  "STEP INTO THE MOUNTAIN": "ENTRA EN LA MONTAÑA",
  "Awaiting a decision": "Esperando una decisión",
  "Awaiting a decision…": "Esperando una decisión…",
  "REVIEW IN PROGRESS": "REVISIÓN EN CURSO",
  "★ COVERED! ★": "★ ¡CON COBERTURA! ★",
  COVERED: "CON COBERTURA",
  "COVERED!": "¡CON COBERTURA!",
  "ID CARD ☐": "TARJETA ☐",
  "KEY ✓": "LLAVE ✓",
  "PLAN ☐": "PLAN ☐",
  "Do I qualify?": "¿Califico?",
  "Where do I start?": "¿Por dónde empiezo?",
  "Which form?": "¿Cuál formulario?",
  "How long?": "¿Cuánto tarda?",
  "Is this online?": "¿Esto es en línea?",
  "what am I filling out?": "¿qué estoy llenando?",
  "Navigator — I'll help!": "Navegador: ¡yo te ayudo!",
  "ROAAR!": "¡GRRR!",
  "THE BEAR IS CLOSE": "EL OSO ESTÁ CERCA",
  "Blue Cross / Blue Shield": "Blue Cross / Blue Shield",
  "PAUSE ON THE TRAIL": "PAUSA EN EL CAMINO",
  "APPLICATION PAUSED": "SOLICITUD EN PAUSA",
  "FINISHING…": "TERMINANDO…",

  // ---- Hints / notifications -----------------------------------------
  "You need a USERNAME and PASSWORD to log in.":
    "Necesitas un USUARIO y una CONTRASEÑA para entrar.",
  "Touch an application-method signpost to unlock this door.":
    "Toca un letrero de método de solicitud para abrir esta puerta.",
  "The door is locked.": "La puerta está cerrada.",
  "You got the key! Head to the door.": "¡Tienes la llave! Ve a la puerta.",
  "You got your Medical ID!": "¡Tienes tu Tarjeta Médica!",
  "Boss defeated! Grab the key.": "¡Oso derrotado! Toma la llave.",
  "The bear attacks! You're firing + now — dodge his paperwork.":
    "¡El oso ataca! Ahora disparas +: esquiva su papeleo.",
  "Resumed from your saved checkpoint.": "Continuaste desde tu punto guardado.",
  "Live chat open — you're shielded in this zone!":
    "Chat en vivo abierto: ¡estás protegido en esta zona!",
  "Emailed your case worker — umbrella up!":
    "Enviaste un correo a tu trabajador social: ¡paraguas arriba!",
  "Navigator joined you — they'll handle the boss!":
    "El Navegador se unió: ¡él se encarga del oso!",
  "You need to pick a health plan to continue.":
    "Debes elegir un plan de salud para continuar.",
  "Looks like some documents are still missing.": "Parece que aún faltan documentos.",
  "Application docs: complete ✓": "Documentos de la solicitud: completos ✓",
  "Your application is still under review.": "Tu solicitud sigue en revisión.",
  "Pick a way to apply before moving forward.":
    "Elige una forma de solicitar antes de avanzar.",
  "Set up your login and try again.": "Crea tu acceso e inténtalo de nuevo.",
  "A request for information went unanswered.":
    "Una solicitud de información quedó sin respuesta.",
  "A missing answer is slowing your journey.":
    "Una respuesta pendiente frena tu recorrido.",
  "You navigated every step and enrolled in Medicaid coverage.":
    "Recorriste cada paso y te inscribiste en la cobertura de Medicaid.",

  // ---- Secret bonus level --------------------------------------------
  "SECRET FOUND!": "¡SECRETO ENCONTRADO!",
  "PORTLAND BONUS": "BONUS DE PORTLAND",
  "BONUS STAGE": "NIVEL BONUS",
  "PORTLAND WATERFRONT": "MALECÓN DE PORTLAND",
  "Collect everything — no enemies here!": "¡Recoge todo: aquí no hay enemigos!",
  "Head right to rejoin the trail →": "Ve a la derecha para volver al camino →",
  "EXIT →": "SALIDA →",
  "BONUS COMPLETE!": "¡BONUS COMPLETO!",
  "Back to the trail…": "De vuelta al camino…",
  COFFEE: "CAFÉ",
  DONUT: "DONA",
  "FOOD CART": "CARRITO DE COMIDA",

  // ---- Boss briefing ---------------------------------------------------
  'Dodge the paperwork he throws — your "+" shots won\'t stop it.':
    'Esquiva el papeleo que lanza: tus disparos "+" no lo detienen.',
  "He fires when he jumps, so watch his height.":
    "Dispara cuando salta, así que vigila su altura.",
  "Land 5 hits to win.": "Acierta 5 golpes para ganar.",

  // ---- Failure / victory ---------------------------------------------
  "ACCOUNT NOT CREATED": "CUENTA NO CREADA",
  "MISSING PAPERWORK": "FALTA PAPELEO",
  "REQUEST UNANSWERED": "SOLICITUD SIN RESPUESTA",
  "PLAN NOT CHOSEN": "PLAN NO ELEGIDO",
  "ALMOST ENROLLED": "CASI INSCRITO",
  "(Don't slip crossing the river of paperwork.)":
    "(No resbales al cruzar el río de papeleo.)",
  "(You wandered off the trail — try again.)":
    "(Te saliste del camino: inténtalo de nuevo.)",
  "(A confusing form stood in your way.)":
    "(Un formulario confuso se cruzó en tu camino.)",
  "(Another day slipped by on the waiting list.)":
    "(Otro día se fue en la lista de espera.)",
  "Tell us what would make the next attempt easier — the form is below the game.":
    "Cuéntanos qué haría más fácil el próximo intento: el formulario está debajo del juego.",
  "Thanks for blazing the trail with me!\nEvery idea you share makes the next journey a little less bumpy.\n\nIf you enjoyed this game, vote for our poster session!\n\nHave a great time at MESC 2026!\nYour friends at Minnesota Department of Human Services!":
    "¡Gracias por abrir el camino conmigo!\nCada idea que compartes hace el próximo recorrido un poco más fácil.\n\nSi disfrutaste este juego, ¡vota por nuestra sesión de pósters!\n\n¡Que disfrutes MESC 2026!\nTus amigos del Departamento de Servicios Humanos de Minnesota.",
};

/** Counter/interpolated strings that can't be matched literally. */
const RULES: Array<[RegExp, string]> = [
  [/^SCORE (.+)$/, "PUNTOS $1"],
  [/^TIME (.+)$/, "TIEMPO $1"],
  [/^WAIT (.+)$/, "ESPERA $1"],
  [/^DOCS (.+)$/, "DOCS $1"],
  [/^BOSS (.+)$/, "OSO $1"],
  [/^REPLIES (.+)$/, "RESPUESTAS $1"],
  [/^METHOD (.+)$/, "MÉTODO $1"],
  [/^USER (.+?)\s\sPASS (.+)$/, "USUARIO $1  CLAVE $2"],
  [/^COFFEE \+(\d+)$/, "CAFÉ +$1"],
  [/^Boss hit! (\d+) to go\.$/, "¡Golpe al oso! Faltan $1."],
  [/^Step cleared in (.+)s — speed bonus \+(\d+)$/, "Paso superado en $1 s — bono de rapidez +$2"],
  [/^Collect 3 verification documents \((.+)\)\.$/, "Recoge 3 documentos de verificación ($1)."],
  [/^Answer every request for info \((.+)\)\.$/, "Responde cada solicitud de información ($1)."],
  [/^Application docs needed: (.+)$/, "Documentos necesarios: $1"],
  [/^(.+) chosen — door unlocked!$/, "$1 elegido: ¡puerta abierta!"],
  [/^Picked (.+) — get ready, something is coming through the trees\.\.\.$/,
    "Elegiste $1: prepárate, algo viene entre los árboles..."],
  [/^Zone (\d+)\/(\d+) · (.+)$/, "Zona $1/$2 · $3"],
  [/^\+(\d+)$/, "+$1"],
  [
    /^You picked (.+)\. Now walk right and go through the door\.$/,
    "Elegiste @1. Ahora camina a la derecha y cruza la puerta.",
  ],
  // Composed sentences: the leading fragment is itself a dictionary entry
  // (e.g. the device-specific jump prompt), so it is translated recursively.
  [/^(.+) to hit the brick and collect your application\.$/, "@1 para golpear el bloque y recoger tu solicitud."],
];

/** Translate one English string into the active language. */
export function t(input: string): string {
  if (current === "en") return input;
  if (!input) return input;
  const exact = ES[input];
  if (exact !== undefined) return exact;

  const ruled = ruleHit(input);
  if (ruled !== undefined) return ruled;

  // Bulleted / decorated lines: translate the payload, keep the marker.
  const decorated = input.match(/^([•\-–★▶\s]+)(.+)$/);
  if (decorated) {
    const inner = t(decorated[2]);
    if (inner !== decorated[2]) return decorated[1] + inner;
  }

  if (input.includes("\n")) {
    const lines = input.split("\n");
    let changed = false;
    const mapped = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      const hit = t(trimmed);
      if (hit === trimmed) return line;
      changed = true;
      return line.replace(trimmed, hit);
    });
    if (changed) return mapped.join("\n");
  }
  return input;
}

function ruleHit(s: string): string | undefined {
  for (const [re, out] of RULES) {
    const m = s.match(re);
    if (!m) continue;
    // "@n" placeholders recurse through the dictionary; "$n" are literal.
    return out.replace(/[@$](\d)/g, (_all, d: string) => {
      const captured = m[Number(d)] ?? "";
      return _all.startsWith("@") ? t(captured) : captured;
    });
  }
  return undefined;
}

/** Convenience for React components: pick between two literals. */
export function pick(en: string, es: string): string {
  return current === "es" ? es : en;
}

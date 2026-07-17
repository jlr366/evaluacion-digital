/**
 * Cloud Functions — puente de autenticación para examen-aws.
 *
 * Reemplaza el login/alta/edición/borrado de `admins` y `usuarios` que antes
 * se hacía directo desde el navegador contra Firestore (con contraseñas en
 * texto plano y lectura/escritura pública). A partir de aquí:
 *   - Las contraseñas se guardan hasheadas (bcrypt) en `passwordHash`.
 *   - El login nunca devuelve la contraseña/hash al cliente.
 *   - Tras un login exitoso se emite un Custom Token de Firebase Auth; el
 *     cliente hace signInWithCustomToken() y así `request.auth` queda
 *     disponible para las reglas de Firestore (`admins`/`usuarios` ahora
 *     exigen `request.auth != null` para leer, y `write: if false` — todas
 *     las escrituras pasan por estas funciones).
 *   - examenes/notas/sesiones_activas/cursos/examenes_externos NO cambian:
 *     siguen abiertas (examen libre y vista previa dependen de eso).
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const bcrypt = require('bcryptjs');

admin.initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const db = () => admin.firestore();
const HASH_ROUNDS = 10;

// ── Helpers ──────────────────────────────────────────────────────────────

function requireAuth(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.');
  return request.auth;
}

function requireSuperAdmin(request) {
  const auth = requireAuth(request);
  if (auth.token.role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Solo un superadmin puede hacer esto.');
  }
  return auth;
}

function requireAdmin(request) {
  const auth = requireAuth(request);
  if (auth.token.tipo !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un profesor/admin puede hacer esto.');
  }
  return auth;
}

// Verifica que el estudiante {id} pertenezca al admin autenticado (o que sea superadmin).
async function assertOwnsStudent(auth, studentId) {
  if (auth.token.role === 'superadmin') return;
  const doc = await db().collection('usuarios').doc(studentId).get();
  if (!doc.exists) throw new HttpsError('not-found', 'Estudiante no encontrado.');
  if (doc.data().createdBy !== auth.uid) {
    throw new HttpsError('permission-denied', 'Ese estudiante no te pertenece.');
  }
}

function stripSecrets(data) {
  const { password, passwordHash, ...safe } = data || {};
  return safe;
}

function slugifyUsername(nombre) {
  const base = (nombre || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  return base || 'usuario';
}

// ── LOGIN ────────────────────────────────────────────────────────────────

exports.login = onCall(async (request) => {
  const { username, password, profId } = request.data || {};
  if (!username || !password) {
    throw new HttpsError('invalid-argument', 'Ingrese usuario y contraseña.');
  }
  const inputLower = String(username).trim().toLowerCase();

  // ── admins (por username o email) ──
  let snap = await db().collection('admins').where('username', '==', inputLower).get();
  if (snap.empty) snap = await db().collection('admins').where('email', '==', inputLower).get();

  if (!snap.empty) {
    const match = snap.docs.find(d => d.data().passwordHash && bcrypt.compareSync(password, d.data().passwordHash));
    if (!match) return { success: false, error: 'Usuario encontrado pero contraseña incorrecta' };
    const safe = stripSecrets(match.data());
    const token = await admin.auth().createCustomToken(match.id, { tipo: 'admin', role: safe.role || null });
    return { success: true, token, user: { id: match.id, ...safe, tipo: 'admin' } };
  }

  // ── usuarios (estudiantes) ──
  let usuariosQuery = db().collection('usuarios').where('username', '==', inputLower);
  if (profId) usuariosQuery = usuariosQuery.where('createdBy', '==', profId);
  snap = await usuariosQuery.get();
  const match = snap.docs.find(d => d.data().passwordHash && bcrypt.compareSync(password, d.data().passwordHash));
  if (match) {
    const safe = stripSecrets(match.data());
    const token = await admin.auth().createCustomToken(match.id, { tipo: 'estudiante' });
    return { success: true, token, user: { id: match.id, ...safe, tipo: 'estudiante' } };
  }

  return { success: false, error: 'Usuario o contraseña incorrectos' };
});

// ── REGISTRO DEMO (profesores, self-service) ────────────────────────────

exports.registrarProfesorDemo = onCall(async (request) => {
  const { nombre, email, password } = request.data || {};
  if (!nombre || !email || !password) throw new HttpsError('invalid-argument', 'Completa todos los campos.');
  if (String(password).length < 6) throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');

  const username = slugifyUsername(nombre);
  const emailLower = String(email).trim().toLowerCase();

  const checkUser = await db().collection('admins').where('username', '==', username).get();
  if (!checkUser.empty) {
    return { success: false, error: `El nombre "${username}" ya está en uso. Usa un nombre diferente o agrega tu apellido.` };
  }
  const checkEmail = await db().collection('admins').where('email', '==', emailLower).get();
  if (!checkEmail.empty) {
    return { success: false, error: 'Este email ya está registrado' };
  }

  const passwordHash = bcrypt.hashSync(password, HASH_ROUNDS);
  const demoExpiry = new Date(new Date().setHours(24, 0, 0, 0)).toISOString();
  const ref = await db().collection('admins').add({
    username,
    passwordHash,
    nombre: String(nombre).trim(),
    email: emailLower,
    role: 'demo',
    institucion: '',
    demoExpiry,
    createdAt: FieldValue.serverTimestamp()
  });

  const doc = await ref.get();
  const safe = stripSecrets(doc.data());
  const token = await admin.auth().createCustomToken(ref.id, { tipo: 'admin', role: 'demo' });
  return { success: true, token, user: { id: ref.id, ...safe, tipo: 'admin' } };
});

// ── PROFESORES (gestión, superadmin) ────────────────────────────────────

exports.crearProfesor = onCall(async (request) => {
  requireSuperAdmin(request);
  const { username, password, nombre, role, institucion } = request.data || {};
  if (!username || !password || !nombre) throw new HttpsError('invalid-argument', 'Complete todos los campos.');
  if (role === 'superadmin') throw new HttpsError('invalid-argument', 'No se puede crear una cuenta superadmin desde aquí.');

  const usernameLower = String(username).trim().toLowerCase();
  const existing = await db().collection('admins').where('username', '==', usernameLower).get();
  if (!existing.empty) return { success: false, error: 'El admin ya existe' };

  const passwordHash = bcrypt.hashSync(password, HASH_ROUNDS);
  const ref = await db().collection('admins').add({
    username: usernameLower,
    passwordHash,
    nombre: String(nombre).trim(),
    role: role || 'admin',
    institucion: institucion || '',
    createdAt: FieldValue.serverTimestamp()
  });
  return { success: true, id: ref.id };
});

exports.actualizarProfesor = onCall(async (request) => {
  const auth = requireAuth(request);
  const { id, nombre, username, email, institucion, password } = request.data || {};
  if (!id) throw new HttpsError('invalid-argument', 'Falta el id del profesor.');
  const isSuper = auth.token.role === 'superadmin';
  const isSelf = auth.uid === id;
  if (!isSuper && !isSelf) throw new HttpsError('permission-denied', 'No autorizado.');

  const updates = {};
  if (nombre !== undefined) {
    if (!String(nombre).trim()) throw new HttpsError('invalid-argument', 'El nombre no puede estar vacío.');
    updates.nombre = String(nombre).trim();
  }
  if (username !== undefined) {
    const usernameLower = String(username).trim().toLowerCase();
    if (!usernameLower) throw new HttpsError('invalid-argument', 'El username no puede estar vacío.');
    const existing = await db().collection('admins').where('username', '==', usernameLower).get();
    if (!existing.empty && existing.docs.some(d => d.id !== id)) {
      throw new HttpsError('already-exists', 'Ya existe otro profesor con ese username.');
    }
    updates.username = usernameLower;
  }
  if (email !== undefined) updates.email = String(email).trim().toLowerCase();
  if (institucion !== undefined) updates.institucion = institucion;
  if (password) {
    if (String(password).trim().length < 4) throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 4 caracteres.');
    updates.passwordHash = bcrypt.hashSync(String(password).trim(), HASH_ROUNDS);
  }
  // 'role' deliberadamente NUNCA se acepta aquí — los cambios de rol solo
  // pasan por activarDemoProfesor (superadmin-only, alcance mínimo).

  if (Object.keys(updates).length === 0) return { success: true };

  await db().collection('admins').doc(id).update(updates);
  return { success: true };
});

exports.activarDemoProfesor = onCall(async (request) => {
  requireSuperAdmin(request);
  const { id } = request.data || {};
  if (!id) throw new HttpsError('invalid-argument', 'Falta el id.');
  await db().collection('admins').doc(id).update({ role: 'admin' });
  return { success: true };
});

exports.eliminarProfesor = onCall(async (request) => {
  requireSuperAdmin(request);
  const { id } = request.data || {};
  if (!id) throw new HttpsError('invalid-argument', 'Falta el id.');

  const usSnap = await db().collection('usuarios').where('createdBy', '==', id).get();
  const batch = db().batch();
  usSnap.docs.forEach(doc => batch.delete(doc.ref));
  batch.delete(db().collection('admins').doc(id));
  await batch.commit();
  return { success: true };
});

// ── ESTUDIANTES (gestión, admin/superadmin) ─────────────────────────────

exports.crearEstudiante = onCall(async (request) => {
  const auth = requireAdmin(request);
  const { username, password, nombre, email, curso } = request.data || {};
  if (!username || !password || !nombre) throw new HttpsError('invalid-argument', 'Complete username, nombre y contraseña.');

  if (auth.token.role === 'demo') {
    const misUsers = await db().collection('usuarios').where('createdBy', '==', auth.uid).get();
    if (misUsers.size >= 2) {
      throw new HttpsError('resource-exhausted', 'Cuenta demo: máximo 2 estudiantes. Actualiza tu plan para agregar más.');
    }
  }

  const usernameLower = String(username).trim().toLowerCase();
  const existing = await db().collection('usuarios')
    .where('username', '==', usernameLower)
    .where('createdBy', '==', auth.uid)
    .get();
  if (!existing.empty) return { success: false, error: 'Ya existe un estudiante con ese username' };

  const passwordHash = bcrypt.hashSync(password, HASH_ROUNDS);
  const ref = await db().collection('usuarios').add({
    username: usernameLower,
    passwordHash,
    nombre: String(nombre).trim(),
    email: email || '',
    curso: curso || 'Sin curso',
    createdBy: auth.uid,
    createdAt: FieldValue.serverTimestamp()
  });
  return { success: true, id: ref.id };
});

exports.actualizarEstudiante = onCall(async (request) => {
  const auth = requireAdmin(request);
  const { id, nombre, email, curso } = request.data || {};
  if (!id) throw new HttpsError('invalid-argument', 'Falta el id.');
  await assertOwnsStudent(auth, id);

  const updates = {};
  if (nombre !== undefined) {
    const trimmed = String(nombre).trim();
    if (!trimmed) throw new HttpsError('invalid-argument', 'El nombre no puede estar vacío.');
    updates.nombre = trimmed;
    // Mantiene consistencia con el historial de notas, igual que antes.
    const notasSnap = await db().collection('notas').where('userId', '==', id).get();
    const batch = db().batch();
    notasSnap.docs.forEach(doc => batch.update(doc.ref, { nombre: trimmed }));
    if (!notasSnap.empty) await batch.commit();
  }
  if (email !== undefined) updates.email = String(email).trim().toLowerCase();
  if (curso !== undefined) updates.curso = curso || 'Sin curso';

  if (Object.keys(updates).length === 0) return { success: true };
  await db().collection('usuarios').doc(id).update(updates);
  return { success: true };
});

exports.cambiarPasswordEstudiante = onCall(async (request) => {
  const auth = requireAdmin(request);
  const { id, newPassword } = request.data || {};
  if (!id || !newPassword) throw new HttpsError('invalid-argument', 'Faltan datos.');
  if (String(newPassword).length < 4) throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 4 caracteres.');
  await assertOwnsStudent(auth, id);
  const passwordHash = bcrypt.hashSync(newPassword, HASH_ROUNDS);
  await db().collection('usuarios').doc(id).update({ passwordHash });
  return { success: true };
});

exports.eliminarEstudiante = onCall(async (request) => {
  const auth = requireAdmin(request);
  const { id } = request.data || {};
  if (!id) throw new HttpsError('invalid-argument', 'Falta el id.');
  await assertOwnsStudent(auth, id);
  await db().collection('usuarios').doc(id).delete();
  return { success: true };
});

// Autolimpieza de cuentas demo (reemplaza el borrado directo de `usuarios`
// que hacía limpiarDemo() en admin.html a medianoche).
exports.limpiarEstudiantesDemo = onCall(async (request) => {
  const auth = requireAuth(request);
  if (auth.token.role !== 'demo') throw new HttpsError('permission-denied', 'Solo aplica a cuentas demo.');
  const snap = await db().collection('usuarios').where('createdBy', '==', auth.uid).get();
  const batch = db().batch();
  snap.docs.forEach(doc => batch.delete(doc.ref));
  if (!snap.empty) await batch.commit();
  return { success: true, borrados: snap.size };
});

// NOTA: la función de migración única (migrarPasswords) ya cumplió su
// propósito el 2026-07-17 — todas las contraseñas de `admins` y `usuarios`
// quedaron migradas a `passwordHash` (bcrypt). Se desinstaló de producción
// y se retiró de aquí a propósito para que no quede un endpoint reutilizable.

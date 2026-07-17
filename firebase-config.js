/**
 * Firebase Configuration & Database Logic
 * Platform: Exam Management System
 * Collections: admins, usuarios, examenes, notas
 *
 * AUTH: el login/alta/edición/borrado de `admins` y `usuarios` pasa por
 * Cloud Functions (ver /functions/index.js) — nunca se leen ni escriben
 * contraseñas directo desde el navegador. Tras un login exitoso se hace
 * signInWithCustomToken() para que `request.auth` quede disponible y las
 * reglas de Firestore permitan las lecturas de listado (getAllAdmins,
 * getUsers) que siguen siendo consultas directas a Firestore.
 */

const firebaseConfig = {
  apiKey: "AIzaSyDPOV6CyQaVHY6ENAVue8OpRtZzoJx7JCw",
  authDomain: "examen-aws.firebaseapp.com",
  projectId: "examen-aws",
  storageBucket: "examen-aws.firebasestorage.app",
  messagingSenderId: "949979279764",
  appId: "1:949979279764:web:87a7f04d38348ea2b5df81"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const functions = firebase.functions();

const useEmulator = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
if (useEmulator) {
  console.log('[Firebase] Local emulator mode: Firestore + Storage + Auth + Functions');
  db.useEmulator('localhost', 8080);
  auth.useEmulator('http://localhost:9099');
  functions.useEmulator('localhost', 5001);
  if (firebase.storage && typeof firebase.storage === 'function') {
    firebase.storage().useEmulator('localhost', 9199);
  }
}

// Espera a que Firebase Auth restaure la sesión (custom token) tras una
// navegación de página completa (login.html -> admin.html, etc). Sin esto,
// una lectura de `admins`/`usuarios` que dispare justo al cargar la página
// puede llegar antes de que `request.auth` esté listo y fallar con
// permission-denied de forma intermitente.
async function waitForAuthReady() {
  if (typeof auth.authStateReady === 'function') {
    await auth.authStateReady();
  } else {
    await new Promise(resolve => {
      const unsub = auth.onAuthStateChanged(() => { unsub(); resolve(); }, () => resolve());
    });
  }
}

function callFn(name, data) {
  return functions.httpsCallable(name)(data || {});
}

// ── Input sanitization ────────────────────────────────────────────────────────
function sanitize(str, maxLen = 200) {
  if (typeof str !== 'string') return '';
  return str.trim().substring(0, maxLen)
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── AUTH ──────────────────────────────────────────────────────────────────────

async function loginGeneral(username, password, profId) {
  try {
    const res = await callFn('login', { username, password, profId });
    const result = res.data;
    if (result.success) {
      await auth.signInWithCustomToken(result.token);
    }
    return result;
  } catch (e) {
    console.error('loginGeneral error:', e);
    return { success: false, error: e.message || 'Error de conexión' };
  }
}

async function registrarProfesorDemo(nombre, email, password) {
  try {
    const res = await callFn('registrarProfesorDemo', { nombre, email, password });
    const result = res.data;
    if (result.success) {
      await auth.signInWithCustomToken(result.token);
    }
    return result;
  } catch (e) {
    console.error('registrarProfesorDemo error:', e);
    return { success: false, error: e.message || 'Error de conexión' };
  }
}

// ── ADMINS ────────────────────────────────────────────────────────────────────

async function createAdmin(username, password, nombre, role, institucion) {
  try {
    const res = await callFn('crearProfesor', { username, password, nombre, role, institucion });
    return res.data;
  } catch (e) {
    return { success: false, error: e.message || 'Error de conexión' };
  }
}

async function updateAdmin(id, cambios) {
  try {
    const res = await callFn('actualizarProfesor', { id, ...cambios });
    return res.data;
  } catch (e) {
    return { success: false, error: e.message || 'Error de conexión' };
  }
}

async function activarDemoProfesor(id) {
  try {
    const res = await callFn('activarDemoProfesor', { id });
    return res.data;
  } catch (e) {
    return { success: false, error: e.message || 'Error de conexión' };
  }
}

async function getAllAdmins() {
  try {
    await waitForAuthReady();
    const snap = await db.collection('admins').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''));
  } catch (error) {
    console.error('getAllAdmins error:', error);
    return [];
  }
}

async function deleteAdmin(id) {
  try {
    const res = await callFn('eliminarProfesor', { id });
    return res.data;
  } catch (e) {
    return { success: false, error: e.message || 'Error de conexión' };
  }
}

// ── USUARIOS (students) ───────────────────────────────────────────────────────

async function createUser(username, password, nombre, email, curso) {
  try {
    const res = await callFn('crearEstudiante', { username, password, nombre, email, curso });
    return res.data;
  } catch (e) {
    return { success: false, error: e.message || 'Error de conexión' };
  }
}

async function updateEstudiante(id, cambios) {
  try {
    const res = await callFn('actualizarEstudiante', { id, ...cambios });
    return res.data;
  } catch (e) {
    return { success: false, error: e.message || 'Error de conexión' };
  }
}

async function getUsers(filterByAdmin) {
  try {
    await waitForAuthReady();
    let snap;
    if (filterByAdmin) {
      snap = await db.collection('usuarios').where('createdBy', '==', filterByAdmin).get();
    } else {
      snap = await db.collection('usuarios').get();
    }
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''));
  } catch (error) {
    console.error('getUsers error:', error);
    return [];
  }
}

async function deleteUser(id) {
  try {
    const res = await callFn('eliminarEstudiante', { id });
    return res.data;
  } catch (e) {
    return { success: false, error: e.message || 'Error de conexión' };
  }
}

async function updateUserPassword(id, newPass) {
  try {
    const res = await callFn('cambiarPasswordEstudiante', { id, newPassword: newPass });
    return res.data;
  } catch (e) {
    return { success: false, error: e.message || 'Error de conexión' };
  }
}

async function limpiarEstudiantesDemo() {
  try {
    const res = await callFn('limpiarEstudiantesDemo', {});
    return res.data;
  } catch (e) {
    console.error('limpiarEstudiantesDemo error:', e);
    return { success: false, error: e.message || 'Error de conexión' };
  }
}

// ── EXAMENES ──────────────────────────────────────────────────────────────────

async function createExamen(data) {
  const ref = await db.collection('examenes').add({
    titulo: data.titulo,
    subtitulo: data.subtitulo || '',
    tiempoMinutos: data.tiempoMinutos || 40,
    notaMinima: data.notaMinima || 70,
    notaMaxima: data.notaMaxima || 100,
    reconexionMinutos: data.reconexionMinutos !== undefined ? data.reconexionMinutos : 60,
    puntuacion: data.puntuacion || 'igual',
    intentosPermitidos: data.intentosPermitidos !== undefined ? data.intentosPermitidos : 0,
    fechaApertura: data.fechaApertura || '',
    fechaCierre: data.fechaCierre || '',
    preguntas: data.preguntas || [],
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || '',
    institucion: data.institucion || '',
    imgAprobado: data.imgAprobado || '',
    imgReprobado: data.imgReprobado || '',
    audioExamen: data.audioExamen || '',
    audioAprobado: data.audioAprobado || '',
    audioReprobado: data.audioReprobado || '',
    permitirDescarga: data.permitirDescarga !== false,
    accesoLibre: data.accesoLibre || false,
    activo: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return { success: true, id: ref.id };
}

async function getExamenes(filterByAdmin) {
  try {
    let snap;
    if (filterByAdmin) {
      snap = await db.collection('examenes').where('createdBy', '==', filterByAdmin).get();
    } else {
      snap = await db.collection('examenes').get();
    }
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('getExamenes error:', error);
    return [];
  }
}

async function getExamen(id) {
  try {
    const doc = await db.collection('examenes').doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('getExamen error:', error);
    return null;
  }
}

async function updateExamen(id, data) {
  await db.collection('examenes').doc(id).update(data);
  return { success: true };
}

async function deleteExamen(id) {
  await db.collection('examenes').doc(id).delete();
  return { success: true };
}

// ── NOTAS ─────────────────────────────────────────────────────────────────────

async function saveGrade(data) {
  await db.collection('notas').add({
    examenId: data.examenId,
    examenTitulo: data.examenTitulo || '',
    userId: data.userId,
    username: data.username,
    nombre: data.nombre,
    nota: data.nota,
    totalPreguntas: data.totalPreguntas,
    correctas: data.correctas,
    aprobado: data.aprobado,
    createdBy: data.createdBy || '',
    fecha: firebase.firestore.FieldValue.serverTimestamp(),
    fechaLocal: new Date().toLocaleString('es-ES')
  });
  return { success: true };
}

async function getGrades(filterByAdmin) {
  try {
    const snap = await db.collection('notas').get();
    let notas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (filterByAdmin) notas = notas.filter(n => n.createdBy === filterByAdmin);
    return notas.sort((a,b) => (b.fecha?.seconds||0) - (a.fecha?.seconds||0));
  } catch (error) {
    console.error('getGrades error:', error);
    return [];
  }
}

async function getGradesByExamen(examenId) {
  try {
    const snap = await db.collection('notas').where('examenId', '==', examenId).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('getGradesByExamen error:', error);
    return [];
  }
}

// ── SESIONES ACTIVAS (anti-trampa: un solo login por usuario por examen) ──

async function registrarSesion(userId, examenId, reconexionMinutos) {
  try {
    const ahora = Date.now();
    // Use exam's reconnect window (in minutes), default 5 min, 0 = no reconnect allowed
    const ventanaMs = (reconexionMinutos !== undefined ? reconexionMinutos : 60) * 60 * 1000;

    const snap = await db.collection('sesiones_activas')
      .where('userId', '==', userId)
      .where('examenId', '==', examenId)
      .get();

    if (!snap.empty) {
      const sesion = snap.docs[0].data();
      const edad = ahora - (sesion.timestamp || 0);

      if (ventanaMs === 0) {
        // No reconnect allowed at all
        return { success: false, error: 'Este usuario ya tiene una sesión activa. El profesor no permite reconexión en este examen.' };
      }

      // 9999 = indefinido (siempre puede reconectarse)
      if (reconexionMinutos >= 9999 || edad < ventanaMs) {
        await snap.docs[0].ref.update({ timestamp: ahora });
        return { success: true, sesionId: snap.docs[0].id };
      } else {
        await snap.docs[0].ref.delete();
      }
    }

    // Register new session
    const ref = await db.collection('sesiones_activas').add({
      userId,
      examenId,
      timestamp: ahora
    });
    return { success: true, sesionId: ref.id };
  } catch(e) {
    console.error('registrarSesion error:', e);
    return { success: true, sesionId: null }; // fail open
  }
}

async function liberarSesion(userId, examenId) {
  try {
    const snap = await db.collection('sesiones_activas')
      .where('userId', '==', userId)
      .where('examenId', '==', examenId)
      .get();
    for (const doc of snap.docs) await doc.ref.delete();
  } catch(e) {
    console.error('liberarSesion error:', e);
  }
}

async function getGradesByUser(userId) {
  try {
    const snap = await db.collection('notas').where('userId', '==', userId).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('getGradesByUser error:', error);
    return [];
  }
}

async function getGradesByUserAndExamen(userId, examenId) {
  try {
    const snap = await db.collection('notas')
      .where('userId', '==', userId)
      .where('examenId', '==', examenId)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('getGradesByUserAndExamen error:', error);
    return [];
  }
}

/**
 * Firebase Configuration & Database Logic
 * Platform: Exam Management System
 * Collections: admins, usuarios, examenes, notas
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

// ── Input sanitization ────────────────────────────────────────────────────────
function sanitize(str, maxLen = 200) {
  if (typeof str !== 'string') return '';
  return str.trim().substring(0, maxLen)
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── AUTH ──────────────────────────────────────────────────────────────────────

async function loginGeneral(username, password, profId) {
  // Check admins first
  let snap = await db.collection('admins')
    .where('username', '==', username.trim().toLowerCase())
    .where('password', '==', password)
    .get();

  if (!snap.empty) {
    const doc = snap.docs[0];
    return { success: true, user: { id: doc.id, ...doc.data(), tipo: 'admin' } };
  }

  // Check students - if profId provided, only search within that professor's students
  if (profId) {
    snap = await db.collection('usuarios')
      .where('username', '==', username.trim().toLowerCase())
      .where('password', '==', password)
      .where('createdBy', '==', profId)
      .get();
  } else {
    snap = await db.collection('usuarios')
      .where('username', '==', username.trim().toLowerCase())
      .where('password', '==', password)
      .get();
  }

  if (!snap.empty) {
    const doc = snap.docs[0];
    return { success: true, user: { id: doc.id, ...doc.data(), tipo: 'estudiante' } };
  }

  return { success: false, error: 'Usuario o contraseña incorrectos' };
}

// ── ADMINS ────────────────────────────────────────────────────────────────────

async function createAdmin(username, password, nombre, role, institucion) {
  const existing = await db.collection('admins')
    .where('username', '==', username.trim().toLowerCase())
    .get();
  if (!existing.empty) return { success: false, error: 'El admin ya existe' };

  const ref = await db.collection('admins').add({
    username: username.trim().toLowerCase(),
    password: password,
    nombre: nombre.trim(),
    role: role, // 'superadmin' or 'admin'
    institucion: institucion || '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return { success: true, id: ref.id };
}

async function getAllAdmins() {
  try {
    const snap = await db.collection('admins').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''));
  } catch (error) {
    console.error('getAllAdmins error:', error);
    return [];
  }
}

async function deleteAdmin(id) {
  await db.collection('admins').doc(id).delete();
  return { success: true };
}

// ── USUARIOS (students) ───────────────────────────────────────────────────────

async function createUser(username, password, nombre, createdBy) {
  const existing = await db.collection('usuarios')
    .where('username', '==', username.trim().toLowerCase())
    .get();
  if (!existing.empty) return { success: false, error: 'El usuario ya existe' };

  const ref = await db.collection('usuarios').add({
    username: username.trim().toLowerCase(),
    password: password,
    nombre: nombre.trim(),
    createdBy: createdBy || '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return { success: true, id: ref.id };
}

async function getUsers(filterByAdmin) {
  try {
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
  await db.collection('usuarios').doc(id).delete();
  return { success: true };
}

async function updateUserPassword(id, newPass) {
  await db.collection('usuarios').doc(id).update({ password: newPass });
  return { success: true };
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

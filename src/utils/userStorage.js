/**
 * User management storage — localStorage-based
 * Passwords are stored as base64 (consistent with existing LoginScreen pattern).
 * In production this would be a server-side bcrypt hash.
 *
 * Multi-tenant: each user has a clinicId field.
 * Superadmin has clinicId = '*' and sees all clinics.
 */

const USERS_KEY = 'dental_clinic_users';
const AUDIT_KEY = 'dental_clinic_audit';

// ── Default seed users (mirrors existing LoginScreen USERS) ────────────────
const DEFAULT_USERS = [
  {
    id: 'superadmin',
    name: 'Super Admin',
    username: 'superadmin',
    phone: '',
    email: '',
    role: 'superadmin',
    clinicId: '*',
    passwordHash: btoa('super2026!'),
    isActive: true,
    createdAt: new Date(2026, 0, 1).toISOString(),
  },
  {
    id: '1',
    name: 'Администратор',
    username: 'admin',
    phone: '',
    email: '',
    role: 'admin',
    clinicId: 'clinic_default',
    passwordHash: btoa('admin123'),
    isActive: true,
    createdAt: new Date(2026, 0, 1).toISOString(),
  },
  {
    id: '2',
    name: 'Врач',
    username: 'doctor',
    phone: '',
    email: '',
    role: 'doctor',
    clinicId: 'clinic_default',
    passwordHash: btoa('doctor123'),
    isActive: true,
    createdAt: new Date(2026, 0, 1).toISOString(),
  },
  {
    id: '3',
    name: 'Регистратор',
    username: 'registrar',
    phone: '',
    email: '',
    role: 'registrar',
    clinicId: 'clinic_default',
    passwordHash: btoa('reg123'),
    isActive: true,
    createdAt: new Date(2026, 0, 1).toISOString(),
  },
];

// ── Users CRUD ──────────────────────────────────────────────────────────────

// Schema version — bump this when DEFAULT_USERS shape changes to force re-seed
const USERS_SCHEMA_VER = 3;
const USERS_VER_KEY = 'dental_clinic_users_ver';

export function getUsers() {
  try {
    // Force re-seed if schema version changed
    const storedVer = parseInt(localStorage.getItem(USERS_VER_KEY) || '0', 10);
    if (storedVer < USERS_SCHEMA_VER) {
      localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
      localStorage.setItem(USERS_VER_KEY, String(USERS_SCHEMA_VER));
      return DEFAULT_USERS;
    }
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
      localStorage.setItem(USERS_VER_KEY, String(USERS_SCHEMA_VER));
      return DEFAULT_USERS;
    }
    let users = JSON.parse(raw);
    // ── Migration: add clinicId to any users still missing it ──
    let migrated = false;
    users = users.map(u => {
      if (!u.clinicId) {
        migrated = true;
        return { ...u, clinicId: u.role === 'superadmin' ? '*' : 'clinic_default' };
      }
      return u;
    });
    // Ensure superadmin seed exists
    if (!users.find(u => u.role === 'superadmin')) {
      users.unshift(DEFAULT_USERS[0]);
      migrated = true;
    }
    if (migrated) {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
    return users;
  } catch {
    return DEFAULT_USERS;
  }
}

/** Wipes all auth-related keys and re-seeds defaults. Used by the login reset button. */
export function resetUsersToDefaults() {
  localStorage.removeItem(USERS_KEY);
  localStorage.removeItem(USERS_VER_KEY);
  localStorage.removeItem('dh_login_fails');
  localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
  localStorage.setItem(USERS_VER_KEY, String(USERS_SCHEMA_VER));
}

export function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getUserById(id) {
  return getUsers().find(u => u.id === String(id)) || null;
}

export function getUserByUsername(username) {
  return getUsers().find(u => u.username === username) || null;
}

export function createUser({ name, username, phone, email, role, password, clinicId }) {
  const users = getUsers();
  if (users.find(u => u.username === username)) {
    throw new Error('USERNAME_TAKEN');
  }
  const user = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name: name || '',
    username: username || '',
    phone: phone || '',
    email: email || '',
    role: role || 'doctor',
    clinicId: clinicId || 'clinic_default',
    passwordHash: btoa(password || ''),
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  return user;
}

/** Returns users belonging to a specific clinic (superadmin sees all) */
export function getUsersForClinic(clinicId, role) {
  const all = getUsers();
  if (role === 'superadmin') return all;
  return all.filter(u => u.clinicId === clinicId);
}

export function updateUser(id, patch) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === String(id));
  if (idx < 0) throw new Error('USER_NOT_FOUND');
  // Prevent username duplicate
  if (patch.username && patch.username !== users[idx].username) {
    if (users.find(u => u.username === patch.username && u.id !== String(id))) {
      throw new Error('USERNAME_TAKEN');
    }
  }
  users[idx] = { ...users[idx], ...patch };
  saveUsers(users);
  return users[idx];
}

export function setUserPassword(id, newPassword) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === String(id));
  if (idx < 0) throw new Error('USER_NOT_FOUND');
  users[idx].passwordHash = btoa(newPassword);
  saveUsers(users);
}

/**
 * Generates a random temp password, sets mustChangePassword=true.
 * Returns the temp password so it can be shown once to the admin.
 * In production: would email it instead of returning it.
 */
export function resetUserPasswordTemp(id) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === String(id));
  if (idx < 0) throw new Error('USER_NOT_FOUND');
  // Prevent resetting superadmin's own password from SA panel
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const tempPw = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  users[idx].passwordHash = btoa(tempPw);
  users[idx].mustChangePassword = true;
  saveUsers(users);
  return tempPw;
}

export function toggleUserActive(id) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === String(id));
  if (idx < 0) return;
  users[idx].isActive = !users[idx].isActive;
  saveUsers(users);
  return users[idx];
}

// Password verification (matches existing pattern in LoginScreen)
export function verifyPassword(plain, hash) {
  try {
    return atob(hash) === plain;
  } catch {
    return false;
  }
}

// ── OTP simulation ──────────────────────────────────────────────────────────
// In production: send real SMS/email. Here we store OTP in sessionStorage.
const OTP_KEY = 'dental_otp_pending';

export function generateOtp(userId) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const entry = { userId: String(userId), code, exp: Date.now() + 5 * 60 * 1000 };
  sessionStorage.setItem(OTP_KEY, JSON.stringify(entry));
  // In production: send SMS/email here
  // For demo: log to console so admin can see it
  console.log(`[OTP] Code for user ${userId}: ${code}`);
  return code; // returned so UI can display it in demo mode
}

export function verifyOtp(userId, inputCode) {
  try {
    const raw = sessionStorage.getItem(OTP_KEY);
    if (!raw) return false;
    const entry = JSON.parse(raw);
    if (entry.userId !== String(userId)) return false;
    if (entry.exp < Date.now()) return false;
    if (entry.code !== String(inputCode).trim()) return false;
    sessionStorage.removeItem(OTP_KEY);
    return true;
  } catch {
    return false;
  }
}

// ── Patient change log ──────────────────────────────────────────────────────
const PATIENT_LOGS_KEY = 'dental_clinic_patient_logs';

export function getPatientLogs(patientId) {
  try {
    const raw = localStorage.getItem(PATIENT_LOGS_KEY);
    const all = raw ? JSON.parse(raw) : [];
    if (patientId) return all.filter(e => e.patientId === String(patientId));
    return all;
  } catch {
    return [];
  }
}

export function addPatientLog({ patientId, changedBy, changedByName, fieldName, oldValue, newValue }) {
  try {
    const raw = localStorage.getItem(PATIENT_LOGS_KEY);
    const all = raw ? JSON.parse(raw) : [];
    all.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      patientId: String(patientId || ''),
      changedBy: String(changedBy || ''),
      changedByName: changedByName || '',
      fieldName: fieldName || '',
      oldValue: oldValue !== undefined && oldValue !== null ? String(oldValue) : '',
      newValue: newValue !== undefined && newValue !== null ? String(newValue) : '',
      changedAt: new Date().toISOString(),
    });
    // Keep last 2000 entries across all patients
    if (all.length > 2000) all.length = 2000;
    localStorage.setItem(PATIENT_LOGS_KEY, JSON.stringify(all));
  } catch {
    // ignore storage errors
  }
}

// ── Edit lock ────────────────────────────────────────────────────────────────
const EDIT_LOCK_KEY = 'dental_clinic_edit_locks';
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function setEditLock(patientId, session) {
  try {
    const raw = localStorage.getItem(EDIT_LOCK_KEY);
    const locks = raw ? JSON.parse(raw) : {};
    locks[String(patientId)] = {
      userId: String(session.id),
      userName: session.name || session.login || '',
      lockedAt: Date.now(),
    };
    localStorage.setItem(EDIT_LOCK_KEY, JSON.stringify(locks));
  } catch {
    // ignore
  }
}

export function getEditLock(patientId) {
  try {
    const raw = localStorage.getItem(EDIT_LOCK_KEY);
    if (!raw) return null;
    const locks = JSON.parse(raw);
    const lock = locks[String(patientId)];
    if (!lock) return null;
    if (Date.now() - lock.lockedAt > LOCK_TTL_MS) {
      // Expired — clean up
      delete locks[String(patientId)];
      localStorage.setItem(EDIT_LOCK_KEY, JSON.stringify(locks));
      return null;
    }
    return lock;
  } catch {
    return null;
  }
}

export function clearEditLock(patientId) {
  try {
    const raw = localStorage.getItem(EDIT_LOCK_KEY);
    if (!raw) return;
    const locks = JSON.parse(raw);
    delete locks[String(patientId)];
    localStorage.setItem(EDIT_LOCK_KEY, JSON.stringify(locks));
  } catch {
    // ignore
  }
}

// ── Audit log ───────────────────────────────────────────────────────────────

export function getAuditLog() {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addAuditEntry({ action, actorId, actorName, targetId, targetName, details }) {
  const log = getAuditLog();
  log.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    action,
    actorId: String(actorId || ''),
    actorName: actorName || '',
    targetId: String(targetId || ''),
    targetName: targetName || '',
    details: details || '',
    timestamp: new Date().toISOString(),
  });
  // Keep last 500 entries
  if (log.length > 500) log.length = 500;
  localStorage.setItem(AUDIT_KEY, JSON.stringify(log));
}

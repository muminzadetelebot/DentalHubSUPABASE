/**
 * clinicStorage.js
 * Multi-tenant clinic management — localStorage-based
 * Simulates: clinics, subscriptions, structured audit logs
 */

// ── Keys ─────────────────────────────────────────────────────────────────────
const CLINICS_KEY       = 'dh_clinics';
const SUBSCRIPTIONS_KEY = 'dh_subscriptions';
const ACTION_LOGS_KEY   = 'dh_action_logs';
const LOGIN_FAILS_KEY   = 'dh_login_fails';

// ── Default demo clinic ───────────────────────────────────────────────────────
const DEFAULT_CLINIC = {
  id: 'clinic_default',
  name: 'Главная клиника',
  phone: '',
  email: '',
  address: '',
  createdAt: new Date(2026, 0, 1).toISOString(),
  isActive: true,
};

const DEFAULT_SUBSCRIPTION = {
  id: 'sub_default',
  clinicId: 'clinic_default',
  plan: 'professional',
  status: 'active',        // active | expired | trial | blocked
  expiresAt: new Date(2027, 0, 1).toISOString(),
  limits: {
    doctors: 10,
    patients: 5000,
    storageMb: 2048,
  },
  createdAt: new Date(2026, 0, 1).toISOString(),
};

// ── Clinics CRUD ─────────────────────────────────────────────────────────────

export function getClinics() {
  try {
    const raw = localStorage.getItem(CLINICS_KEY);
    if (!raw) {
      localStorage.setItem(CLINICS_KEY, JSON.stringify([DEFAULT_CLINIC]));
      return [DEFAULT_CLINIC];
    }
    return JSON.parse(raw);
  } catch {
    return [DEFAULT_CLINIC];
  }
}

export function saveClinics(clinics) {
  localStorage.setItem(CLINICS_KEY, JSON.stringify(clinics));
}

export function getClinicById(id) {
  return getClinics().find(c => c.id === id) || null;
}

export function createClinic({ name, phone, email, address }) {
  const clinics = getClinics();
  const clinic = {
    id: 'clinic_' + Date.now().toString(36) + Math.random().toString(36).slice(2),
    name: name || '',
    phone: phone || '',
    email: email || '',
    address: address || '',
    createdAt: new Date().toISOString(),
    isActive: true,
  };
  clinics.push(clinic);
  saveClinics(clinics);
  // Auto-create trial subscription
  createSubscription({ clinicId: clinic.id, plan: 'trial', status: 'trial', days: 30 });
  return clinic;
}

export function updateClinic(id, patch) {
  const clinics = getClinics();
  const idx = clinics.findIndex(c => c.id === id);
  if (idx < 0) throw new Error('CLINIC_NOT_FOUND');
  clinics[idx] = { ...clinics[idx], ...patch };
  saveClinics(clinics);
  return clinics[idx];
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export function getSubscriptions() {
  try {
    const raw = localStorage.getItem(SUBSCRIPTIONS_KEY);
    if (!raw) {
      localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify([DEFAULT_SUBSCRIPTION]));
      return [DEFAULT_SUBSCRIPTION];
    }
    return JSON.parse(raw);
  } catch {
    return [DEFAULT_SUBSCRIPTION];
  }
}

export function saveSubscriptions(subs) {
  localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(subs));
}

export function getSubscriptionForClinic(clinicId) {
  const subs = getSubscriptions();
  return subs.find(s => s.clinicId === clinicId) || null;
}

export function createSubscription({ clinicId, plan, status, days }) {
  const subs = getSubscriptions();
  const existing = subs.findIndex(s => s.clinicId === clinicId);
  const expiresAt = new Date(Date.now() + (days || 365) * 24 * 3600 * 1000).toISOString();
  const sub = {
    id: 'sub_' + Date.now().toString(36) + Math.random().toString(36).slice(2),
    clinicId,
    plan: plan || 'starter',
    status: status || 'active',
    expiresAt,
    limits: plan === 'professional'
      ? { doctors: 10, patients: 5000, storageMb: 2048 }
      : plan === 'starter'
        ? { doctors: 3, patients: 500, storageMb: 256 }
        : { doctors: 1, patients: 100, storageMb: 50 },
    createdAt: new Date().toISOString(),
  };
  if (existing >= 0) {
    subs[existing] = sub;
  } else {
    subs.push(sub);
  }
  saveSubscriptions(subs);
  return sub;
}

export function updateSubscription(clinicId, patch) {
  const subs = getSubscriptions();
  const idx = subs.findIndex(s => s.clinicId === clinicId);
  if (idx < 0) throw new Error('SUBSCRIPTION_NOT_FOUND');
  subs[idx] = { ...subs[idx], ...patch };
  saveSubscriptions(subs);
  return subs[idx];
}

/**
 * Returns { active: bool, daysLeft: number|null, status, plan, limits }
 * Superadmin always passes.
 * Missing subscription = active (graceful fallback so legacy clinics are not locked out).
 */
export function checkSubscription(clinicId, role) {
  if (role === 'superadmin') return { active: true, daysLeft: null, status: 'active', plan: 'superadmin', limits: null };
  // No clinicId at all (legacy user) — allow access
  if (!clinicId || clinicId === '') return { active: true, daysLeft: null, status: 'active', plan: 'legacy', limits: null };
  const sub = getSubscriptionForClinic(clinicId);
  // No subscription record — treat as active (admin will manage it via SuperAdmin panel)
  if (!sub) return { active: true, daysLeft: null, status: 'active', plan: 'unmanaged', limits: null };
  const now = Date.now();
  const exp = new Date(sub.expiresAt).getTime();
  const daysLeft = Math.ceil((exp - now) / (24 * 3600 * 1000));
  const isExpired = exp < now || sub.status === 'expired' || sub.status === 'blocked';
  return {
    active: !isExpired && sub.status !== 'blocked',
    daysLeft: Math.max(0, daysLeft),
    status: isExpired ? 'expired' : sub.status,
    plan: sub.plan,
    limits: sub.limits,
  };
}

// ── Structured Action Logs ─────────────────────────────────────────────────────
// Schema mirrors: logs(id, clinic_id, user_id, action, entity, entity_id, ip, created_at)

export function getActionLogs({ clinicId, limit } = {}) {
  try {
    const raw = localStorage.getItem(ACTION_LOGS_KEY);
    let logs = raw ? JSON.parse(raw) : [];
    if (clinicId) logs = logs.filter(l => l.clinicId === clinicId || l.clinicId === '*');
    return limit ? logs.slice(0, limit) : logs;
  } catch {
    return [];
  }
}

export function addActionLog({ clinicId, userId, userName, action, entity, entityId, details }) {
  try {
    const raw = localStorage.getItem(ACTION_LOGS_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    logs.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      clinicId: clinicId || '*',
      userId: String(userId || ''),
      userName: userName || '',
      action: action || '',
      entity: entity || '',
      entityId: String(entityId || ''),
      details: details || '',
      // Simulated IP — in production comes from request headers
      ip: '127.0.0.1',
      createdAt: new Date().toISOString(),
    });
    if (logs.length > 2000) logs.length = 2000;
    localStorage.setItem(ACTION_LOGS_KEY, JSON.stringify(logs));
  } catch {
    // ignore storage errors
  }
}

// ── Login lockout ─────────────────────────────────────────────────────────────
// Tracks failed attempts per username, resets on success or after 15 min.

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 2 * 60 * 1000; // 2 minutes (demo-friendly)

export function getLoginFails(username) {
  try {
    const raw = localStorage.getItem(LOGIN_FAILS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const entry = map[username.toLowerCase()];
    if (!entry) return { count: 0, lockedUntil: null };
    // Auto-clear expired lockout
    if (entry.lockedUntil && Date.now() > entry.lockedUntil) {
      clearLoginFails(username);
      return { count: 0, lockedUntil: null };
    }
    return entry;
  } catch {
    return { count: 0, lockedUntil: null };
  }
}

export function recordLoginFail(username) {
  try {
    const raw = localStorage.getItem(LOGIN_FAILS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const key = username.toLowerCase();
    const current = map[key] || { count: 0, lockedUntil: null };
    const newCount = current.count + 1;
    map[key] = {
      count: newCount,
      lockedUntil: newCount >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : null,
      lastFailAt: new Date().toISOString(),
    };
    localStorage.setItem(LOGIN_FAILS_KEY, JSON.stringify(map));
    return map[key];
  } catch {
    return { count: 1, lockedUntil: null };
  }
}

export function clearLoginFails(username) {
  try {
    const raw = localStorage.getItem(LOGIN_FAILS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    delete map[username.toLowerCase()];
    localStorage.setItem(LOGIN_FAILS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/** Clears ALL lockouts for all usernames. Used by emergency unlock button. */
export function clearAllLockouts() {
  localStorage.removeItem(LOGIN_FAILS_KEY);
}

// ── Data export / purge per clinic ────────────────────────────────────────────

/**
 * exportClinicData(clinicId) — returns a JSON string with clinic metadata.
 * Patient/visit data export would be handled by storage.js in production.
 */
export function exportClinicData(clinicId) {
  const result = {
    clinic: getClinicById(clinicId),
    subscription: getSubscriptionForClinic(clinicId),
    logs: getActionLogs({ clinicId, limit: 1000 }),
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(result, null, 2);
}

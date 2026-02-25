import { getSupabaseClient } from './supabase';

// Lazy alias — avoids referencing a module-level supabase variable
const sb = () => getSupabaseClient();

// ── Patients (Supabase) ──────────────────────────────────────────

/**
 * Generates the next card number by querying max from Supabase.
 * Format: CL-000001, CL-000002, …
 */
export async function generateCardNumber() {
  const { data, error } = await sb()
    .from('patients')
    .select('card_number')
    .not('card_number', 'is', null);

  if (error) {
    console.error('generateCardNumber error:', error);
    return 'CL-' + String(Date.now()).slice(-6).padStart(6, '0');
  }

  let max = 0;
  for (const row of data || []) {
    if (row.card_number) {
      const num = parseInt(row.card_number.replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > max) max = num;
    }
  }
  return 'CL-' + String(max + 1).padStart(6, '0');
}

/**
 * Fetch all non-deleted patients.
 */
export async function getPatients() {
  const { data, error } = await sb()
    .from('patients')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getPatients error:', error);
    return [];
  }
  return data || [];
}

/**
 * Fetch patients visible to the current session user.
 * - superadmin: all clinics
 * - admin/registrar: their clinic
 * - doctor: only their own patients
 */
export async function getPatientsForSession(session) {
  if (!session) return getPatients();

  let query = sb()
    .from('patients')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (session.role !== 'superadmin') {
    const clinicId = session.clinicId || 'clinic_default';
    query = query.eq('clinic_id', clinicId);
  }

  if (session.role === 'doctor') {
    query = query.eq('doctor_id', String(session.id));
  }

  const { data, error } = await query;
  if (error) {
    console.error('getPatientsForSession error:', error);
    return [];
  }
  return data || [];
}

/**
 * Fetch a single patient by id.
 */
export async function getPatientById(id) {
  if (!id) return null;
  const { data, error } = await sb()
    .from('patients')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('getPatientById error:', error);
    return null;
  }
  return data;
}

/**
 * Insert a new patient record. Returns the created patient or null on error.
 */
export async function createPatient(patientData) {
  const { data, error } = await sb()
    .from('patients')
    .insert([{ ...patientData, is_deleted: false }])
    .select()
    .single();

  if (error) {
    console.error('createPatient error:', error);
    return null;
  }
  return data;
}

/**
 * Update fields on an existing patient. Returns the updated patient or null.
 */
export async function updatePatient(id, fields) {
  const { data, error } = await sb()
    .from('patients')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('updatePatient error:', error);
    return null;
  }
  return data;
}

/**
 * Soft-delete a patient.
 */
export async function softDeletePatient(id) {
  const { error } = await sb()
    .from('patients')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('softDeletePatient error:', error);
    return false;
  }
  return true;
}

// ── Visits (Supabase) ────────────────────────────────────────────

/**
 * Fetch all visits for a patient.
 */
export async function getVisitsByPatient(patientId) {
  const { data, error } = await sb()
    .from('visits')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getVisitsByPatient error:', error);
    return [];
  }
  return data || [];
}

/**
 * Insert a new visit. Returns the created visit or null.
 */
export async function createVisit(visitData) {
  const { data, error } = await sb()
    .from('visits')
    .insert([visitData])
    .select()
    .single();

  if (error) {
    console.error('createVisit error:', error);
    return null;
  }
  return data;
}

/**
 * Update a visit record. Returns updated visit or null.
 */
export async function updateVisit(id, fields) {
  const { data, error } = await sb()
    .from('visits')
    .update(fields)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('updateVisit error:', error);
    return null;
  }
  return data;
}

/**
 * Delete a visit record.
 */
export async function deleteVisit(id) {
  const { error } = await sb()
    .from('visits')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('deleteVisit error:', error);
    return false;
  }
  return true;
}

// ── Treatment Plans (Supabase) ───────────────────────────────────

/**
 * Fetch all treatment plan items for a patient.
 */
export async function getTreatmentPlanByPatient(patientId) {
  const { data, error } = await sb()
    .from('treatment_plans')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getTreatmentPlanByPatient error:', error);
    return [];
  }
  return data || [];
}

/**
 * Insert a new treatment plan item. Returns created item or null.
 */
export async function createTreatmentPlanItem(itemData) {
  const { data, error } = await sb()
    .from('treatment_plans')
    .insert([itemData])
    .select()
    .single();

  if (error) {
    console.error('createTreatmentPlanItem error:', error);
    return null;
  }
  return data;
}

/**
 * Update a treatment plan item. Returns updated item or null.
 */
export async function updateTreatmentPlanItem(id, fields) {
  const { data, error } = await sb()
    .from('treatment_plans')
    .update(fields)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('updateTreatmentPlanItem error:', error);
    return null;
  }
  return data;
}

/**
 * Delete a treatment plan item.
 */
export async function deleteTreatmentPlanItem(id) {
  const { error } = await sb()
    .from('treatment_plans')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('deleteTreatmentPlanItem error:', error);
    return false;
  }
  return true;
}

// ── Appointments (localStorage — unchanged) ──────────────────────
const APPT_KEY = 'dental_clinic_appointments';

export function getAppointments() {
  try {
    const raw = localStorage.getItem(APPT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAppointments(appts) {
  localStorage.setItem(APPT_KEY, JSON.stringify(appts));
}

export function getAppointmentsByDate(dateStr) {
  return getAppointments().filter(a => a.date === dateStr);
}

export function upsertAppointment(appt) {
  const all = getAppointments();
  const idx = all.findIndex(a => a.id === appt.id);
  if (idx >= 0) {
    all[idx] = appt;
  } else {
    all.push(appt);
  }
  saveAppointments(all);
}

export function deleteAppointment(id) {
  saveAppointments(getAppointments().filter(a => a.id !== id));
}

// ── Queue (localStorage — unchanged) ─────────────────────────────
const QUEUE_KEY = 'dental_clinic_queue';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function getQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getTodayQueue() {
  const today = todayStr();
  return getQueue().filter(q => q.date === today);
}

export function nextQueueNumber() {
  const today = getTodayQueue();
  if (today.length === 0) return 1;
  return Math.max(...today.map(q => q.queueNumber)) + 1;
}

export function addToQueue(phone, patientId, patientName) {
  const all = getQueue();
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    queueNumber: nextQueueNumber(),
    phone: phone || '',
    patientId: patientId || null,
    patientName: patientName || null,
    isNewPatient: !patientId,
    status: 'waiting',
    date: todayStr(),
    createdAt: new Date().toISOString(),
  };
  all.push(entry);
  saveQueue(all);
  return entry;
}

export function updateQueueEntry(id, patch) {
  const all = getQueue();
  const idx = all.findIndex(q => q.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...patch };
    saveQueue(all);
    return all[idx];
  }
  return null;
}

export function deleteQueueEntry(id) {
  saveQueue(getQueue().filter(q => q.id !== id));
}

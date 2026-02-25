import { useState, useEffect } from 'react';
import { updatePatient } from '../utils/storage';
import { useLang } from '../context/LangContext';
import {
  addPatientLog, getPatientLogs,
  setEditLock, getEditLock, clearEditLock,
  addAuditEntry,
} from '../utils/userStorage';
import Odontogram from './Odontogram';
import IcdSearchInput from './IcdSearchInput';

// Fields that a registrar is allowed to edit (Block 1 only) — camelCase UI keys
const REGISTRAR_FIELDS = [
  'fullName', 'birthDate', 'gender', 'phone', 'address', 'profession', 'passportId',
];

// Human-readable field names for logs
const FIELD_LABELS = {
  fullName: 'ФИО', birthDate: 'Дата рождения', gender: 'Пол',
  phone: 'Телефон', address: 'Адрес', profession: 'Профессия',
  passportId: 'Паспорт / ID',
  anamHeart: 'Сердечно-сосудистые', anamDiabetes: 'Диабет',
  anamAsthma: 'Астма', anamBlood: 'Болезни крови', anamEpilepsy: 'Эпилепсия',
  anamOtherText: 'Прочие болезни', permanentMeds: 'Лекарства',
  allergyText: 'Аллергия', operations: 'Операции', infectDiseases: 'Инфекции',
  visitReason: 'Причина обращения', duration: 'Длительность', lastVisit: 'Последний визит',
  xrayResults: 'Рентген: результаты',
  mainDiagnosis: 'Основной диагноз', secDiagnoses: 'Сопутствующие диагнозы',
  odontogram: 'Зубная формула',
};

/**
 * Read a patient field that may arrive in either snake_case (Supabase) or camelCase (legacy).
 * snakeKey takes priority; camelKey is the legacy fallback.
 */
function pf(patient, snakeKey, camelKey, def) {
  const v = patient[snakeKey];
  if (v !== undefined && v !== null) return v;
  const v2 = camelKey ? patient[camelKey] : undefined;
  if (v2 !== undefined && v2 !== null) return v2;
  return def;
}

/**
 * Map camelCase form state → snake_case DB columns for Supabase update.
 * Never sends fields that are not in the patients table.
 */
function toDbPayload(form) {
  return {
    full_name:   form.fullName   || '',
    birth_date:  form.birthDate  || null,
    gender:      form.gender     || '',
    phone:       form.phone      || '',
    address:     form.address    || '',
    profession:  form.profession || '',
    passport_id: form.passportId || '',
    anam_heart:      form.anamHeart      || false,
    anam_diabetes:   form.anamDiabetes   || false,
    anam_asthma:     form.anamAsthma     || false,
    anam_blood:      form.anamBlood      || false,
    anam_epilepsy:   form.anamEpilepsy   || false,
    anam_other:      form.anamOther      || false,
    anam_other_text: form.anamOtherText  || '',
    allergy_yes:     form.allergyYes     || false,
    allergy_text:    form.allergyText    || '',
    permanent_meds:  form.permanentMeds  || '',
    operations:      form.operations     || '',
    infect_diseases: form.infectDiseases || '',
    visit_reason:      form.visitReason      || '',
    duration:          form.duration         || '',
    last_visit:        form.lastVisit        || null,
    pain_yes:          form.painYes          || false,
    pain_severe:       form.painSevere       || false,
    pain_on_bite:      form.painOnBite       || false,
    treatment_regular: form.treatmentRegular || false,
    treatment_rare:    form.treatmentRare    || false,
    treatment_never:   form.treatmentNever   || false,
    face_sym:          form.faceSym          || false,
    face_asym:         form.faceAsym         || false,
    lymph_normal:      form.lymphNormal      || false,
    lymph_enlarged:    form.lymphEnlarged    || false,
    gums_healthy:      form.gumsHealthy      || false,
    gums_gingivitis:   form.gumsGingivitis   || false,
    gums_parodontitis: form.gumsParodontitis || false,
    hygiene_good:      form.hygieneGood      || false,
    hygiene_satisf:    form.hygieneSatisf    || false,
    hygiene_bad:       form.hygieneBad       || false,
    bite_ortho:        form.biteOrtho        || false,
    bite_deep:         form.biteDeep         || false,
    bite_open:         form.biteOpen         || false,
    bite_cross:        form.biteCross        || false,
    odontogram:    form.odontogram    || {},
    xray_pritsel:  form.xrayPritsel   || false,
    xray_optg:     form.xrayOPTG      || false,
    xray_klkt:     form.xrayKLKT      || false,
    xray_results:  form.xrayResults   || '',
    main_diagnosis: form.mainDiagnosis || null,
    sec_diagnoses:  form.secDiagnoses  || [],
    specialized:   form.specialized   || null,
    legal:         form.legal         || null,
  };
}

function fmt(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('ru-RU'); } catch { return iso; }
}

function stringify(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Да' : 'Нет';
  if (typeof val === 'object') {
    try { return JSON.stringify(val); } catch { return String(val); }
  }
  return String(val);
}

// Compute a flat diff between two patient objects
function computeDiff(original, updated, allowedFields) {
  const diffs = [];
  const fieldsToCheck = allowedFields || Object.keys(FIELD_LABELS);
  for (const field of fieldsToCheck) {
    const oldVal = stringify(original[field]);
    const newVal = stringify(updated[field]);
    if (oldVal !== newVal) {
      diffs.push({ field, oldVal, newVal });
    }
  }
  return diffs;
}

export default function EditPatientModal({ patient, session, onClose, onSaved }) {
  const { t, lang } = useLang();

  // Determine access level
  const isAdmin = session?.role === 'admin';
  const isDoctor = session?.role === 'doctor';
  const isRegistrar = session?.role === 'registrar';

  // Check ownership for doctors
  const ownsPatient = isAdmin || (isDoctor && String(patient.doctor_id) === String(session?.id));
  const canEdit = isAdmin || ownsPatient || isRegistrar;

  // Fields the current user may edit
  const allowedFields = isRegistrar ? REGISTRAR_FIELDS : null; // null = all

  const [form, setForm] = useState(() => {
    // Read fields accepting both snake_case (Supabase) and camelCase (legacy) keys
    const allergyYesVal = pf(patient, 'allergy_yes', 'allergyYes', false);
    const painYesVal    = pf(patient, 'pain_yes',    'painYes',    false);
    const rawMainDiag   = pf(patient, 'main_diagnosis', 'mainDiagnosis', null);
    const rawSecDiags   = pf(patient, 'sec_diagnoses',  'secDiagnoses',  []);
    const rawOdonto     = pf(patient, 'odontogram', 'odontogram', null);
    return {
      fullName:   pf(patient, 'full_name',   'fullName',   ''),
      birthDate:  pf(patient, 'birth_date',  'birthDate',  ''),
      gender:     patient.gender || '',
      phone:      patient.phone  || '',
      address:    patient.address || '',
      profession: patient.profession || '',
      passportId: pf(patient, 'passport_id', 'passportId', ''),
      // Block 2
      anamHeart:     pf(patient, 'anam_heart',     'anamHeart',     false),
      anamDiabetes:  pf(patient, 'anam_diabetes',  'anamDiabetes',  false),
      anamAsthma:    pf(patient, 'anam_asthma',    'anamAsthma',    false),
      anamBlood:     pf(patient, 'anam_blood',     'anamBlood',     false),
      anamEpilepsy:  pf(patient, 'anam_epilepsy',  'anamEpilepsy',  false),
      anamOther:     pf(patient, 'anam_other',     'anamOther',     false),
      anamOtherText: pf(patient, 'anam_other_text','anamOtherText', ''),
      permanentMeds: pf(patient, 'permanent_meds', 'permanentMeds', ''),
      allergyNo:  !allergyYesVal,
      allergyYes:  allergyYesVal,
      allergyText: pf(patient, 'allergy_text', 'allergyText', ''),
      operations:  patient.operations || '',
      infectDiseases: pf(patient, 'infect_diseases', 'infectDiseases', ''),
      // Block 3
      visitReason: pf(patient, 'visit_reason', 'visitReason', ''),
      duration:    patient.duration || '',
      lastVisit:   pf(patient, 'last_visit', 'lastVisit', ''),
      painNo:  !painYesVal,
      painYes:  painYesVal,
      painSevere:  pf(patient, 'pain_severe',  'painSevere',  false),
      painOnBite:  pf(patient, 'pain_on_bite', 'painOnBite',  false),
      treatmentRegular: pf(patient, 'treatment_regular', 'treatmentRegular', false),
      treatmentRare:    pf(patient, 'treatment_rare',    'treatmentRare',    false),
      treatmentNever:   pf(patient, 'treatment_never',   'treatmentNever',   false),
      // Block 4
      faceSym:          pf(patient, 'face_sym',          'faceSym',          false),
      faceAsym:         pf(patient, 'face_asym',         'faceAsym',         false),
      lymphNormal:      pf(patient, 'lymph_normal',      'lymphNormal',      false),
      lymphEnlarged:    pf(patient, 'lymph_enlarged',    'lymphEnlarged',    false),
      gumsHealthy:      pf(patient, 'gums_healthy',      'gumsHealthy',      false),
      gumsGingivitis:   pf(patient, 'gums_gingivitis',   'gumsGingivitis',   false),
      gumsParodontitis: pf(patient, 'gums_parodontitis', 'gumsParodontitis', false),
      hygieneGood:      pf(patient, 'hygiene_good',      'hygieneGood',      false),
      hygieneSatisf:    pf(patient, 'hygiene_satisf',    'hygieneSatisf',    false),
      hygieneBad:       pf(patient, 'hygiene_bad',       'hygieneBad',       false),
      biteOrtho:        pf(patient, 'bite_ortho',        'biteOrtho',        false),
      biteDeep:         pf(patient, 'bite_deep',         'biteDeep',         false),
      biteOpen:         pf(patient, 'bite_open',         'biteOpen',         false),
      biteCross:        pf(patient, 'bite_cross',        'biteCross',        false),
      // Block 5
      odontogram: rawOdonto ? { ...rawOdonto } : {},
      // Block 6
      xrayPritsel: pf(patient, 'xray_pritsel', 'xrayPritsel', false),
      xrayOPTG:    pf(patient, 'xray_optg',    'xrayOPTG',    false),
      xrayKLKT:    pf(patient, 'xray_klkt',    'xrayKLKT',    false),
      xrayResults: pf(patient, 'xray_results', 'xrayResults', ''),
      // Block 7
      mainDiagnosis: rawMainDiag
        ? (typeof rawMainDiag === 'object'
            ? { ...rawMainDiag }
            : { icdCode: '', descriptionRu: rawMainDiag, descriptionTj: '', toothNumber: '', comment: '' })
        : { icdCode: '', descriptionRu: '', descriptionTj: '', toothNumber: '', comment: '' },
      secDiagnoses: Array.isArray(rawSecDiags)
        ? rawSecDiags.map(d => ({ ...d }))
        : [],
    };
  });

  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'medical' | 'logs'
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [lockWarning, setLockWarning] = useState(null); // lock info if another user holds it
  const [logs, setLogs] = useState(() => getPatientLogs(patient.id));

  // Set edit lock on mount, clear on unmount
  useEffect(() => {
    if (!canEdit) return;
    // Check for existing lock from another user
    const existing = getEditLock(patient.id);
    if (existing && existing.userId !== String(session.id)) {
      setLockWarning(existing);
    }
    setEditLock(patient.id, session);

    return () => {
      clearEditLock(patient.id);
    };
  }, [patient.id, session, canEdit]);

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function radioSet(keys, chosen) {
    const patch = {};
    keys.forEach(k => { patch[k] = k === chosen; });
    setForm(f => ({ ...f, ...patch }));
  }

  function isFieldEditable(fieldName) {
    if (!canEdit) return false;
    if (isRegistrar) return REGISTRAR_FIELDS.includes(fieldName);
    return true;
  }

  async function handleSave() {
    if (!canEdit) { setError(t('editNoAccess')); return; }
    if (isDoctor && !ownsPatient) { setError(t('editOnlyOwn')); return; }

    // Build a camelCase snapshot for diff logging (compares form vs original camelCase view of patient)
    const formSnapshot = isRegistrar
      ? Object.fromEntries(REGISTRAR_FIELDS.map(k => [k, form[k]]))
      : { ...form };

    // Original patient expressed in same camelCase keys for diff comparison
    const origSnapshot = {
      fullName:   pf(patient, 'full_name',   'fullName',   ''),
      birthDate:  pf(patient, 'birth_date',  'birthDate',  ''),
      gender:     patient.gender || '',
      phone:      patient.phone  || '',
      address:    patient.address || '',
      profession: patient.profession || '',
      passportId: pf(patient, 'passport_id', 'passportId', ''),
      anamHeart:     pf(patient, 'anam_heart',     'anamHeart',     false),
      anamDiabetes:  pf(patient, 'anam_diabetes',  'anamDiabetes',  false),
      anamAsthma:    pf(patient, 'anam_asthma',    'anamAsthma',    false),
      anamBlood:     pf(patient, 'anam_blood',     'anamBlood',     false),
      anamEpilepsy:  pf(patient, 'anam_epilepsy',  'anamEpilepsy',  false),
      anamOther:     pf(patient, 'anam_other',     'anamOther',     false),
      anamOtherText: pf(patient, 'anam_other_text','anamOtherText', ''),
      permanentMeds: pf(patient, 'permanent_meds', 'permanentMeds', ''),
      allergyYes:  pf(patient, 'allergy_yes',  'allergyYes',  false),
      allergyText: pf(patient, 'allergy_text', 'allergyText', ''),
      operations:  patient.operations || '',
      infectDiseases: pf(patient, 'infect_diseases', 'infectDiseases', ''),
      visitReason: pf(patient, 'visit_reason', 'visitReason', ''),
      duration:    patient.duration || '',
      lastVisit:   pf(patient, 'last_visit', 'lastVisit', ''),
      xrayResults: pf(patient, 'xray_results', 'xrayResults', ''),
      mainDiagnosis: pf(patient, 'main_diagnosis', 'mainDiagnosis', null),
      secDiagnoses:  pf(patient, 'sec_diagnoses',  'secDiagnoses',  []),
      odontogram:    pf(patient, 'odontogram', 'odontogram', {}),
    };

    // Compute diffs using camelCase keys (FIELD_LABELS uses camelCase)
    const checkedFields = isRegistrar ? REGISTRAR_FIELDS : Object.keys(FIELD_LABELS);
    const diffs = computeDiff(origSnapshot, formSnapshot, checkedFields);
    const actorId = session.id;
    const actorName = session.name || session.login || '';
    const patientName = pf(patient, 'full_name', 'fullName', '');

    for (const diff of diffs) {
      addPatientLog({
        patientId: patient.id,
        changedBy: actorId,
        changedByName: actorName,
        fieldName: FIELD_LABELS[diff.field] || diff.field,
        oldValue: diff.oldVal,
        newValue: diff.newVal,
      });
    }

    if (diffs.length > 0) {
      addAuditEntry({
        action: 'patient_edited',
        actorId,
        actorName,
        targetId: patient.id,
        targetName: patientName,
        details: diffs.map(d => (FIELD_LABELS[d.field] || d.field)).join(', '),
      });
    }

    // Build snake_case payload for Supabase
    const dbPayload = isRegistrar
      ? {
          full_name:   form.fullName   || '',
          birth_date:  form.birthDate  || null,
          gender:      form.gender     || '',
          phone:       form.phone      || '',
          address:     form.address    || '',
          profession:  form.profession || '',
          passport_id: form.passportId || '',
        }
      : toDbPayload(form);

    // Save to Supabase
    const result = await updatePatient(patient.id, dbPayload);
    const updatedPatient = result || { ...patient, ...dbPayload, updated_at: new Date().toISOString() };

    // Update lock
    clearEditLock(patient.id);

    setSaved(true);
    setLogs(getPatientLogs(patient.id));
    if (onSaved) onSaved(updatedPatient);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  }

  // Tabs — registrar only sees general + logs
  const tabs = isRegistrar
    ? [['general', t('editTabGeneral')], ['logs', t('patientLogs')]]
    : [['general', t('editTabGeneral')], ['medical', t('editTabMedical')], ['logs', t('patientLogs')]];

  if (!canEdit) {
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal-box edit-pat-box">
          <div className="modal-header">
            <div className="modal-title">{t('editPatient')}</div>
            <button className="modal-close" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div className="modal-body">
            <div className="edit-pat-no-access">{t('editNoAccess')}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box edit-pat-box">

        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span>{t('editPatient')} — {pf(patient, 'full_name', 'fullName', '') || t('noName')}</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Lock warning */}
        {lockWarning && (
          <div className="edit-pat-lock-warn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {t('editLockUser')}: <strong>{lockWarning.userName}</strong> — {t('editLockWarning')}
            <button className="edit-pat-lock-dismiss" onClick={() => setLockWarning(null)}>
              {t('cancelEdit')} (ок)
            </button>
          </div>
        )}

        {/* Registrar note */}
        {isRegistrar && (
          <div className="edit-pat-registrar-note">{t('editRegistrarNote')}</div>
        )}

        {/* Tabs */}
        <div className="modal-tabs">
          {tabs.map(([key, label]) => (
            <button key={key}
              className={`modal-tab${activeTab === key ? ' modal-tab--active' : ''}`}
              onClick={() => setActiveTab(key)}>
              {label}
            </button>
          ))}
        </div>

        <div className="modal-body">

          {/* ── TAB: GENERAL (Block 1) ─────────────────────────── */}
          {activeTab === 'general' && (
            <div className="form-section">
              <div className="form-grid-2">
                <div className="form-group span-2">
                  <label>{t('fullName')}</label>
                  <input type="text" placeholder={t('fullNamePh')} value={form.fullName}
                    disabled={!isFieldEditable('fullName')}
                    onChange={e => set('fullName', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{t('birthDate')}</label>
                  <input type="date" value={form.birthDate}
                    disabled={!isFieldEditable('birthDate')}
                    onChange={e => set('birthDate', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{t('gender')}</label>
                  <div className="radio-row">
                    {[['M', t('male')], ['Z', t('female')]].map(([val, lbl]) => (
                      <label key={val} className="radio-item">
                        <input type="radio" name="ep-gender" value={val}
                          checked={form.gender === val}
                          disabled={!isFieldEditable('gender')}
                          onChange={() => set('gender', val)} />
                        <span>{lbl}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('phone')}</label>
                  <input type="tel" placeholder="+992 XXX XXX XXX" value={form.phone}
                    disabled={!isFieldEditable('phone')}
                    onChange={e => set('phone', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{t('passportId')}</label>
                  <input type="text" placeholder={t('passportPh')} value={form.passportId}
                    disabled={!isFieldEditable('passportId')}
                    onChange={e => set('passportId', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{t('address')}</label>
                  <input type="text" placeholder={t('addressPh')} value={form.address}
                    disabled={!isFieldEditable('address')}
                    onChange={e => set('address', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{t('profession')}</label>
                  <input type="text" placeholder={t('professionPh')} value={form.profession}
                    disabled={!isFieldEditable('profession')}
                    onChange={e => set('profession', e.target.value)} />
                </div>
              </div>

              {/* Doctor info (read-only) */}
              <div className="edit-pat-readonly-row">
                <span className="edit-pat-readonly-label">ID пациента:</span>
                <span className="edit-pat-readonly-val">{patient.id}</span>
                {patient.doctor_name && (
                  <>
                    <span className="edit-pat-readonly-label">Лечащий врач:</span>
                    <span className="edit-pat-readonly-val">{patient.doctor_name}</span>
                  </>
                )}
                {(patient.created_at || patient.createdAt) && (
                  <>
                    <span className="edit-pat-readonly-label">{t('createdAt')}</span>
                    <span className="edit-pat-readonly-val">{fmt(patient.created_at || patient.createdAt)}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: MEDICAL (Blocks 2–7) ─────────────────────── */}
          {activeTab === 'medical' && !isRegistrar && (
            <div className="form-section">

              {/* Block 2 — Anamnesis */}
              <h3 className="section-title">{t('sectionTitles')[1]}</h3>
              <div className="sub-label">{t('diseases')}</div>
              <div className="checkbox-grid">
                {[
                  ['anamHeart', t('heart')],
                  ['anamDiabetes', t('diabetes')],
                  ['anamAsthma', t('asthma')],
                  ['anamBlood', t('bloodDis')],
                  ['anamEpilepsy', t('epilepsy')],
                ].map(([key, lbl]) => (
                  <label key={key} className="checkbox-item">
                    <input type="checkbox" checked={form[key]} onChange={e => set(key, e.target.checked)} />
                    <span>{lbl}</span>
                  </label>
                ))}
                <label className="checkbox-item">
                  <input type="checkbox" checked={form.anamOther} onChange={e => set('anamOther', e.target.checked)} />
                  <span>{t('other')}</span>
                  {form.anamOther && (
                    <input type="text" className="inline-text" placeholder={t('otherPh')}
                      value={form.anamOtherText} onClick={e => e.stopPropagation()}
                      onChange={e => set('anamOtherText', e.target.value)} />
                  )}
                </label>
              </div>
              <div className="form-grid-2" style={{ marginTop: '1rem' }}>
                <div className="form-group">
                  <label>{t('permanentMeds')}</label>
                  <input type="text" placeholder={t('medsPh')} value={form.permanentMeds}
                    onChange={e => set('permanentMeds', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{t('allergy')}</label>
                  <div className="radio-row">
                    <label className="radio-item">
                      <input type="radio" name="ep-allergy" checked={form.allergyNo}
                        onChange={() => { set('allergyNo', true); set('allergyYes', false); }} />
                      <span>{t('allergyNo')}</span>
                    </label>
                    <label className="radio-item">
                      <input type="radio" name="ep-allergy" checked={form.allergyYes}
                        onChange={() => { set('allergyNo', false); set('allergyYes', true); }} />
                      <span>{t('allergyYes')}</span>
                    </label>
                  </div>
                  {form.allergyYes && (
                    <input type="text" placeholder={t('allergyPh')} value={form.allergyText}
                      onChange={e => set('allergyText', e.target.value)} style={{ marginTop: '0.4rem' }} />
                  )}
                </div>
                <div className="form-group">
                  <label>{t('operations')}</label>
                  <input type="text" placeholder={t('operPh')} value={form.operations}
                    onChange={e => set('operations', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{t('infectDiseases')}</label>
                  <input type="text" placeholder={t('infectPh')} value={form.infectDiseases}
                    onChange={e => set('infectDiseases', e.target.value)} />
                </div>
              </div>

              {/* Block 3 — Dental anamnesis */}
              <h3 className="section-title" style={{ marginTop: '1.5rem' }}>{t('sectionTitles')[2]}</h3>
              <div className="form-group">
                <label>{t('visitReason')}</label>
                <textarea rows={3} placeholder={t('visitReasonPh')}
                  value={form.visitReason} onChange={e => set('visitReason', e.target.value)} />
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>{t('duration')}</label>
                  <input type="text" placeholder={t('durationPh')} value={form.duration}
                    onChange={e => set('duration', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{t('lastVisit')}</label>
                  <input type="date" value={form.lastVisit}
                    onChange={e => set('lastVisit', e.target.value)} />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label>{t('pain')}</label>
                <div className="radio-row">
                  <label className="radio-item">
                    <input type="radio" name="ep-pain" checked={form.painNo}
                      onChange={() => { set('painNo', true); set('painYes', false); }} />
                    <span>{t('painNo')}</span>
                  </label>
                  <label className="radio-item">
                    <input type="radio" name="ep-pain" checked={form.painYes}
                      onChange={() => { set('painNo', false); set('painYes', true); }} />
                    <span>{t('painYes')}</span>
                  </label>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label>{t('prevTreatment')}</label>
                <div className="radio-row">
                  {[
                    ['treatmentRegular', t('treatRegular')],
                    ['treatmentRare', t('treatRare')],
                    ['treatmentNever', t('treatNever')],
                  ].map(([key, lbl]) => (
                    <label key={key} className="radio-item">
                      <input type="radio" name="ep-prevTreatment" checked={form[key]}
                        onChange={() => radioSet(['treatmentRegular', 'treatmentRare', 'treatmentNever'], key)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Block 4 — Examination */}
              <h3 className="section-title" style={{ marginTop: '1.5rem' }}>{t('sectionTitles')[3]}</h3>
              <div className="exam-grid">
                {[
                  { label: t('face'), name: 'face', options: [['faceSym', t('faceSym')], ['faceAsym', t('faceAsym')]] },
                  { label: t('lymph'), name: 'lymph', options: [['lymphNormal', t('lymphNormal')], ['lymphEnlarged', t('lymphEnlarged')]] },
                  { label: t('gums'), name: 'gums', options: [['gumsHealthy', t('gumsHealthy')], ['gumsGingivitis', t('gumsGingivitis')], ['gumsParodontitis', t('gumsParodontitis')]] },
                  { label: t('hygiene'), name: 'hygiene', options: [['hygieneGood', t('hygieneGood')], ['hygieneSatisf', t('hygieneSatisf')], ['hygieneBad', t('hygieneBad')]] },
                  { label: t('bite'), name: 'bite', options: [['biteOrtho', t('biteOrtho')], ['biteDeep', t('biteDeep')], ['biteOpen', t('biteOpen')], ['biteCross', t('biteCross')]] },
                ].map(group => (
                  <div key={group.name} className="exam-group">
                    <div className="sub-label">{group.label}</div>
                    <div className="radio-col">
                      {group.options.map(([key, lbl]) => (
                        <label key={key} className="radio-item">
                          <input type="radio" name={"ep-" + group.name} checked={form[key]}
                            onChange={() => radioSet(group.options.map(o => o[0]), key)} />
                          <span>{lbl}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Block 5 — Odontogram */}
              <h3 className="section-title" style={{ marginTop: '1.5rem' }}>{t('sectionTitles')[4]}</h3>
              <Odontogram value={form.odontogram} onChange={val => set('odontogram', val)} />

              {/* Block 6 — Xray */}
              <h3 className="section-title" style={{ marginTop: '1.5rem' }}>{t('sectionTitles')[5]}</h3>
              <div className="sub-label">{t('xrayType')}</div>
              <div className="checkbox-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {[['xrayPritsel', t('xrayPritsel')], ['xrayOPTG', t('xrayOPTG')], ['xrayKLKT', t('xrayKLKT')]].map(([key, lbl]) => (
                  <label key={key} className="checkbox-item">
                    <input type="checkbox" checked={form[key]} onChange={e => set(key, e.target.checked)} />
                    <span>{lbl}</span>
                  </label>
                ))}
              </div>
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>{t('xrayResults')}</label>
                <textarea rows={4} placeholder={t('xrayResultsPh')}
                  value={form.xrayResults} onChange={e => set('xrayResults', e.target.value)} />
              </div>

              {/* Block 7 — Diagnosis */}
              <h3 className="section-title" style={{ marginTop: '1.5rem' }}>{t('sectionTitles')[6]}</h3>
              <div className="diag7-group">
                <div className="diag7-group-label diag7-group-label--main">{t('mainDiag')}</div>
                <div className="icd-table-wrap">
                  <div className="icd-header-row">
                    <div className="icd-hdr-code">{t('diagCode')}</div>
                    <div className="icd-hdr-desc">{t('diagDesc')}</div>
                    <div className="icd-hdr-tooth">{t('diagTooth')}</div>
                    <div className="icd-hdr-comment">{t('diagComment')}</div>
                    <div className="icd-hdr-del" />
                  </div>
                  <div className="icd-row-wrap icd-row-wrap--main">
                    <div className="icd-row">
                      <IcdSearchInput
                        value={form.mainDiagnosis.icdCode}
                        lang={lang}
                        placeholder={t('diagCodePh')}
                        onChange={patch => set('mainDiagnosis', { ...form.mainDiagnosis, ...patch })}
                      />
                      <div className="icd-desc-cell">
                        {(lang === 'tj' ? form.mainDiagnosis.descriptionTj : form.mainDiagnosis.descriptionRu)
                          ? <span className="icd-desc-text">{lang === 'tj' ? form.mainDiagnosis.descriptionTj : form.mainDiagnosis.descriptionRu}</span>
                          : <span className="icd-desc-placeholder">{t('diagDesc')}</span>}
                      </div>
                      <input type="text" className="icd-tooth-input" placeholder={t('diagToothPh')}
                        value={form.mainDiagnosis.toothNumber} maxLength={2}
                        onChange={e => set('mainDiagnosis', { ...form.mainDiagnosis, toothNumber: e.target.value })} />
                      <input type="text" className="icd-comment-input" placeholder={t('diagCommentPh')}
                        value={form.mainDiagnosis.comment}
                        onChange={e => set('mainDiagnosis', { ...form.mainDiagnosis, comment: e.target.value })} />
                    </div>
                    <div style={{ width: 32 }} />
                  </div>
                </div>
              </div>
              <div className="diag7-group">
                <div className="diag7-group-label">{t('secDiag')}</div>
                {form.secDiagnoses.length > 0 && (
                  <div className="icd-table-wrap">
                    <div className="icd-header-row">
                      <div className="icd-hdr-code">{t('diagCode')}</div>
                      <div className="icd-hdr-desc">{t('diagDesc')}</div>
                      <div className="icd-hdr-tooth">{t('diagTooth')}</div>
                      <div className="icd-hdr-comment">{t('diagComment')}</div>
                      <div className="icd-hdr-del" />
                    </div>
                    {form.secDiagnoses.map((sd, sdIdx) => (
                      <div key={sd.id || sdIdx} className="icd-row-wrap">
                        <div className="icd-row">
                          <IcdSearchInput value={sd.icdCode} lang={lang} placeholder={t('diagCodePh')}
                            onChange={patch => {
                              const next = form.secDiagnoses.map((d, i) => i === sdIdx ? { ...d, ...patch } : d);
                              set('secDiagnoses', next);
                            }} />
                          <div className="icd-desc-cell">
                            {(lang === 'tj' ? sd.descriptionTj : sd.descriptionRu)
                              ? <span className="icd-desc-text">{lang === 'tj' ? sd.descriptionTj : sd.descriptionRu}</span>
                              : <span className="icd-desc-placeholder">{t('diagDesc')}</span>}
                          </div>
                          <input type="text" className="icd-tooth-input" placeholder={t('diagToothPh')}
                            value={sd.toothNumber} maxLength={2}
                            onChange={e => {
                              const next = form.secDiagnoses.map((d, i) => i === sdIdx ? { ...d, toothNumber: e.target.value } : d);
                              set('secDiagnoses', next);
                            }} />
                          <input type="text" className="icd-comment-input" placeholder={t('diagCommentPh')}
                            value={sd.comment}
                            onChange={e => {
                              const next = form.secDiagnoses.map((d, i) => i === sdIdx ? { ...d, comment: e.target.value } : d);
                              set('secDiagnoses', next);
                            }} />
                        </div>
                        <button className="icd-del-btn" title={t('removeDiag')}
                          onClick={() => set('secDiagnoses', form.secDiagnoses.filter((_, i) => i !== sdIdx))}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button className="vp-add-btn" onClick={() => set('secDiagnoses', [
                  ...form.secDiagnoses,
                  { id: Date.now().toString() + Math.random().toString(36).slice(2), icdCode: '', descriptionRu: '', descriptionTj: '', toothNumber: '', comment: '' }
                ])}>
                  {t('addSecDiag')}
                </button>
              </div>

            </div>
          )}

          {/* ── TAB: HISTORY / LOGS ────────────────────────────── */}
          {activeTab === 'logs' && (
            <div className="form-section">
              <h3 className="section-title">{t('patientLogs')}</h3>
              {logs.length === 0 ? (
                <div className="edit-pat-logs-empty">{t('logsEmpty')}</div>
              ) : (
                <div className="edit-pat-logs-wrap">
                  <table className="edit-pat-logs-table">
                    <thead>
                      <tr>
                        <th>{t('logsColField')}</th>
                        <th>{t('logsColOld')}</th>
                        <th>{t('logsColNew')}</th>
                        <th>{t('logsColWho')}</th>
                        <th>{t('logsColWhen')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(entry => (
                        <tr key={entry.id}>
                          <td><strong>{entry.fieldName}</strong></td>
                          <td className="edit-pat-log-old">{entry.oldValue || '—'}</td>
                          <td className="edit-pat-log-new">{entry.newValue || '—'}</td>
                          <td>{entry.changedByName || entry.changedBy}</td>
                          <td className="edit-pat-log-when">
                            {entry.changedAt ? new Date(entry.changedAt).toLocaleString('ru-RU') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div />
          {error && <div className="edit-pat-error">{error}</div>}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {saved && <span className="edit-pat-success">{t('editSuccess')}</span>}
            <button className="btn-nav" onClick={onClose}>{t('cancelEdit')}</button>
            {activeTab !== 'logs' && (
              <button
                className={`btn-save${saved ? ' btn-save--ok' : ''}`}
                onClick={handleSave}
                disabled={saved}>
                {saved ? t('editSuccess') : t('saveChanges')}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

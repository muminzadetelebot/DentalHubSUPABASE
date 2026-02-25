import { useState, useEffect } from 'react';
import { getPatientsForSession, softDeletePatient } from '../utils/storage';
import { useLang } from '../context/LangContext';
import { verifyPassword } from './LoginScreen';
import { getUserByUsername } from '../utils/userStorage';
import VisitLog from './VisitLog';
import PrintCard from './PrintCard';
import EditPatientModal from './EditPatientModal';
import TreatmentPlan from './TreatmentPlan';

export default function FindPatientModal({ onClose, session, initialPatient }) {
  const { t } = useLang();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(initialPatient || null);
  const [planPrefill, setPlanPrefill] = useState(null); // plan item to prefill into visit
  const [patients, setPatients] = useState(initialPatient ? [initialPatient] : []);
  const [loadingPatients, setLoadingPatients] = useState(true);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState(null); // patient id pending delete
  const [deletePwd, setDeletePwd] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [cardTab, setCardTab] = useState(initialPatient ? 'visits' : 'info'); // 'info' | 'visits' | 'treatplan' | 'print'
  const [editTarget, setEditTarget] = useState(null); // patient being edited

  // Load patients from Supabase on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingPatients(true);
    getPatientsForSession(session).then(all => {
      if (cancelled) return;
      // If initialPatient was just created, make sure it appears in the list
      if (initialPatient && !all.find(p => p.id === initialPatient.id)) {
        setPatients([initialPatient, ...all]);
      } else {
        setPatients(all);
      }
      setLoadingPatients(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Anam flags — check both snake_case (Supabase) and camelCase (legacy) keys
  const ANAM_FLAGS = [
    ['anam_heart',     'anamHeart',    t('heart')],
    ['anam_diabetes',  'anamDiabetes', t('diabetes')],
    ['anam_asthma',    'anamAsthma',   t('asthma')],
    ['anam_blood',     'anamBlood',    t('bloodDis')],
    ['anam_epilepsy',  'anamEpilepsy', t('epilepsy')],
  ];

  /** Read a patient field that may be snake_case or camelCase */
  function pf(p, snk, cam, def) {
    const v = p[snk];
    if (v !== undefined && v !== null) return v;
    const v2 = cam ? p[cam] : undefined;
    if (v2 !== undefined && v2 !== null) return v2;
    return def;
  }

  function handlePatientUpdated(updatedPatient) {
    setPatients(prev => prev.map(p => p.id === updatedPatient.id ? updatedPatient : p));
    setSelected(updatedPatient);
  }

  const filtered = query.trim().length === 0
    ? patients
    : patients.filter(p => {
        const q = query.toLowerCase();
        const name = (p.full_name || p.fullName || '').toLowerCase();
        const phone = (p.phone || '').toLowerCase();
        const pid = (p.passport_id || p.passportId || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || pid.includes(q);
      });

  // Open the confirmation modal — only admins reach here
  function requestDelete(id) {
    setDeleteTarget(id);
    setDeletePwd('');
    setDeleteError('');
  }

  function cancelDelete() {
    setDeleteTarget(null);
    setDeletePwd('');
    setDeleteError('');
  }

  async function confirmDelete() {
    // Verify password against live user storage
    const user = getUserByUsername(session?.login);
    if (!user || !verifyPassword(deletePwd, user.passwordHash)) {
      setDeleteError(t('deleteModalWrongPwd'));
      return;
    }
    // Soft delete via Supabase
    const ok = await softDeletePatient(deleteTarget);
    if (!ok) {
      setDeleteError('Ошибка при удалении. Попробуйте снова.');
      return;
    }
    // Remove from visible list
    setPatients(prev => prev.filter(p => p.id !== deleteTarget));
    if (selected?.id === deleteTarget) setSelected(null);
    cancelDelete();
  }

  function fmt(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('ru-RU'); } catch { return iso; }
  }

  function genderLabel(g) {
    if (g === 'M') return t('male');
    if (g === 'Z') return t('female');
    return '—';
  }

  function treatmentTotal(plan) {
    if (!plan?.length) return 0;
    return plan.reduce((s, r) => s + (parseFloat(r.price) || 0), 0);
  }

  return (
    <>
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal-box modal-box--find${selected ? ' modal-box--split' : ''}`}>

        {/* ── LEFT: search list ─────────────────────────────── */}
        <div className="find-left">
          <div className="modal-header">
            <div className="modal-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span>{t('findTitle')}</span>
            </div>
            <button className="modal-close" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="search-bar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" placeholder={t('searchPh')}
              value={query} autoFocus onChange={e => setQuery(e.target.value)} />
          </div>

          <div className="patient-list">
            {loadingPatients && (
              <div className="patient-list-empty">{t('loading') || 'Загрузка...'}</div>
            )}
            {!loadingPatients && filtered.length === 0 && (
              <div className="patient-list-empty">
                {patients.length === 0 ? t('noPatientsYet') : t('noPatients')}
              </div>
            )}
            {filtered.map(p => (
              <div key={p.id}
                className={`patient-item${selected?.id === p.id ? ' patient-item--active' : ''}`}
                onClick={() => { setSelected(p); setCardTab('info'); }}>
                <div className="patient-item-avatar">
                  {((p.full_name || p.fullName) || '?')[0].toUpperCase()}
                </div>
                <div className="patient-item-info">
                  <div className="patient-item-name">{p.full_name || p.fullName || t('noName')}</div>
                  <div className="patient-item-meta">
                    {p.phone && <span>{p.phone}</span>}
                    {(p.passport_id || p.passportId) && <span>ID: {p.passport_id || p.passportId}</span>}
                  </div>
                </div>
                {session?.role === 'admin' && (
                  <button className="patient-item-del"
                    onClick={e => { e.stopPropagation(); requestDelete(p.id); }}
                    title={t('deleteTitle')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14H6L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="find-footer-count">
            {t('total_patients')} <strong>{patients.length}</strong>
            {query && ` ${t('found')} ${filtered.length}`}
          </div>
        </div>

        {/* ── RIGHT: patient card ───────────────────────────── */}
        {selected && (
          <div className="find-right">
            <div className="card-header">
              <div className="card-avatar-big">
                {((selected.full_name || selected.fullName) || '?')[0].toUpperCase()}
              </div>
              <div className="card-head-info">
                <h2>
                  {selected.full_name || selected.fullName || t('noName')}
                  {selected.card_number && (
                    <span className="card-number-badge">{selected.card_number}</span>
                  )}
                </h2>
                <p>
                  {genderLabel(selected.gender)}
                  {(selected.birth_date || selected.birthDate) && ` | ${fmt(selected.birth_date || selected.birthDate)}`}
                  {(selected.passport_id || selected.passportId) && ` | ID: ${selected.passport_id || selected.passportId}`}
                </p>
                <p>
                  {selected.phone}
                  {selected.address && ` | ${selected.address}`}
                  {selected.profession && ` | ${selected.profession}`}
                </p>
              </div>
              {/* Edit button — admin sees all, doctor sees own patients, registrar sees all */}
              {(session?.role === 'admin' ||
                session?.role === 'registrar' ||
                (session?.role === 'doctor' && String(selected.doctor_id) === String(session?.id))
              ) && (
                <button className="card-edit-btn" onClick={() => setEditTarget(selected)}
                  title={t('editPatientBtn')}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  {t('editPatientBtn')}
                </button>
              )}
              <button className="card-close" onClick={() => setSelected(null)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Quick action buttons */}
            <div className="card-quick-actions">
              <button className="card-quick-btn card-quick-btn--primary"
                onClick={() => setCardTab('visits')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  <line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>
                </svg>
                {t('addVisitBtn')}
              </button>
              <button className="card-quick-btn card-quick-btn--secondary"
                onClick={() => setCardTab('treatplan')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                {t('addTreatPlanBtn')}
              </button>
            </div>

            {/* Card sub-tabs */}
            <div className="card-subtabs">
              {[
                ['info', t('tabInfo')],
                ['visits', t('tabVisits')],
                ['treatplan', t('tabTreatPlan')],
                ['print', t('tabPrint')],
              ].map(([tab, lbl]) => (
                <button key={tab}
                  className={`card-subtab${cardTab === tab ? ' card-subtab--active' : ''}`}
                  onClick={() => setCardTab(tab)}>
                  {lbl}
                  {tab === 'visits' && selected.visits?.length > 0 && (
                    <span className="visit-count-badge">{selected.visits.length}</span>
                  )}
                  {tab === 'treatplan' && (selected.longTermPlan?.length || 0) > 0 && (
                    <span className="visit-count-badge">{selected.longTermPlan.length}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="card-body">

              {/* ── INFO TAB ── */}
              {cardTab === 'info' && (
                <div className="card-tab-content">

                  {/* Anamnesis flags */}
                  <div className="card-section">
                    <div className="card-section-label">{t('anamnesis')}</div>
                    <div className="med-flags">
                      {ANAM_FLAGS.filter(([snk, cam]) => pf(selected, snk, cam, false)).map(([snk, , lbl]) => (
                        <span key={snk} className="med-flag">{lbl}</span>
                      ))}
                      {ANAM_FLAGS.every(([snk, cam]) => !pf(selected, snk, cam, false)) && !pf(selected, 'anam_other', 'anamOther', false) && (
                        <span className="text-muted">{t('noFlags')}</span>
                      )}
                      {pf(selected, 'anam_other', 'anamOther', false) && pf(selected, 'anam_other_text', 'anamOtherText', '') && (
                        <span className="med-flag med-flag--other">{pf(selected, 'anam_other_text', 'anamOtherText', '')}</span>
                      )}
                      {pf(selected, 'allergy_yes', 'allergyYes', false) && (
                        <span className="med-flag med-flag--allergy">
                          {t('allergy')}{pf(selected, 'allergy_text', 'allergyText', '') ? `: ${pf(selected, 'allergy_text', 'allergyText', '')}` : ''}
                        </span>
                      )}
                    </div>
                    {pf(selected, 'permanent_meds', 'permanentMeds', '') && (
                      <div className="card-row"><strong>{t('medications')}</strong> {pf(selected, 'permanent_meds', 'permanentMeds', '')}</div>
                    )}
                    {pf(selected, 'infect_diseases', 'infectDiseases', '') && (
                      <div className="card-row"><strong>{t('infections')}</strong> {pf(selected, 'infect_diseases', 'infectDiseases', '')}</div>
                    )}
                  </div>

                  {/* Dental anamnesis */}
                  {(pf(selected,'visit_reason','visitReason','') || selected.duration || pf(selected,'last_visit','lastVisit','')) && (
                    <div className="card-section">
                      <div className="card-section-label">{t('dentalAnamCard')}</div>
                      {pf(selected,'visit_reason','visitReason','') && <div className="card-text">{pf(selected,'visit_reason','visitReason','')}</div>}
                      {selected.duration && (
                        <div className="card-row"><strong>{t('durationCard')}</strong> {selected.duration}</div>
                      )}
                      {pf(selected,'last_visit','lastVisit','') && (
                        <div className="card-row"><strong>{t('lastVisitCard')}</strong> {fmt(pf(selected,'last_visit','lastVisit',''))}</div>
                      )}
                    </div>
                  )}

                  {/* Examination */}
                  {(pf(selected,'gums_healthy','gumsHealthy',false) || pf(selected,'gums_gingivitis','gumsGingivitis',false) || pf(selected,'gums_parodontitis','gumsParodontitis',false) ||
                    pf(selected,'bite_ortho','biteOrtho',false) || pf(selected,'bite_deep','biteDeep',false) || pf(selected,'bite_open','biteOpen',false) || pf(selected,'bite_cross','biteCross',false)) && (
                    <div className="card-section">
                      <div className="card-section-label">{t('examCard')}</div>
                      <div className="card-row">
                        {pf(selected,'face_sym','faceSym',false) && <span className="mini-badge">{t('faceSym')}</span>}
                        {pf(selected,'face_asym','faceAsym',false) && <span className="mini-badge mini-badge--warn">{t('faceAsym')}</span>}
                        {pf(selected,'lymph_enlarged','lymphEnlarged',false) && <span className="mini-badge mini-badge--warn">{t('lymphEnlarged')}</span>}
                        {pf(selected,'gums_gingivitis','gumsGingivitis',false) && <span className="mini-badge mini-badge--warn">{t('gumsGingivitis')}</span>}
                        {pf(selected,'gums_parodontitis','gumsParodontitis',false) && <span className="mini-badge mini-badge--danger">{t('gumsParodontitis')}</span>}
                        {pf(selected,'gums_healthy','gumsHealthy',false) && <span className="mini-badge">{t('gumsHealthy')}</span>}
                        {pf(selected,'bite_ortho','biteOrtho',false) && <span className="mini-badge">{t('biteOrtho')}</span>}
                        {pf(selected,'bite_deep','biteDeep',false) && <span className="mini-badge mini-badge--warn">{t('biteDeep')}</span>}
                        {pf(selected,'bite_open','biteOpen',false) && <span className="mini-badge mini-badge--warn">{t('biteOpen')}</span>}
                        {pf(selected,'bite_cross','biteCross',false) && <span className="mini-badge mini-badge--warn">{t('biteCross')}</span>}
                      </div>
                    </div>
                  )}

                  {/* Odontogram summary */}
                  {selected.odontogram && Object.keys(selected.odontogram).length > 0 && (
                    <div className="card-section">
                      <div className="card-section-label">{t('toothFormula')}</div>
                      <div className="odonto-card-summary">
                        {Object.entries(selected.odontogram).map(([num, code]) => (
                          <span key={num} className="odonto-card-item">{num}:{code}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Xray */}
                  {(pf(selected,'xray_pritsel','xrayPritsel',false) || pf(selected,'xray_optg','xrayOPTG',false) || pf(selected,'xray_klkt','xrayKLKT',false) || pf(selected,'xray_results','xrayResults','')) && (
                    <div className="card-section">
                      <div className="card-section-label">{t('xrayCard')}</div>
                      <div className="med-flags" style={{ marginBottom: '0.4rem' }}>
                        {pf(selected,'xray_pritsel','xrayPritsel',false) && <span className="med-flag">{t('xrayPritsel')}</span>}
                        {pf(selected,'xray_optg','xrayOPTG',false) && <span className="med-flag">{t('xrayOPTG')}</span>}
                        {pf(selected,'xray_klkt','xrayKLKT',false) && <span className="med-flag">{t('xrayKLKT')}</span>}
                      </div>
                      {pf(selected,'xray_results','xrayResults','') && <div className="card-text">{pf(selected,'xray_results','xrayResults','')}</div>}
                    </div>
                  )}

                  {/* Diagnosis */}
                  {(() => {
                    const md = pf(selected, 'main_diagnosis', 'mainDiagnosis', null);
                    const sds = pf(selected, 'sec_diagnoses', 'secDiagnoses', []);
                    const mainIsObj = md && typeof md === 'object';
                    const mainStr = !mainIsObj && typeof md === 'string' ? md : null;
                    const mainCode = mainIsObj && md.icdCode ? md.icdCode : null;
                    const mainDesc = mainIsObj ? (md.descriptionRu || md.descriptionTj || '') : null;
                    const hasMain = mainStr || mainCode;
                    const hasSec = sds.length > 0 || (typeof selected.secDiagnosis === 'string' && selected.secDiagnosis);
                    if (!hasMain && !hasSec) return null;
                    return (
                      <div className="card-section">
                        <div className="card-section-label">{t('diagCard')}</div>
                        {hasMain && (
                          <div className="card-row">
                            <strong>{t('mainDiagCard')}</strong>{' '}
                            {mainStr || [mainCode, mainDesc ? ` — ${mainDesc}` : '', md.toothNumber ? ` (${md.toothNumber})` : ''].join('')}
                          </div>
                        )}
                        {hasSec && (
                          <div className="card-row">
                            <strong>{t('secDiagCard')}</strong>{' '}
                            {sds.length > 0
                              ? sds.map((sd, i) => (
                                  <span key={i}>{sd.icdCode}{sd.descriptionRu ? ` — ${sd.descriptionRu}` : ''}{i < sds.length - 1 ? '; ' : ''}</span>
                                ))
                              : selected.secDiagnosis}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Treatment plan */}
                  {selected.treatmentPlan?.length > 0 && (
                    <div className="card-section">
                      <div className="card-section-label">{t('treatPlanCard')}</div>
                      <div className="treatment-table-wrap">
                        <table className="treatment-table">
                          <thead>
                            <tr>
                              <th style={{ width: '36px' }}>№</th>
                              <th>{t('treatColCard')}</th>
                              <th style={{ width: '110px' }}>{t('priceColCard')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selected.treatmentPlan.map((row, i) => (
                              <tr key={i}>
                                <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{i + 1}</td>
                                <td>{row.treatment || '—'}</td>
                                <td>{row.price ? `${Number(row.price).toLocaleString('ru-RU')} ${t('currency')}` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {treatmentTotal(selected.treatmentPlan) > 0 && (
                        <div className="treatment-total">
                          {t('totalCard')} <strong>{treatmentTotal(selected.treatmentPlan).toLocaleString('ru-RU')} {t('currency')}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="card-created">
                    {t('createdAt')} {fmt(selected.created_at || selected.createdAt)}
                  </div>

                </div>
              )}

              {/* ── VISITS TAB ── */}
              {cardTab === 'visits' && (
                <VisitLog
                  patient={selected}
                  onPatientUpdated={handlePatientUpdated}
                  session={session}
                  prefillFromPlan={planPrefill}
                  onPrefillConsumed={() => setPlanPrefill(null)}
                />
              )}

              {/* ── TREATMENT PLAN TAB ── */}
              {cardTab === 'treatplan' && (
                <TreatmentPlan
                  patient={selected}
                  onPatientUpdated={handlePatientUpdated}
                  onCreateVisitFromPlan={planItem => {
                    setPlanPrefill(planItem);
                    setCardTab('visits');
                  }}
                />
              )}

              {/* ── PRINT TAB ── */}
              {cardTab === 'print' && (
                <PrintCard patient={selected} />
              )}

            </div>
          </div>
        )}

      </div>
    </div>

    {/* ── EDIT PATIENT MODAL ─────────────────────────────────── */}
    {editTarget && (
      <EditPatientModal
        patient={editTarget}
        session={session}
        onClose={() => setEditTarget(null)}
        onSaved={updatedPatient => {
          handlePatientUpdated(updatedPatient);
          setEditTarget(null);
        }}
      />
    )}

    {/* ── DELETE CONFIRMATION MODAL ─────────────────────────── */}
    {deleteTarget && (
      <div className="modal-overlay del-confirm-overlay" onClick={e => e.target === e.currentTarget && cancelDelete()}>
        <div className="modal-box del-confirm-box">
          <div className="modal-header">
            <div className="modal-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
              <span style={{ color: 'var(--danger)' }}>{t('deleteModalTitle')}</span>
            </div>
            <button className="modal-close" onClick={cancelDelete}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div className="del-confirm-body">
            <p className="del-confirm-desc">{t('deleteModalDesc')}</p>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>{t('deleteModalPasswordLabel')}</label>
              <input
                type="password"
                placeholder={t('deleteModalPasswordPh')}
                value={deletePwd}
                autoFocus
                onChange={e => { setDeletePwd(e.target.value); setDeleteError(''); }}
                onKeyDown={e => e.key === 'Enter' && confirmDelete()}
              />
              {deleteError && (
                <div className="del-confirm-error">{deleteError}</div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <div />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-nav" onClick={cancelDelete}>{t('deleteModalCancel')}</button>
              <button className="btn-delete-confirm" onClick={confirmDelete}>{t('deleteModalConfirm')}</button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

import { useState, useEffect } from 'react';
import {
  getTreatmentPlanByPatient,
  createTreatmentPlanItem,
  updateTreatmentPlanItem,
  deleteTreatmentPlanItem,
} from '../utils/storage';
import { useLang } from '../context/LangContext';
import IcdSearchInput from './IcdSearchInput';

// Services per specialty
const SERVICES_BY_SPECIALTY = {
  therapy:   ['Лечение кариеса', 'Лечение пульпита', 'Лечение периодонтита', 'Пломбирование', 'Эндодонтия', 'Реставрация'],
  surgery:   ['Удаление зуба', 'Сложное удаление', 'Вскрытие абсцесса', 'Резекция верхушки', 'Хирургическое лечение'],
  ortho:     ['Коронка металлокерамика', 'Коронка цирконий', 'Мост', 'Съёмный протез', 'Имплант + коронка'],
  pediatric: ['Лечение молочного зуба', 'Серебрение', 'Герметизация фиссур', 'Удаление молочного зуба'],
  periodont: ['Профессиональная чистка', 'Кюретаж кармана', 'Лечение гингивита', 'Лечение пародонтита'],
  other:     ['Консультация', 'Профилактика', 'Другое'],
};

const STATUS_COLORS = {
  '':   '#ffffff', 'C': '#ff6b6b', 'P': '#74b9ff',
  'Cr': '#a29bfe', 'Pt': '#fd79a8', 'R': '#55efc4',
  'E':  '#b2bec3', 'I': '#fdcb6e',
};

function emptyItem() {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    tooth: '',
    icdCode: '',
    icdDesc: '',
    specialty: 'therapy',
    services: [],
    customService: '',
    priority: 'planned',
    estimatedCost: '',
    comment: '',
    status: 'active', // active | done
    planId: Date.now().toString() + Math.random().toString(36).slice(2),
  };
}

export default function TreatmentPlan({ patient, onPatientUpdated, onCreateVisitFromPlan }) {
  const { t, lang } = useLang();
  const [adding, setAdding] = useState(false);
  const [item, setItem] = useState(emptyItem);
  const [toothPickerOpen, setToothPickerOpen] = useState(false);
  const [plan, setPlan] = useState(patient.longTermPlan || []);
  const [loadingPlan, setLoadingPlan] = useState(true);

  const odontogram = patient.odontogram || {};

  function mapPlanRow(row) {
    return {
      ...row,
      icdCode: row.icd_code || row.icdCode || '',
      icdDesc: row.icd_desc || row.icdDesc || '',
      planId: row.plan_id || row.planId || '',
      estimatedCost: row.estimated_cost ?? row.estimatedCost ?? '',
    };
  }

  // Load treatment plan from Supabase on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingPlan(true);
    getTreatmentPlanByPatient(patient.id).then(data => {
      if (cancelled) return;
      setPlan((data || []).map(mapPlanRow));
      setLoadingPlan(false);
    });
    return () => { cancelled = true; };
  }, [patient.id]);

  function si(k, v) { setItem(f => ({ ...f, [k]: v })); }

  const PRIORITIES = [
    ['urgent',  t('priorityUrgent')],
    ['planned', t('priorityPlanned')],
  ];

  const SPECIALTIES = [
    ['therapy',   t('specTherapy')],
    ['surgery',   t('specSurgery')],
    ['ortho',     t('specOrtho')],
    ['pediatric', t('specPediatric')],
    ['periodont', t('specPeriodont')],
    ['other',     t('specOther')],
  ];

  function toggleService(svc) {
    setItem(f => {
      const has = f.services.includes(svc);
      return { ...f, services: has ? f.services.filter(s => s !== svc) : [...f.services, svc] };
    });
  }

  function handleSpecialtyChange(spec) {
    setItem(f => ({ ...f, specialty: spec, services: [] }));
  }

  function handleToothSelect(num) {
    si('tooth', String(num));
    setToothPickerOpen(false);
  }

  function handleIcdChange({ icdCode, descriptionRu, descriptionTj }) {
    setItem(f => ({
      ...f,
      icdCode,
      icdDesc: lang === 'tj' ? (descriptionTj || descriptionRu) : (descriptionRu || descriptionTj),
    }));
  }

  async function savePlanItem() {
    const allServices = [...item.services];
    if (item.customService.trim()) allServices.push(item.customService.trim());
    const itemData = {
      patient_id: patient.id,
      tooth: item.tooth,
      icd_code: item.icdCode,
      icd_desc: item.icdDesc,
      specialty: item.specialty,
      services: allServices,
      priority: item.priority,
      estimated_cost: item.estimatedCost ? parseFloat(item.estimatedCost) : null,
      comment: item.comment,
      status: 'active',
      plan_id: item.planId,
      created_at: new Date().toISOString(),
    };
    const saved = await createTreatmentPlanItem(itemData);
    const newItem = mapPlanRow(saved || { ...itemData, id: Date.now().toString() });
    setPlan(prev => [...prev, newItem]);
    onPatientUpdated({ ...patient, longTermPlan: [...plan, newItem] });
    setAdding(false);
    setItem(emptyItem());
  }

  async function removePlanItem(id) {
    await deleteTreatmentPlanItem(id);
    const updatedPlan = plan.filter(x => x.id !== id);
    setPlan(updatedPlan);
    onPatientUpdated({ ...patient, longTermPlan: updatedPlan });
  }

  async function markDone(id) {
    const target = plan.find(x => x.id === id);
    if (!target) return;
    const newStatus = target.status === 'done' ? 'active' : 'done';
    await updateTreatmentPlanItem(id, { status: newStatus });
    const updatedPlan = plan.map(x => x.id === id ? { ...x, status: newStatus } : x);
    setPlan(updatedPlan);
    onPatientUpdated({ ...patient, longTermPlan: updatedPlan });
  }

  function createVisitFromPlan(planItem) {
    if (onCreateVisitFromPlan) {
      onCreateVisitFromPlan(planItem);
    }
  }

  const toothStatus = item.tooth ? odontogram[item.tooth] : null;
  const currentServices = SERVICES_BY_SPECIALTY[item.specialty] || [];

  return (
    <div className="card-section">
      <div className="card-section-label">{t('treatPlanTitle')}</div>

      {loadingPlan && (
        <div className="visit-empty">{t('loading') || 'Загрузка...'}</div>
      )}
      {!loadingPlan && plan.length === 0 && !adding && (
        <div className="visit-empty">{t('treatPlanEmpty')}</div>
      )}

      {plan.length > 0 && (
        <div className="plan-table-wrap" style={{ marginBottom: '0.75rem' }}>
          <table className="treatment-table plan-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}>№</th>
                <th style={{ width: 60 }}>{t('planTooth')}</th>
                <th>{t('planDiagnosis')}</th>
                <th>{t('planSpecialty')}</th>
                <th>{t('planServices')}</th>
                <th style={{ width: 90 }}>{t('planEstCost')}</th>
                <th style={{ width: 80 }}>{t('planPriority')}</th>
                <th style={{ width: 80 }}>{t('planStatus')}</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {plan.map((x, i) => {
                const specLabel = SPECIALTIES.find(s => s[0] === x.specialty)?.[1] || x.specialty || '';
                const isDone = x.status === 'done';
                return (
                  <tr key={x.id || i} className={
                    isDone ? 'treat-plan-done' :
                    x.priority === 'urgent' ? 'treat-plan-urgent' : ''
                  }>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{i + 1}</td>
                    <td>
                      <span className="plan-tooth-badge">{x.tooth || '—'}</span>
                    </td>
                    <td>
                      <div className="plan-diag-cell">
                        {x.icdCode && <span className="plan-icd-badge">{x.icdCode}</span>}
                        {x.icdDesc && <span className="plan-icd-desc">{x.icdDesc}</span>}
                        {!x.icdCode && !x.icdDesc && '—'}
                      </div>
                    </td>
                    <td><span className="plan-spec-label">{specLabel}</span></td>
                    <td>
                      <div className="plan-services-cell">
                        {(x.services || []).length > 0
                          ? (x.services || []).map((s, si2) => (
                              <span key={si2} className="plan-service-tag">{s}</span>
                            ))
                          : <span className="text-muted">—</span>
                        }
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {x.estimatedCost ? `${Number(x.estimatedCost).toLocaleString('ru-RU')} ${t('currency')}` : '—'}
                    </td>
                    <td>
                      <span className={`priority-badge priority-badge--${x.priority}`}>
                        {PRIORITIES.find(p => p[0] === x.priority)?.[1] || x.priority}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`plan-status-btn${isDone ? ' plan-status-btn--done' : ''}`}
                        onClick={() => markDone(x.id)}
                        title={isDone ? t('planMarkActive') : t('planMarkDone')}
                      >
                        {isDone ? t('planDone') : t('planActive')}
                      </button>
                    </td>
                    <td>
                      <div className="plan-row-actions">
                        {!isDone && (
                          <button
                            className="plan-create-visit-btn"
                            onClick={() => createVisitFromPlan(x)}
                            title={t('createVisitFromPlan')}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2"/>
                              <line x1="16" y1="2" x2="16" y2="6"/>
                              <line x1="8" y1="2" x2="8" y2="6"/>
                              <line x1="3" y1="10" x2="21" y2="10"/>
                              <line x1="12" y1="14" x2="12" y2="18"/>
                              <line x1="10" y1="16" x2="14" y2="16"/>
                            </svg>
                          </button>
                        )}
                        <button className="row-del" onClick={() => removePlanItem(x.id)} title={t('removePlanItem')}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <div className="visit-form plan-form" style={{ marginBottom: '0.75rem' }}>
          <div className="plan-form-grid">

            {/* Tooth selection */}
            <div className="plan-form-row">
              <div className="form-group" style={{ flex: '0 0 140px' }}>
                <label>{t('planTooth')}</label>
                <div className="plan-tooth-input-wrap">
                  <input
                    type="text"
                    placeholder="16"
                    value={item.tooth}
                    onChange={e => si('tooth', e.target.value)}
                    style={{ width: '80px' }}
                  />
                  <button
                    type="button"
                    className="plan-tooth-picker-btn"
                    onClick={() => setToothPickerOpen(o => !o)}
                    title={t('planPickTooth')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2C6 2 4 6 4 9c0 2.5 1 4 2 5 .5.5.5 2 .5 4 0 1.1.9 2 2 2h7c1.1 0 2-.9 2-2 0-2 0-3.5.5-4 1-1 2-2.5 2-5 0-3-2-7-8-7z"/>
                    </svg>
                  </button>
                </div>
                {/* Tooth odontogram status indicator */}
                {item.tooth && toothStatus && (
                  <div className="plan-tooth-status-hint">
                    <span className="odonto-legend-dot" style={{ background: STATUS_COLORS[toothStatus] || '#eee', display: 'inline-block', width: 10, height: 10, borderRadius: '50%', marginRight: 4 }}></span>
                    {toothStatus}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ flex: '0 0 150px' }}>
                <label>{t('planPriority')}</label>
                <select value={item.priority} onChange={e => si('priority', e.target.value)}>
                  {PRIORITIES.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ flex: '0 0 170px' }}>
                <label>{t('planEstCost')}</label>
                <input
                  type="number"
                  placeholder="0"
                  value={item.estimatedCost}
                  onChange={e => si('estimatedCost', e.target.value)}
                />
              </div>
            </div>

            {/* Tooth mini-picker */}
            {toothPickerOpen && (
              <div className="plan-tooth-picker">
                <div className="plan-tooth-picker-label">{t('planPickToothUpper')}</div>
                <div className="plan-tooth-picker-row">
                  {[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28].map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`plan-tooth-mini${item.tooth === String(n) ? ' plan-tooth-mini--active' : ''}${odontogram[n] ? ' plan-tooth-mini--marked' : ''}`}
                      style={odontogram[n] ? { background: STATUS_COLORS[odontogram[n]] || '#eee' } : {}}
                      onClick={() => handleToothSelect(n)}
                      title={odontogram[n] ? `${n}: ${odontogram[n]}` : String(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="plan-tooth-picker-label" style={{ marginTop: '0.4rem' }}>{t('planPickToothLower')}</div>
                <div className="plan-tooth-picker-row">
                  {[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38].map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`plan-tooth-mini${item.tooth === String(n) ? ' plan-tooth-mini--active' : ''}${odontogram[n] ? ' plan-tooth-mini--marked' : ''}`}
                      style={odontogram[n] ? { background: STATUS_COLORS[odontogram[n]] || '#eee' } : {}}
                      onClick={() => handleToothSelect(n)}
                      title={odontogram[n] ? `${n}: ${odontogram[n]}` : String(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ICD-10 search */}
            <div className="form-group">
              <label>{t('planDiagnosis')} (МКБ-10)</label>
              <IcdSearchInput
                value={item.icdCode}
                lang={lang}
                onChange={handleIcdChange}
                placeholder={t('diagCodePh')}
              />
              {item.icdDesc && (
                <div className="plan-icd-hint">{item.icdDesc}</div>
              )}
            </div>

            {/* Specialty */}
            <div className="form-group">
              <label>{t('planSpecialty')}</label>
              <select value={item.specialty} onChange={e => handleSpecialtyChange(e.target.value)}>
                {SPECIALTIES.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
              </select>
            </div>

            {/* Services for selected specialty */}
            <div className="form-group">
              <label>{t('planServices')}</label>
              <div className="plan-service-checkboxes">
                {currentServices.map(svc => (
                  <label key={svc} className="plan-service-check-label">
                    <input
                      type="checkbox"
                      checked={item.services.includes(svc)}
                      onChange={() => toggleService(svc)}
                    />
                    <span>{svc}</span>
                  </label>
                ))}
              </div>
              <input
                type="text"
                placeholder={t('planCustomService')}
                value={item.customService}
                onChange={e => si('customService', e.target.value)}
                style={{ marginTop: '0.4rem' }}
              />
            </div>

            {/* Comment */}
            <div className="form-group">
              <label>{t('planComment')}</label>
              <textarea rows={2} value={item.comment} onChange={e => si('comment', e.target.value)} />
            </div>
          </div>

          <div className="visit-form-actions">
            <button className="btn-nav" onClick={() => { setAdding(false); setItem(emptyItem()); setToothPickerOpen(false); }}>
              {t('visitCancel')}
            </button>
            <button className="btn-save" onClick={savePlanItem}>{t('savePlanItem')}</button>
          </div>
        </div>
      )}

      {!adding && (
        <button className="btn-add-row" onClick={() => { setAdding(true); setToothPickerOpen(false); }}>
          {t('addPlanItem')}
        </button>
      )}
    </div>
  );
}

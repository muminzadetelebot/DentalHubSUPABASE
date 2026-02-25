import { useState, useEffect } from 'react';
import { getVisitsByPatient, createVisit } from '../utils/storage';
import { useLang } from '../context/LangContext';
import VisitFilesBlock from './VisitFilesBlock';

function fmt(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('ru-RU'); } catch { return iso; }
}

function calcManipTotal(v) {
  return (v.manipulations || []).reduce((s, m) => s + (parseFloat(m.price) || 0), 0);
}

function calcMaterialTotal(v) {
  return (v.materials || []).reduce((s, m) => s + (parseFloat(m.price) || 0) * (parseFloat(m.qty) || 1), 0);
}

function calcVisitTotal(v) {
  return calcManipTotal(v) + calcMaterialTotal(v);
}

function calcBalance(v) {
  const total = calcVisitTotal(v);
  const paid = parseFloat(v.paid) || 0;
  return Math.max(0, total - paid);
}

function emptyVisit(prefill) {
  return {
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    doctor: '',
    specialty: prefill?.specialty || 'therapy',
    complaints: '',
    anesType: '',
    anesDrug: '',
    anesDose: '',
    anesReaction: '',
    manipulations: prefill
      ? (prefill.services || []).map((s, i) => ({
          id: Date.now().toString() + i,
          tooth: prefill.tooth || '',
          service: s,
          action: '',
          comment: prefill.comment || '',
          price: '',
        }))
      : [],
    materials: [],
    result: 'completed',
    paid: '',
    paymentForm: 'cash',
    patientSignature: '',
    doctorSignature: '',
    planId: prefill?.planId || '',
  };
}

function emptyManip() {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    tooth: '',
    service: '',
    action: '',
    comment: '',
    price: '',
  };
}

function emptyMaterial() {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    name: '',
    qty: '1',
    price: '',
  };
}

export default function VisitLog({ patient, onPatientUpdated, session, prefillFromPlan, onPrefillConsumed }) {
  const { t } = useLang();
  const [adding, setAdding] = useState(false);
  const [visit, setVisit] = useState(() => emptyVisit(null));
  const [openIdx, setOpenIdx] = useState(null);
  const [visits, setVisits] = useState(patient.visits || []);
  const [loadingVisits, setLoadingVisits] = useState(true);

  // Load visits from Supabase on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingVisits(true);
    getVisitsByPatient(patient.id).then(data => {
      if (cancelled) return;
      setVisits(data);
      setLoadingVisits(false);
    });
    return () => { cancelled = true; };
  }, [patient.id]);

  // When prefillFromPlan arrives, open the form with prefilled data
  useEffect(() => {
    if (prefillFromPlan) {
      setVisit(emptyVisit(prefillFromPlan));
      setAdding(true);
      if (onPrefillConsumed) onPrefillConsumed();
    }
  }, [prefillFromPlan]);

  function sv(k, v) { setVisit(f => ({ ...f, [k]: v })); }

  // Manipulations
  function addManip() {
    setVisit(f => ({ ...f, manipulations: [...f.manipulations, emptyManip()] }));
  }
  function updateManip(idx, key, val) {
    setVisit(f => ({
      ...f,
      manipulations: f.manipulations.map((m, i) => i === idx ? { ...m, [key]: val } : m),
    }));
  }
  function removeManip(idx) {
    setVisit(f => ({ ...f, manipulations: f.manipulations.filter((_, i) => i !== idx) }));
  }

  // Materials
  function addMaterial() {
    setVisit(f => ({ ...f, materials: [...(f.materials || []), emptyMaterial()] }));
  }
  function updateMaterial(idx, key, val) {
    setVisit(f => ({
      ...f,
      materials: (f.materials || []).map((m, i) => i === idx ? { ...m, [key]: val } : m),
    }));
  }
  function removeMaterial(idx) {
    setVisit(f => ({ ...f, materials: (f.materials || []).filter((_, i) => i !== idx) }));
  }

  async function saveVisit() {
    const visitData = {
      ...visit,
      patient_id: patient.id,
      created_at: new Date().toISOString(),
    };
    const saved = await createVisit(visitData);
    const newVisit = saved || { ...visitData, id: Date.now().toString() };
    setVisits(prev => [newVisit, ...prev]);
    onPatientUpdated({ ...patient, visits: [newVisit, ...visits] });
    setAdding(false);
    setVisit(emptyVisit(null));
  }

  const SPECIALTIES = [
    ['therapy',   t('specTherapy')],
    ['surgery',   t('specSurgery')],
    ['ortho',     t('specOrtho')],
    ['pediatric', t('specPediatric')],
    ['periodont', t('specPeriodont')],
    ['other',     t('specOther')],
  ];

  const RESULTS = [
    ['completed', t('resultCompleted')],
    ['stage',     t('resultStage')],
    ['referral',  t('resultReferral')],
  ];

  const PAYMENT_FORMS = [
    ['cash',     t('payMethodCash')],
    ['terminal', t('payMethodTerminal')],
    ['transfer', t('payMethodTransfer')],
  ];

  const manipTotal = calcManipTotal(visit);
  const matTotal = calcMaterialTotal(visit);
  const total = manipTotal + matTotal;

  return (
    <div className="card-section">
      <div className="card-section-label">{t('tabVisits')}</div>

      {/* Visit history */}
      {loadingVisits && (
        <div className="visit-empty">{t('loading') || 'Загрузка...'}</div>
      )}
      {!loadingVisits && visits.length === 0 && !adding && (
        <div className="visit-empty">{t('visitEmpty')}</div>
      )}

      {visits.map((v, idx) => {
        const vTotal = calcVisitTotal(v);
        const vManipTotal = calcManipTotal(v);
        const vMatTotal = calcMaterialTotal(v);
        const specLabel = SPECIALTIES.find(s => s[0] === v.specialty)?.[1] || v.specialty || '';
        return (
          <div key={v.id || idx} className="visit-item">
            <div className="visit-item-header" onClick={() => setOpenIdx(openIdx === idx ? null : idx)}>
              <div className="visit-item-meta">
                <span className="visit-date">{fmt(v.date)}{v.time ? ` ${v.time}` : ''}</span>
                {specLabel && <span className="visit-spec">{specLabel}</span>}
                {v.doctor && <span className="visit-doctor">{t('visitDoctor')}: {v.doctor}</span>}
                {(v.manipulations || []).length > 0 && (
                  <span className="visit-manip-count">
                    {(v.manipulations || []).length} {t('visitManipulations').toLowerCase()}
                  </span>
                )}
                {v.planId && (
                  <span className="visit-plan-link" title="По плану лечения">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </span>
                )}
              </div>
              <div className="visit-item-right">
                {vTotal > 0 && <span className="visit-total">{vTotal.toLocaleString('ru-RU')} {t('currency')}</span>}
                <span className="visit-chevron">{openIdx === idx ? '▲' : '▼'}</span>
              </div>
            </div>

            {openIdx === idx && (
              <div className="visit-detail">
                {v.complaints && (
                  <div className="vd-row"><strong>{t('visitComplaints')}:</strong> {v.complaints}</div>
                )}

                {(v.manipulations || []).length > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <strong style={{ fontSize: '0.82rem' }}>{t('visitManipulations')}:</strong>
                    <table className="treatment-table" style={{ marginTop: '0.3rem' }}>
                      <thead>
                        <tr>
                          <th style={{ width: 60 }}>{t('manipTooth')}</th>
                          <th>{t('manipService')}</th>
                          <th>{t('manipAction')}</th>
                          <th>{t('manipComment')}</th>
                          <th style={{ width: 90 }}>{t('manipPrice')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.manipulations.map((m, mi) => (
                          <tr key={m.id || mi}>
                            <td>{m.tooth || '—'}</td>
                            <td>{m.service || '—'}</td>
                            <td>{m.action || '—'}</td>
                            <td>{m.comment || '—'}</td>
                            <td>{m.price ? `${Number(m.price).toLocaleString('ru-RU')} ${t('currency')}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {(v.materials || []).length > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <strong style={{ fontSize: '0.82rem' }}>{t('visitMaterials')}:</strong>
                    <table className="treatment-table" style={{ marginTop: '0.3rem' }}>
                      <thead>
                        <tr>
                          <th>{t('materialName')}</th>
                          <th style={{ width: 60 }}>{t('materialQty')}</th>
                          <th style={{ width: 90 }}>{t('materialPrice')}</th>
                          <th style={{ width: 90 }}>{t('materialSubtotal')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.materials.map((m, mi) => {
                          const sub = (parseFloat(m.price) || 0) * (parseFloat(m.qty) || 1);
                          return (
                            <tr key={m.id || mi}>
                              <td>{m.name || '—'}</td>
                              <td style={{ textAlign: 'center' }}>{m.qty || 1}</td>
                              <td>{m.price ? `${Number(m.price).toLocaleString('ru-RU')}` : '—'}</td>
                              <td>{sub > 0 ? `${sub.toLocaleString('ru-RU')} ${t('currency')}` : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {(v.anesType || v.anesDrug) && (
                  <div className="vd-row">
                    <strong>{t('visitAnesType')}:</strong> {v.anesType} {v.anesDrug && `— ${v.anesDrug}`}
                    {v.anesDose && ` ${v.anesDose} ${t('printAnesMl')}`}
                    {v.anesReaction && ` | ${v.anesReaction}`}
                  </div>
                )}

                {vTotal > 0 && (
                  <div className="visit-finance">
                    {vManipTotal > 0 && (
                      <span>{t('visitServiceCost')}: {vManipTotal.toLocaleString('ru-RU')} {t('currency')}</span>
                    )}
                    {vMatTotal > 0 && (
                      <span>{t('visitMaterialCost')}: {vMatTotal.toLocaleString('ru-RU')} {t('currency')}</span>
                    )}
                    <strong>{t('visitTotalLabel')}: {vTotal.toLocaleString('ru-RU')} {t('currency')}</strong>
                    {v.paid && <span>{t('visitPayment')}: {Number(v.paid).toLocaleString('ru-RU')} {t('currency')}</span>}
                    {calcBalance(v) > 0 && (
                      <span style={{ color: 'var(--danger)' }}>
                        {t('financialBalance')}: {calcBalance(v).toLocaleString('ru-RU')} {t('currency')}
                      </span>
                    )}
                    {v.paymentForm && <span>{PAYMENT_FORMS.find(p => p[0] === v.paymentForm)?.[1] || ''}</span>}
                  </div>
                )}

                <div style={{ marginTop: '0.75rem' }}>
                  <VisitFilesBlock patientId={patient.id} visitId={v.id} session={session} />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add visit form */}
      {adding && (
        <div className="visit-form">
          <div className="visit-form-title">
            {t('addVisitBtn')}
            {visit.planId && (
              <span className="visit-from-plan-badge">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                {t('visitFromPlan')}
              </span>
            )}
          </div>

          {/* General info */}
          <div className="form-grid-2">
            <div className="form-group">
              <label>{t('visitDate')}</label>
              <input type="date" value={visit.date} onChange={e => sv('date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('visitTime')}</label>
              <input type="time" value={visit.time} onChange={e => sv('time', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('visitDoctor')}</label>
              <input type="text" value={visit.doctor} onChange={e => sv('doctor', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('visitSpecialty')}</label>
              <select value={visit.specialty} onChange={e => sv('specialty', e.target.value)}>
                {SPECIALTIES.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
              </select>
            </div>
            <div className="form-group span-2">
              <label>{t('visitComplaints')}</label>
              <textarea rows={2} value={visit.complaints} onChange={e => sv('complaints', e.target.value)} />
            </div>
          </div>

          {/* Manipulations */}
          <div style={{ marginTop: '1rem' }}>
            <div className="sub-label">{t('visitManipulations')}</div>
            <div className="treatment-table-wrap">
              <table className="treatment-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>№</th>
                    <th style={{ width: 80 }}>{t('manipTooth')}</th>
                    <th>{t('manipService')}</th>
                    <th>{t('manipAction')}</th>
                    <th>{t('manipComment')}</th>
                    <th style={{ width: 110 }}>{t('manipPrice')}</th>
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {visit.manipulations.length === 0 && (
                    <tr><td colSpan={7} className="table-empty">{t('noManipulations')}</td></tr>
                  )}
                  {visit.manipulations.map((m, i) => (
                    <tr key={m.id || i}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{i + 1}</td>
                      <td>
                        <input type="text" placeholder="16" value={m.tooth}
                          onChange={e => updateManip(i, 'tooth', e.target.value)} />
                      </td>
                      <td>
                        <input type="text" value={m.service}
                          onChange={e => updateManip(i, 'service', e.target.value)} />
                      </td>
                      <td>
                        <input type="text" value={m.action}
                          onChange={e => updateManip(i, 'action', e.target.value)} />
                      </td>
                      <td>
                        <input type="text" value={m.comment}
                          onChange={e => updateManip(i, 'comment', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" placeholder="0" value={m.price}
                          onChange={e => updateManip(i, 'price', e.target.value)} />
                      </td>
                      <td>
                        <button className="row-del" onClick={() => removeManip(i)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.4rem' }}>
              <button className="btn-add-row" onClick={addManip}>{t('addManipulation')}</button>
              {manipTotal > 0 && (
                <span className="visit-total-inline">
                  {t('visitServiceCost')}: <strong>{manipTotal.toLocaleString('ru-RU')} {t('currency')}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Materials */}
          <div style={{ marginTop: '1rem' }}>
            <div className="sub-label">{t('visitMaterials')}</div>
            <div className="treatment-table-wrap">
              <table className="treatment-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>№</th>
                    <th>{t('materialName')}</th>
                    <th style={{ width: 80 }}>{t('materialQty')}</th>
                    <th style={{ width: 110 }}>{t('materialPrice')}</th>
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(visit.materials || []).length === 0 && (
                    <tr><td colSpan={5} className="table-empty">{t('noMaterials')}</td></tr>
                  )}
                  {(visit.materials || []).map((m, i) => (
                    <tr key={m.id || i}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{i + 1}</td>
                      <td>
                        <input type="text" placeholder={t('materialNamePh')} value={m.name}
                          onChange={e => updateMaterial(i, 'name', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" min="1" placeholder="1" value={m.qty}
                          onChange={e => updateMaterial(i, 'qty', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" placeholder="0" value={m.price}
                          onChange={e => updateMaterial(i, 'price', e.target.value)} />
                      </td>
                      <td>
                        <button className="row-del" onClick={() => removeMaterial(i)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.4rem' }}>
              <button className="btn-add-row" onClick={addMaterial}>{t('addMaterial')}</button>
              {matTotal > 0 && (
                <span className="visit-total-inline">
                  {t('visitMaterialCost')}: <strong>{matTotal.toLocaleString('ru-RU')} {t('currency')}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Cost summary */}
          {total > 0 && (
            <div className="visit-cost-summary">
              {manipTotal > 0 && (
                <div className="visit-cost-row">
                  <span>{t('visitServiceCost')}</span>
                  <span>{manipTotal.toLocaleString('ru-RU')} {t('currency')}</span>
                </div>
              )}
              {matTotal > 0 && (
                <div className="visit-cost-row">
                  <span>{t('visitMaterialCost')}</span>
                  <span>{matTotal.toLocaleString('ru-RU')} {t('currency')}</span>
                </div>
              )}
              <div className="visit-cost-row visit-cost-row--total">
                <strong>{t('visitTotalLabel')}</strong>
                <strong>{total.toLocaleString('ru-RU')} {t('currency')}</strong>
              </div>
            </div>
          )}

          {/* Anesthesia */}
          <div className="form-grid-2" style={{ marginTop: '0.75rem' }}>
            <div className="form-group">
              <label>{t('visitAnesType')}</label>
              <input type="text" value={visit.anesType} onChange={e => sv('anesType', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('visitAnesDrug')}</label>
              <input type="text" value={visit.anesDrug} onChange={e => sv('anesDrug', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('visitAnesDose')}</label>
              <input type="number" step="0.1" value={visit.anesDose} onChange={e => sv('anesDose', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('visitAnesReaction')}</label>
              <input type="text" value={visit.anesReaction} onChange={e => sv('anesReaction', e.target.value)} />
            </div>
          </div>

          {/* Payment & result */}
          <div className="form-grid-2" style={{ marginTop: '0.75rem' }}>
            <div className="form-group">
              <label>{t('visitResult')}</label>
              <select value={visit.result} onChange={e => sv('result', e.target.value)}>
                {RESULTS.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>{t('visitPayMethod')}</label>
              <select value={visit.paymentForm} onChange={e => sv('paymentForm', e.target.value)}>
                {PAYMENT_FORMS.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>{t('visitPayment')}</label>
              <input type="number" placeholder="0" value={visit.paid} onChange={e => sv('paid', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('visitTotalLabel')}</label>
              <div className="balance-value" style={{ fontSize: '1.1rem', paddingTop: '0.4rem' }}>
                {total.toLocaleString('ru-RU')} {t('currency')}
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="form-grid-2" style={{ marginTop: '0.75rem' }}>
            <div className="form-group">
              <label>{t('visitPatSig')}</label>
              <input type="text" value={visit.patientSignature} onChange={e => sv('patientSignature', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('visitDocSig')}</label>
              <input type="text" value={visit.doctorSignature} onChange={e => sv('doctorSignature', e.target.value)} />
            </div>
          </div>

          <div className="visit-form-actions">
            <button className="btn-nav" onClick={() => { setAdding(false); setVisit(emptyVisit(null)); }}>
              {t('visitCancel')}
            </button>
            <button className="btn-save" onClick={saveVisit}>{t('visitSave')}</button>
          </div>
        </div>
      )}

      {!adding && (
        <button className="btn-add-row" style={{ marginTop: '0.5rem' }} onClick={() => setAdding(true)}>
          + {t('addVisitBtn')}
        </button>
      )}
    </div>
  );
}

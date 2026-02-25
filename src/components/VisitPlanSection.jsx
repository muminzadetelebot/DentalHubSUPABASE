import { useState } from 'react';
import { useLang } from '../context/LangContext';
import IcdSearchInput from './IcdSearchInput';
import VisitFilesBlock from './VisitFilesBlock';

// ── Factories ────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const EMPTY_TOOTH_DIAG = () => ({
  id: uid(),
  icdCode: '',
  descriptionRu: '',
  descriptionTj: '',
  comment: '',
  isMain: false,
});

const EMPTY_PROCEDURE = () => ({
  id: uid(),
  name: '',
  price: '',
});

const EMPTY_MATERIAL = () => ({
  id: uid(),
  name: '',
  qty: '',
  price: '',
});

const EMPTY_TOOTH_ENTRY = () => ({
  id: uid(),
  toothNumber: '',
  collapsed: false,
  diagnoses: [],       // [{id, icdCode, descriptionRu, descriptionTj, comment, isMain}]
  procedures: [],      // [{id, name, price}]
  materials: [],       // [{id, name, qty, price}]
});

const EMPTY_VISIT = () => ({
  id: uid(),
  date: '',
  doctor: '',
  specialty: '',
  toothEntries: [],   // new per-tooth structure
  paid: '',
  payMethod: 'cash',
  payComment: '',
  // legacy fields kept for backward-compat read
  teeth: [],
  diagnoses: [],
  procedures: {},
  materials: [],
  costProc: '',
  costMat: '',
});

// ── Calculators ───────────────────────────────────────────────────
function calcToothTotal(tooth) {
  const procCost = (tooth.procedures || []).reduce((s, p) => s + (parseFloat(p.price) || 0), 0);
  const matCost  = (tooth.materials  || []).reduce((s, m) => s + ((parseFloat(m.qty) || 0) * (parseFloat(m.price) || 0)), 0);
  return procCost + matCost;
}

function calcVisitGrand(v) {
  return (v.toothEntries || []).reduce((s, t) => s + calcToothTotal(t), 0);
}

function calcBalance(v) {
  return Math.max(0, calcVisitGrand(v) - (parseFloat(v.paid) || 0));
}

// ── Tooth ICD row ─────────────────────────────────────────────────
function DiagRow({ diag, lang, t, onChange, onRemove }) {
  const desc = lang === 'tj' ? diag.descriptionTj : diag.descriptionRu;
  return (
    <div className="ct-diag-row">
      <label className="ct-diag-main-chk" title={t('toothDiagMain')}>
        <input type="checkbox" checked={diag.isMain}
          onChange={e => onChange({ isMain: e.target.checked })} />
        <span className="ct-main-label">{t('toothDiagMain')}</span>
      </label>
      <div className="ct-diag-fields">
        <div className="ct-diag-code-wrap">
          <IcdSearchInput
            value={diag.icdCode}
            lang={lang}
            placeholder={t('diagCodePh')}
            onChange={patch => onChange(patch)}
          />
        </div>
        <div className="ct-diag-desc">
          {desc
            ? <span className="icd-desc-text">{desc}</span>
            : <span className="icd-desc-placeholder">{t('diagDesc')}</span>}
        </div>
        <input
          type="text"
          className="ct-diag-comment"
          placeholder={t('diagCommentPh')}
          value={diag.comment}
          onChange={e => onChange({ comment: e.target.value })}
        />
      </div>
      <button className="ct-icon-del" onClick={onRemove} title={t('removeDiag')}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

// ── Single tooth card ─────────────────────────────────────────────
function ToothCard({ tooth, toothIdx, visitIdx, lang, t, currency, onUpdate, onRemove }) {
  const total = calcToothTotal(tooth);

  function patchTooth(patch) {
    onUpdate({ ...tooth, ...patch });
  }

  // diagnoses
  function addDiag() {
    patchTooth({ diagnoses: [...(tooth.diagnoses || []), EMPTY_TOOTH_DIAG()] });
  }
  function updateDiag(dIdx, patch) {
    const diagnoses = (tooth.diagnoses || []).map((d, i) => i === dIdx ? { ...d, ...patch } : d);
    patchTooth({ diagnoses });
  }
  function removeDiag(dIdx) {
    patchTooth({ diagnoses: (tooth.diagnoses || []).filter((_, i) => i !== dIdx) });
  }

  // procedures
  function addProc() {
    patchTooth({ procedures: [...(tooth.procedures || []), EMPTY_PROCEDURE()] });
  }
  function updateProc(pIdx, key, val) {
    const procedures = (tooth.procedures || []).map((p, i) => i === pIdx ? { ...p, [key]: val } : p);
    patchTooth({ procedures });
  }
  function removeProc(pIdx) {
    patchTooth({ procedures: (tooth.procedures || []).filter((_, i) => i !== pIdx) });
  }

  // materials
  function addMat() {
    patchTooth({ materials: [...(tooth.materials || []), EMPTY_MATERIAL()] });
  }
  function updateMat(mIdx, key, val) {
    const materials = (tooth.materials || []).map((m, i) => i === mIdx ? { ...m, [key]: val } : m);
    patchTooth({ materials });
  }
  function removeMat(mIdx) {
    patchTooth({ materials: (tooth.materials || []).filter((_, i) => i !== mIdx) });
  }

  const collapsed = tooth.collapsed;

  return (
    <div className={`ct-tooth-card${collapsed ? ' ct-tooth-card--collapsed' : ''}`}>
      {/* ── Header ── */}
      <div className="ct-tooth-header">
        <div className="ct-tooth-header-left">
          <span className="ct-tooth-icon">🦷</span>
          <span className="ct-tooth-label">{t('toothLabel')}</span>
          <input
            type="text"
            className="ct-tooth-num-input"
            placeholder={t('toothNumPh')}
            value={tooth.toothNumber}
            onChange={e => patchTooth({ toothNumber: e.target.value })}
            maxLength={2}
          />
          {tooth.toothNumber && (
            <span className="ct-tooth-num-badge">{tooth.toothNumber}</span>
          )}
        </div>
        <div className="ct-tooth-header-right">
          {total > 0 && (
            <span className="ct-tooth-cost">{total.toLocaleString('ru-RU')} {currency}</span>
          )}
          <button className="ct-collapse-btn"
            onClick={() => patchTooth({ collapsed: !collapsed })}
            title={collapsed ? t('expand') : t('collapse')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {collapsed
                ? <polyline points="6 9 12 15 18 9"/>
                : <polyline points="18 15 12 9 6 15"/>}
            </svg>
          </button>
          <button className="ct-remove-tooth-btn" onClick={onRemove} title={t('removeTooth')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="ct-tooth-body">
          {/* ── Diagnoses ── */}
          <div className="ct-section">
            <div className="ct-section-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              {t('diagnosisSection')}
            </div>
            {(tooth.diagnoses || []).length === 0 && (
              <div className="ct-empty-hint">{t('noDiagnoses')}</div>
            )}
            {(tooth.diagnoses || []).map((diag, dIdx) => (
              <DiagRow key={diag.id} diag={diag} lang={lang} t={t}
                onChange={patch => updateDiag(dIdx, patch)}
                onRemove={() => removeDiag(dIdx)}
              />
            ))}
            <button className="ct-add-btn" onClick={addDiag}>{t('addDiagnosis')}</button>
          </div>

          {/* ── Procedures ── */}
          <div className="ct-section">
            <div className="ct-section-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              {t('proceduresSection')}
            </div>
            {(tooth.procedures || []).length > 0 && (
              <div className="ct-proc-list">
                <div className="ct-proc-header">
                  <span>{t('procName')}</span>
                  <span>{t('matPrice')}</span>
                  <span />
                </div>
                {(tooth.procedures || []).map((proc, pIdx) => {
                  return (
                    <div key={proc.id} className="ct-proc-row">
                      <input type="text" placeholder={t('procNamePh')} value={proc.name}
                        onChange={e => updateProc(pIdx, 'name', e.target.value)} />
                      <input type="number" placeholder="0" min="0" value={proc.price}
                        onChange={e => updateProc(pIdx, 'price', e.target.value)} />
                      <button className="ct-icon-del" onClick={() => removeProc(pIdx)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <button className="ct-add-btn" onClick={addProc}>{t('addProcedure')}</button>
          </div>

          {/* ── Materials ── */}
          <div className="ct-section">
            <div className="ct-section-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
              {t('materialsSection')}
            </div>
            {(tooth.materials || []).length > 0 && (
              <div className="ct-mat-list">
                <div className="ct-mat-header">
                  <span>{t('matName')}</span>
                  <span>{t('matQty')}</span>
                  <span>{t('matPrice')}</span>
                  <span>{t('total')}</span>
                  <span />
                </div>
                {(tooth.materials || []).map((mat, mIdx) => {
                  const lineTotal = (parseFloat(mat.qty) || 0) * (parseFloat(mat.price) || 0);
                  return (
                    <div key={mat.id} className="ct-mat-row">
                      <input type="text" placeholder={t('matName')} value={mat.name}
                        onChange={e => updateMat(mIdx, 'name', e.target.value)} />
                      <input type="number" placeholder="1" min="0" value={mat.qty}
                        onChange={e => updateMat(mIdx, 'qty', e.target.value)} />
                      <input type="number" placeholder="0" min="0" value={mat.price}
                        onChange={e => updateMat(mIdx, 'price', e.target.value)} />
                      <span className="ct-mat-total">
                        {lineTotal > 0 ? `${lineTotal.toLocaleString('ru-RU')} ${currency}` : '—'}
                      </span>
                      <button className="ct-icon-del" onClick={() => removeMat(mIdx)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <button className="ct-add-btn" onClick={addMat}>{t('addMaterial')}</button>
          </div>

          {/* ── Tooth subtotal ── */}
          {total > 0 && (
            <div className="ct-tooth-subtotal">
              <span>{t('toothSubtotal')}</span>
              <span className="ct-tooth-subtotal-val">{total.toLocaleString('ru-RU')} {currency}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function VisitPlanSection({ visits, onChange, patientId, session }) {
  const { t, lang } = useLang();
  const currency = t('currency');
  const list = visits || [];

  function update(idx, patch) {
    onChange(list.map((v, i) => i === idx ? { ...v, ...patch } : v));
  }

  function addVisit() {
    onChange([...list, EMPTY_VISIT()]);
  }

  function removeVisit(idx) {
    onChange(list.filter((_, i) => i !== idx));
  }

  function addTooth(vIdx) {
    const v = list[vIdx];
    update(vIdx, { toothEntries: [...(v.toothEntries || []), EMPTY_TOOTH_ENTRY()] });
  }

  function updateTooth(vIdx, tIdx, patch) {
    const v = list[vIdx];
    const toothEntries = (v.toothEntries || []).map((t, i) => i === tIdx ? patch : t);
    update(vIdx, { toothEntries });
  }

  function removeTooth(vIdx, tIdx) {
    const v = list[vIdx];
    update(vIdx, { toothEntries: (v.toothEntries || []).filter((_, i) => i !== tIdx) });
  }

  const PAY_METHODS = [
    ['cash', t('payMethodCash')],
    ['card', t('payMethodCard')],
    ['transfer', t('payMethodTransfer')],
  ];

  return (
    <div className="visit-plan-section">
      {list.length === 0 && (
        <div className="vp-empty">{t('noVisits')}</div>
      )}

      {list.map((v, vIdx) => {
        const grand = calcVisitGrand(v);
        const balance = calcBalance(v);
        const toothEntries = v.toothEntries || [];

        return (
          <div key={v.id} className="ct-visit-card">
            {/* ── Visit header ── */}
            <div className="ct-visit-header">
              <div className="ct-visit-header-left">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span className="ct-visit-num">{t('visitNum')} #{vIdx + 1}</span>
                {v.date && <span className="ct-visit-date">{new Date(v.date).toLocaleDateString('ru-RU')}</span>}
              </div>
              <button className="vp-remove-btn" onClick={() => removeVisit(vIdx)} title={t('removeVisit')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
                {t('removeVisit')}
              </button>
            </div>

            {/* ── 1. Visit info ── */}
            <div className="ct-block">
              <div className="ct-block-title">1. {t('visitDate')} / {t('visitDoctor2')} / {t('visitSpec')}</div>
              <div className="vp-info-grid">
                <div className="form-group">
                  <label>{t('visitDate')}</label>
                  <input type="date" value={v.date} onChange={e => update(vIdx, { date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>{t('visitDoctor2')}</label>
                  <input type="text" placeholder={t('visitDoctor2')} value={v.doctor}
                    onChange={e => update(vIdx, { doctor: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>{t('visitSpec')}</label>
                  <input type="text" placeholder={t('visitSpecPh')} value={v.specialty}
                    onChange={e => update(vIdx, { specialty: e.target.value })} />
                </div>
              </div>
            </div>

            {/* ── 2. Clinical part (per-tooth) ── */}
            <div className="ct-block">
              <div className="ct-block-title">2. {t('clinicalPart')}</div>

              {toothEntries.length === 0 && (
                <div className="ct-no-teeth">{t('noTeethYet')}</div>
              )}

              {toothEntries.map((tooth, tIdx) => (
                <ToothCard
                  key={tooth.id}
                  tooth={tooth}
                  toothIdx={tIdx}
                  visitIdx={vIdx}
                  lang={lang}
                  t={t}
                  currency={currency}
                  onUpdate={patch => updateTooth(vIdx, tIdx, patch)}
                  onRemove={() => removeTooth(vIdx, tIdx)}
                />
              ))}

              <button className="ct-add-tooth-btn" onClick={() => addTooth(vIdx)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                {t('addTooth')}
              </button>
            </div>

            {/* ── 3. Visit totals ── */}
            <div className="ct-block ct-totals-block">
              <div className="ct-block-title">3. {t('visitCostSection')}</div>
              <div className="ct-totals-grid">
                {toothEntries.map((tooth, tIdx) => {
                  const tt = calcToothTotal(tooth);
                  if (tt === 0 && !tooth.toothNumber) return null;
                  return (
                    <div key={tooth.id} className="ct-total-row">
                      <span className="ct-total-label">
                        {t('toothLabel')} {tooth.toothNumber || (tIdx + 1)}
                      </span>
                      <span className="ct-total-amount">{tt.toLocaleString('ru-RU')} {currency}</span>
                    </div>
                  );
                })}
                <div className="ct-grand-total-row">
                  <span>{t('visitTotal')}</span>
                  <span className="ct-grand-total-val">{grand.toLocaleString('ru-RU')} {currency}</span>
                </div>
              </div>
            </div>

            {/* ── 4. Payment ── */}
            <div className="ct-block">
              <div className="ct-block-title">4. {t('paymentSection')}</div>
              <div className="vp-pay-grid">
                <div className="form-group">
                  <label>{t('paid')}</label>
                  <input type="number" placeholder="0" min="0" value={v.paid}
                    onChange={e => update(vIdx, { paid: e.target.value })} />
                </div>
                <div className="vp-balance-display">
                  <span className="vp-balance-label">{t('balance')}</span>
                  <span className={`vp-balance-value${balance > 0 ? ' vp-balance-due' : ' vp-balance-ok'}`}>
                    {balance.toLocaleString('ru-RU')} {currency}
                  </span>
                </div>
                <div className="form-group">
                  <label>{t('payMethod')}</label>
                  <div className="radio-row">
                    {PAY_METHODS.map(([val, lbl]) => (
                      <label key={val} className="radio-item">
                        <input type="radio" name={`payMethod-${v.id}`} checked={v.payMethod === val}
                          onChange={() => update(vIdx, { payMethod: val })} />
                        <span>{lbl}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>{t('apptComment')}</label>
                  <input type="text" placeholder={t('apptCommentPh')} value={v.payComment || ''}
                    onChange={e => update(vIdx, { payComment: e.target.value })} />
                </div>
              </div>
            </div>

            {/* ── 5. Рентген и фото ── */}
            <div className="ct-block">
              <div className="ct-block-title">5. {t('filesTitle')}</div>
              <VisitFilesBlock
                patientId={patientId || ''}
                visitId={v.id}
                session={session}
              />
            </div>
          </div>
        );
      })}

      <button className="vp-add-visit-btn" onClick={addVisit}>{t('addVisit')}</button>
    </div>
  );
}

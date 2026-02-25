import { useState } from 'react';
import { generateCardNumber, createPatient } from '../utils/storage';
import { useLang } from '../context/LangContext';
import Odontogram from './Odontogram';
import SpecializedSection from './SpecializedSection';
import LegalSection from './LegalSection';
import IcdSearchInput from './IcdSearchInput';

const EMPTY_FORM = {
  // Block 1 — General
  fullName: '',
  birthDate: '',
  gender: '',         // 'M' | 'Z'
  phone: '',
  address: '',
  profession: '',
  passportId: '',
  // Block 2 — Life anamnesis
  anamHeart: false,
  anamDiabetes: false,
  anamAsthma: false,
  anamBlood: false,
  anamEpilepsy: false,
  anamOther: false,
  anamOtherText: '',
  permanentMeds: '',
  allergyNo: true,
  allergyYes: false,
  allergyText: '',
  operations: '',
  infectDiseases: '',
  // Block 3 — Dental anamnesis
  visitReason: '',
  duration: '',
  lastVisit: '',
  painNo: true,
  painYes: false,
  painSevere: false,
  painOnBite: false,
  treatmentRegular: false,
  treatmentRare: false,
  treatmentNever: false,
  // Block 4 — Examination
  faceSym: false,
  faceAsym: false,
  lymphNormal: false,
  lymphEnlarged: false,
  gumsHealthy: false,
  gumsGingivitis: false,
  gumsParodontitis: false,
  hygieneGood: false,
  hygieneSatisf: false,
  hygieneBad: false,
  biteOrtho: false,
  biteDeep: false,
  biteOpen: false,
  biteCross: false,
  // Block 5 — Odontogram
  odontogram: {},
  // Block 6 — Xray
  xrayPritsel: false,
  xrayOPTG: false,
  xrayKLKT: false,
  xrayResults: '',
  // Block 7 — Diagnosis (ICD-10)
  mainDiagnosis: { icdCode: '', descriptionRu: '', descriptionTj: '', toothNumber: '', comment: '' },
  secDiagnoses: [],
  // Block 8 — Treatment plan (visits)
  treatmentPlan: [],
  // Block 9 — Specialized
  specialized: { profile: 'therapy' },
  // Block 10 — Legal
  legal: {},
};

// ── Maps camelCase form state → snake_case Supabase columns ──────
// Only includes columns that exist in the patients table.
// Never sends allergyNo, doctor_name, or any other unknown field.
function toDbPayload(form, extra = {}) {
  return {
    // Block 1 — Basic info
    full_name:   form.fullName   || '',
    birth_date:  form.birthDate  || null,
    gender:      form.gender     || '',
    phone:       form.phone      || '',
    address:     form.address    || '',
    profession:  form.profession || '',
    passport_id: form.passportId || '',
    // Block 2 — Anamnesis booleans
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
    // Block 3 — Dental anamnesis
    visit_reason:      form.visitReason      || '',
    duration:          form.duration         || '',
    last_visit:        form.lastVisit        || null,
    pain_yes:          form.painYes          || false,
    pain_severe:       form.painSevere       || false,
    pain_on_bite:      form.painOnBite       || false,
    treatment_regular: form.treatmentRegular || false,
    treatment_rare:    form.treatmentRare    || false,
    treatment_never:   form.treatmentNever   || false,
    // Block 4 — Examination
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
    // Block 5 — Odontogram
    odontogram: form.odontogram || {},
    // Block 6 — Xray
    xray_pritsel: form.xrayPritsel || false,
    xray_optg:    form.xrayOPTG   || false,
    xray_klkt:    form.xrayKLKT   || false,
    xray_results: form.xrayResults || '',
    // Block 7 — Diagnosis (jsonb)
    main_diagnosis: form.mainDiagnosis || null,
    sec_diagnoses:  form.secDiagnoses  || [],
    // Blocks 8–9 — Specialized / Legal (jsonb)
    specialized: form.specialized || null,
    legal:       form.legal       || null,
    // Extra fields injected by caller (card_number, clinic_id, etc.)
    ...extra,
  };
}

export default function NewPatientModal({ onClose, onSaved, session }) {
  const { t, lang } = useLang();

  const SECTIONS = [
    t('block1'), t('block2'), t('block3'), t('block4'),
    t('block5'), t('block6'), t('block7'),
    t('secSpec'), t('secLegal'),
  ];
  const [form, setForm] = useState(EMPTY_FORM);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaved(true);
    const cardNumber = await generateCardNumber();
    const patientData = toDbPayload(form, {
      card_number: cardNumber,
      clinic_id:   session?.clinicId || 'clinic_default',
      doctor_id:   session ? String(session.id) : null,
    });
    const newPatient = await createPatient(patientData);
    if (!newPatient) {
      // createPatient already logs the error; give UI feedback
      setSaved(false);
      return;
    }
    setTimeout(() => {
      setSaved(false);
      if (onSaved) {
        onSaved(newPatient);
      } else {
        onClose();
      }
    }, 1200);
  }

  // Radio-style exclusive toggle helpers
  function radioSet(keys, chosen) {
    const patch = {};
    keys.forEach(k => { patch[k] = k === chosen; });
    setForm(f => ({ ...f, ...patch }));
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <div className="modal-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
            <span>{t('new_patient')} — {t('sectionTitles')[activeSection]}</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-tabs">
          {SECTIONS.map((s, i) => (
            <button key={i}
              className={`modal-tab${activeSection === i ? ' modal-tab--active' : ''}`}
              onClick={() => setActiveSection(i)}>
              <span className="tab-num">{i + 1}</span>
              {s}
            </button>
          ))}
        </div>

        <div className="modal-body">

          {/* ── BLOCK 1 ─────────────────────────────────────────── */}
          {activeSection === 0 && (
            <div className="form-section">
              <h3 className="section-title">{t('sectionTitles')[0]}</h3>
              <div className="form-grid-2">
                <div className="form-group span-2">
                  <label>{t('fullName')}</label>
                  <input type="text" placeholder={t('fullNamePh')} value={form.fullName}
                    onChange={e => set('fullName', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{t('birthDate')}</label>
                  <input type="date" value={form.birthDate}
                    onChange={e => set('birthDate', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{t('gender')}</label>
                  <div className="radio-row">
                    {[['M', t('male')], ['Z', t('female')]].map(([val, lbl]) => (
                      <label key={val} className="radio-item">
                        <input type="radio" name="gender" value={val}
                          checked={form.gender === val}
                          onChange={() => set('gender', val)} />
                        <span>{lbl}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('phone')}</label>
                  <input type="tel" placeholder="+992 XXX XXX XXX" value={form.phone}
                    onChange={e => set('phone', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{t('passportId')}</label>
                  <input type="text" placeholder={t('passportPh')} value={form.passportId}
                    onChange={e => set('passportId', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{t('address')}</label>
                  <input type="text" placeholder={t('addressPh')} value={form.address}
                    onChange={e => set('address', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{t('profession')}</label>
                  <input type="text" placeholder={t('professionPh')} value={form.profession}
                    onChange={e => set('profession', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── BLOCK 2 ─────────────────────────────────────────── */}
          {activeSection === 1 && (
            <div className="form-section">
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
                      <input type="radio" name="allergy" checked={form.allergyNo}
                        onChange={() => { set('allergyNo', true); set('allergyYes', false); }} />
                      <span>{t('allergyNo')}</span>
                    </label>
                    <label className="radio-item">
                      <input type="radio" name="allergy" checked={form.allergyYes}
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
            </div>
          )}

          {/* ── BLOCK 3 ─────────────────────────────────────────── */}
          {activeSection === 2 && (
            <div className="form-section">
              <h3 className="section-title">{t('sectionTitles')[2]}</h3>
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
                    <input type="radio" name="pain" checked={form.painNo}
                      onChange={() => { set('painNo', true); set('painYes', false); }} />
                    <span>{t('painNo')}</span>
                  </label>
                  <label className="radio-item">
                    <input type="radio" name="pain" checked={form.painYes}
                      onChange={() => { set('painNo', false); set('painYes', true); }} />
                    <span>{t('painYes')}</span>
                  </label>
                </div>
                {form.painYes && (
                  <div className="checkbox-grid" style={{ marginTop: '0.5rem' }}>
                    <label className="checkbox-item">
                      <input type="checkbox" checked={form.painSevere}
                        onChange={e => set('painSevere', e.target.checked)} />
                      <span>{t('painSevere')}</span>
                    </label>
                    <label className="checkbox-item">
                      <input type="checkbox" checked={form.painOnBite}
                        onChange={e => set('painOnBite', e.target.checked)} />
                      <span>{t('painOnBite')}</span>
                    </label>
                  </div>
                )}
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
                      <input type="radio" name="prevTreatment" checked={form[key]}
                        onChange={() => radioSet(['treatmentRegular', 'treatmentRare', 'treatmentNever'], key)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── BLOCK 4 ─────────────────────────────────────────── */}
          {activeSection === 3 && (
            <div className="form-section">
              <h3 className="section-title">{t('sectionTitles')[3]}</h3>
              <div className="exam-grid">

                <div className="exam-group">
                  <div className="sub-label">{t('face')}</div>
                  <div className="radio-col">
                    {[['faceSym', t('faceSym')], ['faceAsym', t('faceAsym')]].map(([key, lbl]) => (
                      <label key={key} className="radio-item">
                        <input type="radio" name="face" checked={form[key]}
                          onChange={() => radioSet(['faceSym', 'faceAsym'], key)} />
                        <span>{lbl}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="exam-group">
                  <div className="sub-label">{t('lymph')}</div>
                  <div className="radio-col">
                    {[['lymphNormal', t('lymphNormal')], ['lymphEnlarged', t('lymphEnlarged')]].map(([key, lbl]) => (
                      <label key={key} className="radio-item">
                        <input type="radio" name="lymph" checked={form[key]}
                          onChange={() => radioSet(['lymphNormal', 'lymphEnlarged'], key)} />
                        <span>{lbl}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="exam-group">
                  <div className="sub-label">{t('gums')}</div>
                  <div className="radio-col">
                    {[
                      ['gumsHealthy', t('gumsHealthy')],
                      ['gumsGingivitis', t('gumsGingivitis')],
                      ['gumsParodontitis', t('gumsParodontitis')],
                    ].map(([key, lbl]) => (
                      <label key={key} className="radio-item">
                        <input type="radio" name="gums" checked={form[key]}
                          onChange={() => radioSet(['gumsHealthy', 'gumsGingivitis', 'gumsParodontitis'], key)} />
                        <span>{lbl}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="exam-group">
                  <div className="sub-label">{t('hygiene')}</div>
                  <div className="radio-col">
                    {[
                      ['hygieneGood', t('hygieneGood')],
                      ['hygieneSatisf', t('hygieneSatisf')],
                      ['hygieneBad', t('hygieneBad')],
                    ].map(([key, lbl]) => (
                      <label key={key} className="radio-item">
                        <input type="radio" name="hygiene" checked={form[key]}
                          onChange={() => radioSet(['hygieneGood', 'hygieneSatisf', 'hygieneBad'], key)} />
                        <span>{lbl}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="exam-group">
                  <div className="sub-label">{t('bite')}</div>
                  <div className="radio-col">
                    {[
                      ['biteOrtho', t('biteOrtho')],
                      ['biteDeep', t('biteDeep')],
                      ['biteOpen', t('biteOpen')],
                      ['biteCross', t('biteCross')],
                    ].map(([key, lbl]) => (
                      <label key={key} className="radio-item">
                        <input type="radio" name="bite" checked={form[key]}
                          onChange={() => radioSet(['biteOrtho', 'biteDeep', 'biteOpen', 'biteCross'], key)} />
                        <span>{lbl}</span>
                      </label>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── BLOCK 5 ─────────────────────────────────────────── */}
          {activeSection === 4 && (
            <div className="form-section">
              <h3 className="section-title">{t('sectionTitles')[4]}</h3>
              <Odontogram
                value={form.odontogram}
                onChange={val => set('odontogram', val)}
              />
            </div>
          )}

          {/* ── BLOCK 6 ─────────────────────────────────────────── */}
          {activeSection === 5 && (
            <div className="form-section">
              <h3 className="section-title">{t('sectionTitles')[5]}</h3>
              <div className="sub-label">{t('xrayType')}</div>
              <div className="checkbox-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {[
                  ['xrayPritsel', t('xrayPritsel')],
                  ['xrayOPTG', t('xrayOPTG')],
                  ['xrayKLKT', t('xrayKLKT')],
                ].map(([key, lbl]) => (
                  <label key={key} className="checkbox-item">
                    <input type="checkbox" checked={form[key]} onChange={e => set(key, e.target.checked)} />
                    <span>{lbl}</span>
                  </label>
                ))}
              </div>
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>{t('xrayResults')}</label>
                <textarea rows={5} placeholder={t('xrayResultsPh')}
                  value={form.xrayResults} onChange={e => set('xrayResults', e.target.value)} />
              </div>
            </div>
          )}

          {/* ── BLOCK 7 ─────────────────────────────────────────── */}
          {activeSection === 6 && (
            <div className="form-section">
              <h3 className="section-title">{t('sectionTitles')[6]}</h3>

              {/* ── Main diagnosis (single) ── */}
              <div className="diag7-group">
                <div className="diag7-group-label diag7-group-label--main">
                  {t('mainDiag')}
                  <span className="diag7-required">*</span>
                </div>
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
                      <input
                        type="text"
                        className="icd-tooth-input"
                        placeholder={t('diagToothPh')}
                        value={form.mainDiagnosis.toothNumber}
                        onChange={e => set('mainDiagnosis', { ...form.mainDiagnosis, toothNumber: e.target.value })}
                        maxLength={2}
                      />
                      <input
                        type="text"
                        className="icd-comment-input"
                        placeholder={t('diagCommentPh')}
                        value={form.mainDiagnosis.comment}
                        onChange={e => set('mainDiagnosis', { ...form.mainDiagnosis, comment: e.target.value })}
                      />
                    </div>
                    {/* no delete button — main diagnosis is always present */}
                    <div style={{ width: 32 }} />
                  </div>
                </div>
              </div>

              {/* ── Secondary diagnoses (multiple) ── */}
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
                          <IcdSearchInput
                            value={sd.icdCode}
                            lang={lang}
                            placeholder={t('diagCodePh')}
                            onChange={patch => {
                              const next = form.secDiagnoses.map((d, i) => i === sdIdx ? { ...d, ...patch } : d);
                              set('secDiagnoses', next);
                            }}
                          />
                          <div className="icd-desc-cell">
                            {(lang === 'tj' ? sd.descriptionTj : sd.descriptionRu)
                              ? <span className="icd-desc-text">{lang === 'tj' ? sd.descriptionTj : sd.descriptionRu}</span>
                              : <span className="icd-desc-placeholder">{t('diagDesc')}</span>}
                          </div>
                          <input
                            type="text"
                            className="icd-tooth-input"
                            placeholder={t('diagToothPh')}
                            value={sd.toothNumber}
                            onChange={e => {
                              const next = form.secDiagnoses.map((d, i) => i === sdIdx ? { ...d, toothNumber: e.target.value } : d);
                              set('secDiagnoses', next);
                            }}
                            maxLength={2}
                          />
                          <input
                            type="text"
                            className="icd-comment-input"
                            placeholder={t('diagCommentPh')}
                            value={sd.comment}
                            onChange={e => {
                              const next = form.secDiagnoses.map((d, i) => i === sdIdx ? { ...d, comment: e.target.value } : d);
                              set('secDiagnoses', next);
                            }}
                          />
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

          {/* ── BLOCK 8: Specialized ─────────────────────────────── */}
          {activeSection === 7 && (
            <SpecializedSection
              data={form.specialized}
              onChange={val => set('specialized', val)}
            />
          )}

          {/* ── BLOCK 9: Legal ──────────────────────────────────── */}
          {activeSection === 8 && (
            <LegalSection
              data={form.legal}
              onChange={val => set('legal', val)}
            />
          )}

        </div>

        <div className="modal-footer">
          <div className="footer-nav">
            {activeSection > 0 && (
              <button className="btn-nav" onClick={() => setActiveSection(s => s - 1)}>{t('back')}</button>
            )}
            {activeSection < SECTIONS.length - 1 && (
              <button className="btn-nav btn-nav--next" onClick={() => setActiveSection(s => s + 1)}>{t('next')}</button>
            )}
          </div>
          {activeSection === SECTIONS.length - 1 && (
            <button className={`btn-save${saved ? ' btn-save--ok' : ''}`} onClick={handleSave} disabled={saved}>
              {saved ? t('saved') : t('save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

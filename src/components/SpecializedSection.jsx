import { useState } from 'react';
import { useLang } from '../context/LangContext';
import IcdSearchInput from './IcdSearchInput';

function Field({ label, children }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      {children}
    </div>
  );
}

function RadioGroup({ name, options, value, onChange }) {
  return (
    <div className="radio-row">
      {options.map(([val, lbl]) => (
        <label key={val} className="radio-item">
          <input type="radio" name={name} checked={value === val} onChange={() => onChange(val)} />
          <span>{lbl}</span>
        </label>
      ))}
    </div>
  );
}

function CheckGroup({ items, values, onChange }) {
  return (
    <div className="checkbox-grid">
      {items.map(([key, lbl]) => (
        <label key={key} className="checkbox-item">
          <input type="checkbox" checked={!!values[key]}
            onChange={e => onChange({ ...values, [key]: e.target.checked })} />
          <span>{lbl}</span>
        </label>
      ))}
    </div>
  );
}

/* ─────────────── CAUSATIVE BLOCK (shared) ─────────────── */
function CausativeBlock({ data, onChange, t, lang }) {
  function s(k, v) { onChange({ ...data, [k]: v }); }
  const icdDesc = lang === 'tj' ? (data.icdDescTj || data.icdDescRu) : (data.icdDescRu || data.icdDescTj);
  return (
    <div className="spec-causative-block">
      <div className="form-grid-2">
        <Field label={t('specCausativeTooth')}>
          <input
            type="text"
            placeholder={t('specCausativeToothPh')}
            value={data.causativeTooth || ''}
            onChange={e => s('causativeTooth', e.target.value)}
          />
        </Field>
        <div className="form-group">
          <label>{t('specIcdCode')} (МКБ-10)</label>
          <IcdSearchInput
            value={data.icdCode || ''}
            lang={lang}
            onChange={({ icdCode, descriptionRu, descriptionTj }) => {
              onChange({ ...data, icdCode, icdDescRu: descriptionRu, icdDescTj: descriptionTj });
            }}
            placeholder="K02.1..."
          />
          {icdDesc && (
            <div className="plan-icd-hint">{icdDesc}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── THERAPY ─────────────── */
function TherapyForm({ data, onChange, t, lang }) {
  function s(k, v) { onChange({ ...data, [k]: v }); }
  return (
    <div className="spec-form">
      <h4 className="spec-sub-title">{t('specTherapyTitle')}</h4>
      <CausativeBlock data={data} onChange={onChange} t={t} lang={lang} />
      <div className="form-grid-2">
        <Field label={t('specComplaints')}>
          <textarea rows={3} placeholder={t('specComplaintsPh')} value={data.complaints || ''}
            onChange={e => s('complaints', e.target.value)} />
        </Field>
        <div className="form-group">
          <label>{t('specColdReaction')}</label>
          <RadioGroup name="th_cold" options={[['yes', t('specYes')], ['no', t('specNo')]]}
            value={data.coldReaction || ''} onChange={v => s('coldReaction', v)} />
        </div>
        <div className="form-group">
          <label>{t('specPercussion')}</label>
          <RadioGroup name="th_perc" options={[['+', t('specPositive')], ['-', t('specNegative')]]}
            value={data.percussion || ''} onChange={v => s('percussion', v)} />
        </div>
        <div className="form-group">
          <label>{t('specProbing')}</label>
          <RadioGroup name="th_probe" options={[['pain', t('specPainful')], ['nopain', t('specPainless')]]}
            value={data.probing || ''} onChange={v => s('probing', v)} />
        </div>
        <div className="form-group">
          <label>{t('specDiagnosis')}</label>
          <RadioGroup name="th_diag"
            options={[['caries', t('specCaries')], ['pulpitis', t('specPulpitis')], ['periodontitis', t('specPeriodontitis')]]}
            value={data.thDiagnosis || ''} onChange={v => s('thDiagnosis', v)} />
        </div>
        <div className="form-group">
          <label>{t('specCariesType')}</label>
          <RadioGroup name="th_caries"
            options={[['superficial', t('specSuperficial')], ['medium', t('specMedium')], ['deep', t('specDeep')]]}
            value={data.cariesType || ''} onChange={v => s('cariesType', v)} />
        </div>
        <div className="form-group span-2">
          <label>{t('specTreatment')}</label>
          <CheckGroup
            items={[
              ['prep', t('specPrep')],
              ['medTreat', t('specMedTreat')],
              ['filling', t('specFilling')],
            ]}
            values={data.thTreatment || {}}
            onChange={v => s('thTreatment', v)}
          />
        </div>
        <Field label={t('specFillingMaterial')}>
          <input type="text" placeholder={t('specFillingMaterialPh')} value={data.fillingMaterial || ''}
            onChange={e => s('fillingMaterial', e.target.value)} />
        </Field>
        <Field label={t('specCanalCount')}>
          <input type="number" placeholder={t('specCanalCountPh')} value={data.canalCount || ''}
            onChange={e => s('canalCount', e.target.value)} />
        </Field>
        <Field label={t('specCanalMethod')}>
          <input type="text" placeholder={t('specCanalMethodPh')} value={data.canalMethod || ''}
            onChange={e => s('canalMethod', e.target.value)} />
        </Field>
        <Field label={t('specObturation')}>
          <input type="text" placeholder={t('specObturationPh')} value={data.obturation || ''}
            onChange={e => s('obturation', e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

/* ─────────────── SURGERY ─────────────── */
function SurgeryForm({ data, onChange, t, lang }) {
  function s(k, v) { onChange({ ...data, [k]: v }); }
  return (
    <div className="spec-form">
      <h4 className="spec-sub-title">{t('specSurgeryTitle')}</h4>
      <CausativeBlock data={data} onChange={onChange} t={t} lang={lang} />
      <div className="form-grid-2">
        <Field label={t('specIndications')}>
          <textarea rows={2} placeholder={t('specIndicationsPh')} value={data.indications || ''}
            onChange={e => s('indications', e.target.value)} />
        </Field>
        <div className="form-group">
          <label>{t('specSurType')}</label>
          <RadioGroup name="sur_type"
            options={[
              ['extraction', t('specExtraction')],
              ['complex', t('specComplex')],
              ['abscess', t('specAbscess')],
              ['resection', t('specResection')],
              ['other', t('specOtherSur')],
            ]}
            value={data.surType || ''} onChange={v => s('surType', v)} />
        </div>
        {data.surType === 'other' && (
          <Field label={t('specOtherSur')}>
            <input type="text" placeholder={t('specOtherSurPh')} value={data.surTypeOther || ''}
              onChange={e => s('surTypeOther', e.target.value)} />
          </Field>
        )}
        <div className="form-group">
          <label>{t('specAnesType')}</label>
          <RadioGroup name="sur_anes"
            options={[['infiltration', t('specInfiltration')], ['conduction', t('specConduction')]]}
            value={data.anesType || ''} onChange={v => s('anesType', v)} />
        </div>
        <Field label={t('specAnesDrug')}>
          <input type="text" placeholder={t('specAnesDrugPh')} value={data.anesDrug || ''}
            onChange={e => s('anesDrug', e.target.value)} />
        </Field>
        <Field label={t('specAnesDose')}>
          <input type="number" placeholder={t('specAnesDosePh')} step="0.1" value={data.anesDose || ''}
            onChange={e => s('anesDose', e.target.value)} />
        </Field>
        <div className="form-group span-2">
          <label>{t('specOpCourse')}</label>
          <textarea rows={4} placeholder={t('specOpCoursePh')} value={data.operationCourse || ''}
            onChange={e => s('operationCourse', e.target.value)} />
        </div>
        <div className="form-group">
          <label>{t('specComplications')}</label>
          <RadioGroup name="sur_comp" options={[['no', t('specNo')], ['yes', t('specYes')]]}
            value={data.complications || 'no'} onChange={v => s('complications', v)} />
          {data.complications === 'yes' && (
            <input type="text" placeholder={t('specComplicationsPh')} value={data.complicationsText || ''}
              onChange={e => s('complicationsText', e.target.value)} style={{ marginTop: '0.4rem' }} />
          )}
        </div>
        <div className="form-group span-2">
          <label>{t('specPostOp')}</label>
          <textarea rows={3} placeholder={t('specPostOpPh')} value={data.postOpOrders || ''}
            onChange={e => s('postOpOrders', e.target.value)} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────── ORTHO ─────────────── */
function OrthoForm({ data, onChange, t, lang }) {
  function s(k, v) { onChange({ ...data, [k]: v }); }
  return (
    <div className="spec-form">
      <h4 className="spec-sub-title">{t('specOrthoTitle')}</h4>
      <CausativeBlock data={data} onChange={onChange} t={t} lang={lang} />
      <div className="form-grid-2">
        <Field label={t('specComplaints')}>
          <textarea rows={2} value={data.complaints || ''} placeholder={t('specComplaintsPh')}
            onChange={e => s('complaints', e.target.value)} />
        </Field>
        <div className="form-group">
          <label>{t('specDefects')}</label>
          <RadioGroup name="ort_defect"
            options={[['included', t('specIncluded')], ['terminal', t('specTerminal')], ['mixed', t('specMixed')]]}
            value={data.defectType || ''} onChange={v => s('defectType', v)} />
        </div>
        <Field label={t('specSupportTeeth')}>
          <textarea rows={2} value={data.supportTeeth || ''} placeholder={t('specSupportTeethPh')}
            onChange={e => s('supportTeeth', e.target.value)} />
        </Field>
        <div className="form-group">
          <label>{t('specProsthType')}</label>
          <RadioGroup name="ort_type"
            options={[
              ['crown', t('specCrown')],
              ['bridge', t('specBridge')],
              ['removable', t('specRemovable')],
              ['implant', t('specImplantCrown')],
            ]}
            value={data.prosthType || ''} onChange={v => s('prosthType', v)} />
        </div>
        <div className="form-group">
          <label>{t('specImpression')}</label>
          <RadioGroup name="ort_imp"
            options={[
              ['alginate', t('specAlginate')],
              ['c-silicon', t('specCSilicon')],
              ['a-silicon', t('specASilicon')],
              ['digital', t('specDigital')],
            ]}
            value={data.impressionType || ''} onChange={v => s('impressionType', v)} />
        </div>
        <div className="form-group">
          <label>{t('specTempConstruct')}</label>
          <RadioGroup name="ort_temp" options={[['yes', t('specYes')], ['no', t('specNo')]]}
            value={data.tempConstruct || ''} onChange={v => s('tempConstruct', v)} />
        </div>
        <Field label={t('specCement')}>
          <input type="text" placeholder={t('specCementPh')} value={data.cement || ''}
            onChange={e => s('cement', e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

/* ─────────────── PEDIATRIC ─────────────── */
function PediatricForm({ data, onChange, t, lang }) {
  function s(k, v) { onChange({ ...data, [k]: v }); }
  return (
    <div className="spec-form">
      <h4 className="spec-sub-title">{t('specPedTitle')}</h4>
      <CausativeBlock data={data} onChange={onChange} t={t} lang={lang} />
      <div className="form-grid-2">
        <Field label={t('specParentName')}>
          <input type="text" placeholder={t('specParentNamePh')} value={data.parentName || ''}
            onChange={e => s('parentName', e.target.value)} />
        </Field>
        <Field label={t('specParentPhone')}>
          <input type="tel" placeholder={t('specParentPhonePh')} value={data.parentPhone || ''}
            onChange={e => s('parentPhone', e.target.value)} />
        </Field>
        <div className="form-group">
          <label>{t('specBehavior')}</label>
          <RadioGroup name="ped_behav"
            options={[['calm', t('specCalm')], ['anxious', t('specAnxious')], ['negative', t('specNegative')]]}
            value={data.behavior || ''} onChange={v => s('behavior', v)} />
        </div>
        <div className="form-group">
          <label>{t('specBitePed')}</label>
          <RadioGroup name="ped_bite"
            options={[['milk', t('specMilk')], ['mixed', t('specSmennyj')], ['permanent', t('specPermanent')]]}
            value={data.bitePed || ''} onChange={v => s('bitePed', v)} />
        </div>
        <Field label={t('specPedDiag')}>
          <textarea rows={2} value={data.pedDiagnosis || ''} placeholder={t('specPedDiagPh')}
            onChange={e => s('pedDiagnosis', e.target.value)} />
        </Field>
        <Field label={t('specPedTreat')}>
          <textarea rows={2} value={data.pedTreatment || ''} placeholder={t('specPedTreatPh')}
            onChange={e => s('pedTreatment', e.target.value)} />
        </Field>
        <Field label={t('specPedAnes')}>
          <input type="text" placeholder={t('specPedAnesPh')} value={data.pedAnesthesia || ''}
            onChange={e => s('pedAnesthesia', e.target.value)} />
        </Field>
        <div className="form-group span-2">
          <label>{t('specParentRec')}</label>
          <textarea rows={3} value={data.parentRecommendations || ''} placeholder={t('specParentRecPh')}
            onChange={e => s('parentRecommendations', e.target.value)} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────── MAIN EXPORT ─────────────── */
export default function SpecializedSection({ data, onChange }) {
  const { t, lang } = useLang();
  const [profile, setProfile] = useState(data.profile || 'therapy');

  const PROFILES = [
    { key: 'therapy',   label: t('specTherapy') },
    { key: 'surgery',   label: t('specSurgery') },
    { key: 'ortho',     label: t('specOrtho') },
    { key: 'pediatric', label: t('specPediatric') },
  ];

  function handleProfileChange(p) {
    setProfile(p);
    onChange({ ...data, profile: p });
  }

  function handleSubChange(subData) {
    onChange({ ...data, profile, [profile]: subData });
  }

  const subData = data[profile] || {};

  return (
    <div className="form-section">
      <h3 className="section-title">{t('specSectionTitle')}</h3>
      <div className="spec-profile-tabs">
        {PROFILES.map(p => (
          <button key={p.key}
            className={"spec-tab" + (profile === p.key ? ' spec-tab--active' : '')}
            onClick={() => handleProfileChange(p.key)}>
            {p.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: '1.25rem' }}>
        {profile === 'therapy'   && <TherapyForm   data={subData} onChange={handleSubChange} t={t} lang={lang} />}
        {profile === 'surgery'   && <SurgeryForm   data={subData} onChange={handleSubChange} t={t} lang={lang} />}
        {profile === 'ortho'     && <OrthoForm     data={subData} onChange={handleSubChange} t={t} lang={lang} />}
        {profile === 'pediatric' && <PediatricForm data={subData} onChange={handleSubChange} t={t} lang={lang} />}
      </div>
    </div>
  );
}

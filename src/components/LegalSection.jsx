import { useLang } from '../context/LangContext';

export default function LegalSection({ data, onChange }) {
  const { t } = useLang();
  function s(k, v) { onChange({ ...data, [k]: v }); }

  const COMPLICATIONS = [
    ['compPain',          t('legalCompPain')],
    ['compSwelling',      t('legalCompSwelling')],
    ['compBleeding',      t('legalCompBleeding')],
    ['compSensitivity',   t('legalCompSensitivity')],
    ['compRetreatment',   t('legalCompRetreat')],
    ['compAnatomy',       t('legalCompAnatomy')],
    ['compNoncompliance', t('legalCompNoncomp')],
  ];

  return (
    <div className="form-section">
      <h3 className="section-title">{t('legalTitle')}</h3>

      <div className="legal-grid">
        <div className="legal-card">
          <div className="legal-card-title">{t('legalPhoto')}</div>
          <div className="radio-row">
            {[['done', t('legalPhotoDone')], ['refused', t('legalPhotoRefused')]].map(([val, lbl]) => (
              <label key={val} className="radio-item">
                <input type="radio" name="legal_photo" checked={(data.photoStatus || '') === val}
                  onChange={() => s('photoStatus', val)} />
                <span>{lbl}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="legal-card">
          <div className="legal-card-title">{t('legalXrayLabel')}</div>
          <div className="radio-row">
            {[['yes', t('specYes')], ['no', t('specNo')]].map(([val, lbl]) => (
              <label key={val} className="radio-item">
                <input type="radio" name="legal_xray" checked={(data.legalXray || '') === val}
                  onChange={() => s('legalXray', val)} />
                <span>{lbl}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="form-group" style={{ marginTop: '1rem' }}>
        <label>{t('legalPretreatLabel')}</label>
        <textarea rows={4} placeholder={t('legalPretreatPh')}
          value={data.pretreatmentDesc || ''}
          onChange={e => s('pretreatmentDesc', e.target.value)} />
      </div>

      <div className="form-group" style={{ marginTop: '1rem' }}>
        <div className="sub-label">{t('legalWarnLabel')}</div>
        <div className="checkbox-grid">
          {COMPLICATIONS.map(([key, lbl]) => (
            <label key={key} className="checkbox-item">
              <input type="checkbox" checked={!!data[key]}
                onChange={e => s(key, e.target.checked)} />
              <span>{lbl}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-grid-2" style={{ marginTop: '1rem' }}>
        <div className="form-group">
          <label>{t('legalPatSig')}</label>
          <input type="text" placeholder={t('legalPatSigPh')} value={data.patientSignature || ''}
            onChange={e => s('patientSignature', e.target.value)} />
        </div>
        <div className="form-group">
          <label>{t('legalDocSig')}</label>
          <input type="text" placeholder={t('legalDocSigPh')} value={data.doctorSignature || ''}
            onChange={e => s('doctorSignature', e.target.value)} />
        </div>
        <div className="form-group">
          <label>{t('legalSignDate')}</label>
          <input type="date" value={data.signDate || ''}
            onChange={e => s('signDate', e.target.value)} />
        </div>
      </div>
    </div>
  );
}

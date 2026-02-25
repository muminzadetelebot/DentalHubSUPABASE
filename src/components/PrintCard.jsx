import { createPortal } from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import { useLang } from '../context/LangContext';
import { getPatientById, getVisitsByPatient, getTreatmentPlanByPatient } from '../utils/storage';
import { getClinicById } from '../utils/clinicStorage';

// ── Normalise a patient object so both snake_case (Supabase) and
//    camelCase (legacy localStorage) field names work everywhere. ──
function norm(patient) {
  if (!patient) return {};
  const p = patient;
  return {
    // identity
    id:           p.id,
    card_number:  p.card_number  || p.cardNumber  || '',
    clinic_id:    p.clinic_id    || p.clinicId    || 'clinic_default',
    // block 1 — general
    full_name:    p.full_name    || p.fullName    || '',
    birth_date:   p.birth_date   || p.birthDate   || '',
    gender:       p.gender       || '',
    phone:        p.phone        || '',
    passport_id:  p.passport_id  || p.passportId  || '',
    address:      p.address      || '',
    profession:   p.profession   || '',
    created_at:   p.created_at   || p.createdAt   || '',
    // block 2 — anamnesis flags
    anam_heart:       p.anam_heart       ?? p.anamHeart       ?? false,
    anam_diabetes:    p.anam_diabetes    ?? p.anamDiabetes    ?? false,
    anam_asthma:      p.anam_asthma      ?? p.anamAsthma      ?? false,
    anam_blood:       p.anam_blood       ?? p.anamBlood       ?? false,
    anam_epilepsy:    p.anam_epilepsy    ?? p.anamEpilepsy    ?? false,
    anam_other:       p.anam_other       ?? p.anamOther       ?? false,
    anam_other_text:  p.anam_other_text  || p.anamOtherText   || '',
    allergy_yes:      p.allergy_yes      ?? p.allergyYes      ?? false,
    allergy_text:     p.allergy_text     || p.allergyText     || '',
    permanent_meds:   p.permanent_meds   || p.permanentMeds   || '',
    operations:       p.operations       || '',
    infect_diseases:  p.infect_diseases  || p.infectDiseases  || '',
    // block 3 — dental anamnesis
    visit_reason:     p.visit_reason     || p.visitReason     || '',
    duration:         p.duration         || '',
    last_visit:       p.last_visit       || p.lastVisit       || '',
    pain_yes:         p.pain_yes         ?? p.painYes         ?? false,
    pain_severe:      p.pain_severe      ?? p.painSevere      ?? false,
    pain_on_bite:     p.pain_on_bite     ?? p.painOnBite      ?? false,
    treatment_regular:p.treatment_regular?? p.treatmentRegular?? false,
    treatment_rare:   p.treatment_rare   ?? p.treatmentRare   ?? false,
    treatment_never:  p.treatment_never  ?? p.treatmentNever  ?? false,
    // block 4 — examination
    face_sym:         p.face_sym         ?? p.faceSym         ?? false,
    face_asym:        p.face_asym        ?? p.faceAsym        ?? false,
    lymph_normal:     p.lymph_normal     ?? p.lymphNormal     ?? false,
    lymph_enlarged:   p.lymph_enlarged   ?? p.lymphEnlarged   ?? false,
    gums_healthy:     p.gums_healthy     ?? p.gumsHealthy     ?? false,
    gums_gingivitis:  p.gums_gingivitis  ?? p.gumsGingivitis  ?? false,
    gums_parodontitis:p.gums_parodontitis?? p.gumsParodontitis?? false,
    hygiene_good:     p.hygiene_good     ?? p.hygieneGood     ?? false,
    hygiene_satisf:   p.hygiene_satisf   ?? p.hygieneSatisf   ?? false,
    hygiene_bad:      p.hygiene_bad      ?? p.hygieneBad      ?? false,
    bite_ortho:       p.bite_ortho       ?? p.biteOrtho       ?? false,
    bite_deep:        p.bite_deep        ?? p.biteDeep        ?? false,
    bite_open:        p.bite_open        ?? p.biteOpen        ?? false,
    bite_cross:       p.bite_cross       ?? p.biteCross       ?? false,
    // block 5 — odontogram
    odontogram:       p.odontogram       || {},
    // block 6 — xray
    xray_pritsel:     p.xray_pritsel     ?? p.xrayPritsel     ?? false,
    xray_optg:        p.xray_optg        ?? p.xrayOPTG        ?? false,
    xray_klkt:        p.xray_klkt        ?? p.xrayKLKT        ?? false,
    xray_results:     p.xray_results     || p.xrayResults     || '',
    // block 7 — diagnosis
    main_diagnosis:   p.main_diagnosis   ?? p.mainDiagnosis   ?? null,
    sec_diagnoses:    p.sec_diagnoses    ?? p.secDiagnoses    ?? [],
    // visits / plan — loaded separately by VisitLog / TreatmentPlan
    // but kept here for legacy fallback
    visits:           p.visits           || [],
    treatmentPlan:    p.treatmentPlan    || p.treatment_plan  || [],
    longTermPlan:     p.longTermPlan     || p.long_term_plan  || [],
    // blocks 9–10 — specialized, legal
    specialized:      p.specialized      || null,
    legal:            p.legal            || null,
  };
}

function PrintContent({ patient, visits: visitsProp, longTermPlan: planProp, t, lang }) {
  function fmt(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('ru-RU'); } catch { return iso; }
  }

  function genderLabel(g) {
    if (g === 'M') return t('genderM');
    if (g === 'Z') return t('genderF');
    return '—';
  }

  const p = norm(patient);
  const visits = visitsProp || p.visits || [];
  const longTermPlan = planProp || p.longTermPlan || [];
  const clinic = getClinicById(p.clinic_id || 'clinic_default');

  const specNames = {
    therapy: t('specTherapy'),
    surgery: t('specSurgery'),
    ortho: t('specOrtho'),
    pediatric: t('specPediatric'),
  };

  return (
    <div className="print-page">
      {/* ══ Official A4 Header — table layout, first page only ══ */}
      <table className="ph-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4mm', borderBottom: '1.5pt solid #000' }}>
        <tbody>
          <tr>
            {/* Left: Ministry + clinic */}
            <td style={{ width: '60%', verticalAlign: 'top', paddingBottom: '3mm', fontSize: '9pt', lineHeight: 1.5 }}>
              <div style={{ fontWeight: 400 }}>Вазорати тандурустӣ ва ҳифзи иҷтимоии аҳолии</div>
              <div style={{ fontWeight: 700, marginBottom: '2mm' }}>Ҷумҳурии Тоҷикистон</div>
              {clinic && clinic.name && (
                <div><strong>Номгӯи муассиса:</strong> {clinic.name}</div>
              )}
              {clinic && clinic.address && <div>{clinic.address}</div>}
              {clinic && clinic.phone && <div>{clinic.phone}</div>}
            </td>
            {/* Right: Form codes + decree */}
            <td style={{ width: '40%', verticalAlign: 'top', textAlign: 'right', paddingBottom: '3mm', fontSize: '8.5pt', lineHeight: 1.5 }}>
              <div>Рамзи шакл аз рӯи ТУХИ: <span style={{ borderBottom: '1pt solid #000', display: 'inline-block', minWidth: '20mm' }}>&nbsp;</span></div>
              <div>Рамзи муассиса аз рӯи РУКТ: <span style={{ borderBottom: '1pt solid #000', display: 'inline-block', minWidth: '20mm' }}>&nbsp;</span></div>
              <div style={{ marginTop: '2mm', fontStyle: 'italic', fontSize: '7.5pt' }}>
                Ҳуҷҷати тиббӣ шакли № 043-у<br />
                Бо фармони Вазорати тандурустӣ ва ҳифзи иҷтимоии аҳолии<br />
                Ҷумҳурии Тоҷикистон аз «06» 09 2023 с. № 569<br />
                тасдиқ шудааст
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Center: Main document title */}
      <div style={{ textAlign: 'center', marginBottom: '4mm', paddingBottom: '3mm', borderBottom: '2pt solid #000' }}>
        <div style={{ fontSize: '12pt', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {t('printDocTitle')}
        </div>
        <div style={{ fontSize: '9pt', marginTop: '1.5mm' }}>
          {p.card_number && (
            <span style={{ fontWeight: 700, marginRight: '8mm' }}>
              {t('printCardNumber')}: <strong>{p.card_number}</strong>
            </span>
          )}
          <span>{t('printRegDate')} {fmt(p.created_at)}</span>
        </div>
      </div>

      {/* 1. General data */}
      <section className="print-section print-section--compact">
        <div className="print-section-title">{t('printGeneral')}</div>
        <table className="print-table">
          <tbody>
            <tr>
              <td className="print-label">{t('printLabelName')}</td><td>{p.full_name || '—'}</td>
              <td className="print-label">{t('printLabelGender')}</td><td>{genderLabel(p.gender)}</td>
            </tr>
            <tr>
              <td className="print-label">{t('printLabelBirth')}</td><td>{fmt(p.birth_date)}</td>
              <td className="print-label">{t('printLabelPhone')}</td><td>{p.phone || '—'}</td>
            </tr>
            <tr>
              <td className="print-label">{t('printLabelId')}</td><td>{p.passport_id || '—'}</td>
              <td className="print-label">{t('printLabelProf')}</td><td>{p.profession || '—'}</td>
            </tr>
            <tr>
              <td className="print-label">{t('printLabelAddr')}</td><td colSpan={3}>{p.address || '—'}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 2. Anamnesis */}
      <section className="print-section print-section--compact">
        <div className="print-section-title">{t('printAnam')}</div>
        <div className="print-flags">
          {p.anam_heart      && <span className="print-flag">{t('heart')}</span>}
          {p.anam_diabetes   && <span className="print-flag">{t('diabetes')}</span>}
          {p.anam_asthma     && <span className="print-flag">{t('asthma')}</span>}
          {p.anam_blood      && <span className="print-flag">{t('bloodDis')}</span>}
          {p.anam_epilepsy   && <span className="print-flag">{t('epilepsy')}</span>}
          {p.anam_other && p.anam_other_text && <span className="print-flag">{p.anam_other_text}</span>}
          {!p.anam_heart && !p.anam_diabetes && !p.anam_asthma && !p.anam_blood && !p.anam_epilepsy && !p.anam_other && (
            <span>{t('printNoFlags')}</span>
          )}
        </div>
        <table className="print-table">
          <tbody>
            <tr>
              <td className="print-label">{t('printLabelAllergy')}</td>
              <td>{p.allergy_yes ? `${t('printAllergyYes')} ${p.allergy_text || ''}` : t('printAllergyNo')}</td>
              <td className="print-label">{t('printLabelMeds')}</td>
              <td>{p.permanent_meds || '—'}</td>
            </tr>
            <tr>
              <td className="print-label">{t('printLabelOper')}</td>
              <td>{p.operations || '—'}</td>
              <td className="print-label">{t('printLabelInfect')}</td>
              <td>{p.infect_diseases || '—'}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 3. Dental anamnesis */}
      {(p.visit_reason || p.duration || p.last_visit) && (
        <section className="print-section print-section--compact">
          <div className="print-section-title">{t('printDental')}</div>
          <table className="print-table">
            <tbody>
              <tr>
                <td className="print-label">{t('printLabelReason')}</td>
                <td colSpan={3}>{p.visit_reason || '—'}</td>
              </tr>
              <tr>
                <td className="print-label">{t('printLabelDuration')}</td>
                <td>{p.duration || '—'}</td>
                <td className="print-label">{t('printLabelLastVisit')}</td>
                <td>{fmt(p.last_visit)}</td>
              </tr>
              <tr>
                <td className="print-label">{t('printLabelPain')}</td>
                <td>
                  {p.pain_yes
                    ? `${t('printPainYes')}${p.pain_severe ? t('printPainSevere') : ''}${p.pain_on_bite ? t('printPainBite') : ''}`
                    : t('printPainNo')}
                </td>
                <td className="print-label">{t('printLabelPrevTreat')}</td>
                <td>
                  {p.treatment_regular ? t('printTreatRegular')
                    : p.treatment_rare  ? t('printTreatRare')
                    : p.treatment_never ? t('printTreatNever')
                    : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* 4. Examination */}
      <section className="print-section print-section--compact">
        <div className="print-section-title">{t('printExam')}</div>
        <table className="print-table">
          <tbody>
            <tr>
              <td className="print-label">{t('printLabelFace')}</td>
              <td>{p.face_sym ? t('printFaceSym') : p.face_asym ? t('printFaceAsym') : '—'}</td>
              <td className="print-label">{t('printLabelLymph')}</td>
              <td>{p.lymph_normal ? t('printLymphNorm') : p.lymph_enlarged ? t('printLymphEnl') : '—'}</td>
            </tr>
            <tr>
              <td className="print-label">{t('printLabelGums')}</td>
              <td>
                {p.gums_healthy      ? t('printGumsHealthy')
                  : p.gums_gingivitis  ? t('printGumsGing')
                  : p.gums_parodontitis ? t('printGumsPar')
                  : '—'}
              </td>
              <td className="print-label">{t('printLabelHygiene')}</td>
              <td>
                {p.hygiene_good   ? t('printHygGood')
                  : p.hygiene_satisf ? t('printHygSatisf')
                  : p.hygiene_bad    ? t('printHygBad')
                  : '—'}
              </td>
            </tr>
            <tr>
              <td className="print-label">{t('printLabelBite')}</td>
              <td colSpan={3}>
                {p.bite_ortho ? t('printBiteOrtho')
                  : p.bite_deep  ? t('printBiteDeep')
                  : p.bite_open  ? t('printBiteOpen')
                  : p.bite_cross ? t('printBiteCross')
                  : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 5. Odontogram */}
      {p.odontogram && Object.keys(p.odontogram).length > 0 && (
        <section className="print-section print-section--compact">
          <div className="print-section-title">{t('printOdonto')}</div>
          <div className="print-odonto">
            {Object.entries(p.odontogram).map(([num, code]) => (
              <span key={num} className="print-tooth">{num}:{code}</span>
            ))}
          </div>
        </section>
      )}

      {/* 6. Xray */}
      {(p.xray_pritsel || p.xray_optg || p.xray_klkt || p.xray_results) && (
        <section className="print-section print-section--compact">
          <div className="print-section-title">{t('printXray')}</div>
          <table className="print-table">
            <tbody>
              <tr>
                <td className="print-label">{t('printLabelXrayType')}</td>
                <td>
                  {[
                    p.xray_pritsel && t('xrayPritsel'),
                    p.xray_optg    && t('xrayOPTG'),
                    p.xray_klkt    && t('xrayKLKT'),
                  ].filter(Boolean).join(', ') || '—'}
                </td>
              </tr>
              {p.xray_results && (
                <tr>
                  <td className="print-label">{t('printLabelXrayRes')}</td>
                  <td>{p.xray_results}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* 7. Diagnosis */}
      {(() => {
        const md = p.main_diagnosis;
        const sds = Array.isArray(p.sec_diagnoses) ? p.sec_diagnoses : [];
        // Support old plain-string format and new object format
        const mainIsObj = md && typeof md === 'object';
        const mainStr = !mainIsObj && typeof md === 'string' ? md : null;
        const mainObj = mainIsObj ? md : null;
        const hasMain = mainStr || (mainObj && mainObj.icdCode);
        const hasSec = sds.length > 0 || (typeof p.secDiagnosis === 'string' && p.secDiagnosis);
        if (!hasMain && !hasSec) return null;

        function diagLine(d, langKey) {
          if (!d) return null;
          const desc = langKey === 'tj' ? d.descriptionTj : d.descriptionRu;
          return [
            d.icdCode,
            desc ? ` — ${desc}` : '',
            d.toothNumber ? ` (${t('printDiagTooth')} ${d.toothNumber})` : '',
            d.comment ? ` • ${d.comment}` : '',
          ].join('');
        }

        return (
          <section className="print-section print-section--compact">
            <div className="print-section-title">{t('printDiag')}</div>
            <table className="print-table">
              <tbody>
                {(hasMain) && (
                  <tr>
                    <td className="print-label" style={{ verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      {t('printMainDiag')}
                    </td>
                    <td>
                      {mainStr || diagLine(mainObj, lang)}
                    </td>
                  </tr>
                )}
                {hasSec && (
                  <tr>
                    <td className="print-label" style={{ verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      {t('printSecDiags')}
                    </td>
                    <td>
                      {sds.length > 0
                        ? sds.map((sd, i) => (
                            <div key={sd.id || i}>{diagLine(sd, lang)}</div>
                          ))
                        : p.secDiagnosis}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        );
      })()}

      {/* 8. Treatment plan — visits */}
      {p.treatmentPlan.length > 0 && (
        <section className="print-section">
          <div className="print-section-title">{t('printTreat')}</div>
          {p.treatmentPlan.map((v, i) => {
            // ── New per-tooth structure ──────────────────────────────
            const hasToothEntries = (v.toothEntries || []).length > 0;

            if (hasToothEntries) {

              return (
                <div key={v.id || i} className="print-visit">
                  <div className="print-visit-header">
                    {t('printVisitNum')} #{i + 1}
                    {v.date && ` — ${fmt(v.date)}`}
                    {v.doctor && ` | ${v.doctor}`}
                    {v.specialty && ` | ${v.specialty}`}
                  </div>

                  {(v.toothEntries || []).map((te, tei) => {
                    const toothProcCost = (te.procedures || []).reduce((s, pr) => s + (parseFloat(pr.price) || 0), 0);
                    const toothMatCost  = (te.materials  || []).reduce((s, m)  => s + ((parseFloat(m.qty) || 0) * (parseFloat(m.price) || 0)), 0);
                    const toothTotal    = toothProcCost + toothMatCost;

                    const mainDiag = (te.diagnoses || []).find(d => d.isMain);
                    const secDiags = (te.diagnoses || []).filter(d => !d.isMain);

                    return (
                      <div key={te.id || tei} className="print-tooth-entry">
                        <div className="print-tooth-label">
                          {t('printToothEntry')} {te.toothNumber || (tei + 1)}
                          {mainDiag && mainDiag.icdCode && (
                            <span className="print-tooth-main-diag">
                              {" — "}<strong>{mainDiag.icdCode}</strong>
                              {(lang === 'tj' ? mainDiag.descriptionTj : mainDiag.descriptionRu)
                                ? ` — ${lang === 'tj' ? mainDiag.descriptionTj : mainDiag.descriptionRu}`
                                : ''}
                            </span>
                          )}
                        </div>
                        <table className="print-table" style={{ marginLeft: '1rem', width: 'calc(100% - 1rem)' }}>
                          <tbody>
                            {secDiags.length > 0 && (
                              <tr>
                                <td className="print-label" style={{ verticalAlign: 'top' }}>{t('printToothDiags')}</td>
                                <td>
                                  {secDiags.map((d, di) => {
                                    const desc = lang === 'tj' ? d.descriptionTj : d.descriptionRu;
                                    return (
                                      <div key={d.id || di}>
                                        <strong>{d.icdCode}</strong>
                                        {desc ? ` — ${desc}` : ''}
                                        {d.comment ? ` • ${d.comment}` : ''}
                                      </div>
                                    );
                                  })}
                                </td>
                              </tr>
                            )}
                            {(te.procedures || []).length > 0 && (
                              <tr>
                                <td className="print-label">{t('printToothProcs')}</td>
                                <td>
                                  {te.procedures.map((pr, pri) => (
                                    <span key={pr.id || pri}>
                                      {pr.name}
                                      {pri < te.procedures.length - 1 ? '; ' : ''}
                                    </span>
                                  ))}
                                </td>
                              </tr>
                            )}
                            {(te.materials || []).length > 0 && (
                              <tr>
                                <td className="print-label">{t('printToothMats')}</td>
                                <td>
                                  {te.materials.map((m, mi) => (
                                    <span key={m.id || mi}>
                                      {m.name}
                                      {m.qty ? ` — ${m.qty}` : ''}
                                      {mi < te.materials.length - 1 ? '; ' : ''}
                                    </span>
                                  ))}
                                </td>
                              </tr>
                            )}
                            {/* Financial subtotal excluded from medical PDF */}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}

                  {/* Financial totals excluded from medical PDF */}
                </div>
              );
            }

            // ── Legacy flat structure (backward-compat) ──────────────
            const procLabels = [
              v.procedures?.caries && t('procCaries'),
              v.procedures?.pulpitis && t('procPulpitis'),
              v.procedures?.periodontitis && t('procPeriodontitis'),
              v.procedures?.filling && t('procFilling'),
              v.procedures?.endo && t('procEndo'),
              v.procedures?.extraction && t('procExtraction'),
              v.procedures?.resection && t('procResection'),
              v.procedures?.crown && t('procCrown'),
              v.procedures?.implant && t('procImplant'),
              v.procedures?.other && (v.procedures.otherText || t('procOther')),
            ].filter(Boolean);
            return (
              <div key={v.id || i} className="print-visit">
                <div className="print-visit-header">
                  {t('printVisitNum')} #{i + 1}
                  {v.date && ` — ${fmt(v.date)}`}
                  {v.doctor && ` | ${v.doctor}`}
                  {v.specialty && ` | ${v.specialty}`}
                </div>
                <table className="print-table">
                  <tbody>
                    {(v.teeth || []).length > 0 && (
                      <tr>
                        <td className="print-label">{t('printVisitTeeth')}</td>
                        <td>{v.teeth.filter(Boolean).join(', ') || '—'}</td>
                      </tr>
                    )}
                    {(v.diagnoses || []).length > 0 && (
                      <tr>
                        <td className="print-label" style={{ verticalAlign: 'top' }}>{t('printDiagSection')}</td>
                        <td>
                          {v.diagnoses.map((d, di) => {
                            const desc = d.descriptionRu || d.descriptionTj || '';
                            return (
                              <div key={d.id || di} style={{ marginBottom: 2 }}>
                                <strong>{d.icdCode}</strong>
                                {desc ? ` — ${desc}` : ''}
                                {d.toothNumber ? ` (${t('printDiagTooth')} ${d.toothNumber})` : ''}
                                {d.comment ? ` • ${d.comment}` : ''}
                              </div>
                            );
                          })}
                        </td>
                      </tr>
                    )}
                    {procLabels.length > 0 && (
                      <tr>
                        <td className="print-label">{t('printVisitProc')}</td>
                        <td>{procLabels.join(', ')}</td>
                      </tr>
                    )}
                    {(v.materials || []).length > 0 && (
                      <tr>
                        <td className="print-label">{t('printVisitMat')}</td>
                        <td>
                          {v.materials.map((m, mi) => (
                            <span key={mi}>
                              {m.name}{m.qty ? ` — ${m.qty}` : ''}{m.price ? ` × ${m.price} ${t('currency')}` : ''}
                              {mi < v.materials.length - 1 ? '; ' : ''}
                            </span>
                          ))}
                        </td>
                      </tr>
                    )}
                    {/* Financial totals excluded from medical PDF */}
                  </tbody>
                </table>
              </div>
            );
          })}
        </section>
      )}

      {/* 8b. Long-term treatment plan (no prices) */}
      {longTermPlan.length > 0 && (
        <section className="print-section">
          <div className="print-section-title">{t('treatPlanTitle')}</div>
          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>№</th>
                <th style={{ width: 70 }}>{t('planTooth')}</th>
                <th>{t('planDiagnosis')}</th>
                <th>{t('planSpecialty')}</th>
                <th style={{ width: 80 }}>{t('planPriority')}</th>
                <th>{t('planComment')}</th>
              </tr>
            </thead>
            <tbody>
              {longTermPlan.map((x, i) => (
                <tr key={x.id || i}>
                  <td style={{ textAlign: 'center', color: '#888' }}>{i + 1}</td>
                  <td>{x.tooth || '—'}</td>
                  <td>
                    {x.icd_code || x.icdCode
                      ? <span><strong>{x.icd_code || x.icdCode}</strong>{(x.icd_desc || x.icdDesc) ? ` — ${x.icd_desc || x.icdDesc}` : ''}</span>
                      : (x.diagnosis || '—')}
                  </td>
                  <td>{x.specialty || x.treatmentType || '—'}</td>
                  <td>{x.priority === 'urgent' ? t('priorityUrgent') : t('priorityPlanned')}</td>
                  <td>{x.comment || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 9. Specialized */}
      {p.specialized && p.specialized.profile && (
        <section className="print-section print-section--compact">
          <div className="print-section-title">{t('printSpec')}</div>
          <div className="print-spec-label">
            {specNames[p.specialized.profile] || p.specialized.profile}
          </div>
          {(() => {
            const prof = p.specialized.profile;
            const sd = p.specialized[prof] || {};
            const icdDesc = lang === 'tj' ? sd.icdDescTj : sd.icdDescRu;
            return (
              <table className="print-table">
                <tbody>
                  {sd.causativeTooth && (
                    <tr>
                      <td className="print-label">{t('specCausativeTooth')}</td>
                      <td>{sd.causativeTooth}</td>
                    </tr>
                  )}
                  {sd.icdCode && (
                    <tr>
                      <td className="print-label">{t('specIcdCode')}</td>
                      <td>
                        <strong>{sd.icdCode}</strong>
                        {icdDesc ? ` — ${icdDesc}` : ''}
                      </td>
                    </tr>
                  )}
                  {prof === 'therapy' && sd.complaints && (
                    <tr><td className="print-label">{t('specComplaints')}</td><td>{sd.complaints}</td></tr>
                  )}
                  {prof === 'therapy' && sd.thDiagnosis && (
                    <tr><td className="print-label">{t('specDiagnosis')}</td><td>{sd.thDiagnosis}</td></tr>
                  )}
                  {prof === 'therapy' && sd.fillingMaterial && (
                    <tr><td className="print-label">{t('specFillingMaterial')}</td><td>{sd.fillingMaterial}</td></tr>
                  )}
                  {prof === 'surgery' && sd.surType && (
                    <tr>
                      <td className="print-label">{t('printLabelSurType')}</td>
                      <td>{sd.surType}</td>
                    </tr>
                  )}
                  {prof === 'surgery' && sd.anesDrug && (
                    <tr>
                      <td className="print-label">{t('printLabelAnes')}</td>
                      <td>
                        {sd.anesType} — {sd.anesDrug} {sd.anesDose} {t('printAnesMl')}
                      </td>
                    </tr>
                  )}
                  {prof === 'surgery' && sd.operationCourse && (
                    <tr>
                      <td className="print-label">{t('printLabelOpCourse')}</td>
                      <td>{sd.operationCourse}</td>
                    </tr>
                  )}
                  {prof === 'surgery' && sd.postOpOrders && (
                    <tr>
                      <td className="print-label">{t('printLabelPostOp')}</td>
                      <td>{sd.postOpOrders}</td>
                    </tr>
                  )}
                  {prof === 'ortho' && sd.prosthType && (
                    <tr><td className="print-label">{t('specProsthType')}</td><td>{sd.prosthType}</td></tr>
                  )}
                  {prof === 'pediatric' && sd.parentName && (
                    <tr><td className="print-label">{t('specParentName')}</td><td>{sd.parentName}</td></tr>
                  )}
                  {prof === 'pediatric' && sd.pedDiagnosis && (
                    <tr><td className="print-label">{t('specPedDiag')}</td><td>{sd.pedDiagnosis}</td></tr>
                  )}
                </tbody>
              </table>
            );
          })()}
        </section>
      )}

      {/* 10. Legal */}
      {p.legal && (
        <section className="print-section print-section--compact">
          <div className="print-section-title">{t('printLegal')}</div>
          <table className="print-table">
            <tbody>
              {p.legal.pretreatmentDesc && (
                <tr>
                  <td className="print-label">{t('printLabelPretreat')}</td>
                  <td>{p.legal.pretreatmentDesc}</td>
                </tr>
              )}
              <tr>
                <td className="print-label">{t('printLabelWarned')}</td>
                <td>
                  {[
                    p.legal.compPain && t('warnPain'),
                    p.legal.compSwelling && t('warnSwelling'),
                    p.legal.compBleeding && t('warnBleeding'),
                    p.legal.compSensitivity && t('warnSensitivity'),
                    p.legal.compRetreatment && t('warnRetreat'),
                    p.legal.compAnatomy && t('warnAnatomy'),
                    p.legal.compNoncompliance && t('warnNoncomp'),
                  ].filter(Boolean).join(', ') || '—'}
                </td>
              </tr>
              {p.legal.patientSignature && (
                <tr>
                  <td className="print-label">{t('printLabelPatSig')}</td>
                  <td>{p.legal.patientSignature}</td>
                </tr>
              )}
              {p.legal.doctorSignature && (
                <tr>
                  <td className="print-label">{t('printLabelDocSig')}</td>
                  <td>{p.legal.doctorSignature}</td>
                </tr>
              )}
              {p.legal.signDate && (
                <tr>
                  <td className="print-label">{t('printLabelDate')}</td>
                  <td>{fmt(p.legal.signDate)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* 11. Visit log — clinical data only (no financials) */}
      {visits.length > 0 && (
        <section className="print-section">
          <div className="print-section-title">{t('printVisits')}</div>
          {visits.map((v, i) => (
            <div key={v.id} className="print-visit">
              <div className="print-visit-header">
                {t('visitLabel')} {i + 1} — {fmt(v.date)} {v.time && `в ${v.time}`}
                {v.doctor && ` | ${t('visitDoctor')} ${v.doctor}`}
                {v.specialty && ` | ${v.specialty}`}
              </div>
              <table className="print-table">
                <tbody>
                  {v.complaints && (
                    <tr>
                      <td className="print-label">{t('visitComplaints')}</td>
                      <td>{v.complaints}</td>
                    </tr>
                  )}
                  {(v.manipulations || []).length > 0 && (
                    <tr>
                      <td className="print-label" style={{ verticalAlign: 'top' }}>{t('visitManipulations')}</td>
                      <td>
                        {v.manipulations.map((m, mi) => (
                          <div key={m.id || mi} style={{ marginBottom: 2 }}>
                            {m.tooth && <strong>{t('manipTooth')} {m.tooth}: </strong>}
                            {m.service}{m.action ? ` — ${m.action}` : ''}{m.comment ? ` (${m.comment})` : ''}
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                  {v.treatmentSteps && !(v.manipulations || []).length && (
                    <tr>
                      <td className="print-label">{t('visitTreatment')}</td>
                      <td>{v.treatmentSteps}</td>
                    </tr>
                  )}
                  {v.anesType && (
                    <tr>
                      <td className="print-label">{t('visitAnesType')}</td>
                      <td>{v.anesType} {v.anesDrug && `— ${v.anesDrug}`} {v.anesDose && `${v.anesDose} ${t('printAnesMl')}`}</td>
                    </tr>
                  )}
                  {/* Financial data intentionally excluded from medical PDF */}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}

      {/* Signatures footer — table layout for reliable print positioning */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8mm', borderTop: '1.5pt solid #000', paddingTop: '3mm' }}>
        <tbody>
          <tr>
            <td style={{ width: '34%', verticalAlign: 'top', paddingTop: '3mm', fontSize: '9pt' }}>
              <div style={{ fontWeight: 600, marginBottom: '8mm' }}>{t('printFooterDocSig')}</div>
              <div style={{ borderBottom: '1pt solid #000', marginBottom: '1mm' }}>&nbsp;</div>
              <div style={{ fontSize: '7.5pt', textAlign: 'center', color: '#555' }}>(ФИО, подпись)</div>
            </td>
            <td style={{ width: '33%', verticalAlign: 'top', paddingTop: '3mm', fontSize: '9pt', textAlign: 'center' }}>
              <div style={{ fontWeight: 600, marginBottom: '8mm' }}>{t('printFooterPatSig')}</div>
              <div style={{ borderBottom: '1pt solid #000', marginBottom: '1mm' }}>&nbsp;</div>
              <div style={{ fontSize: '7.5pt', textAlign: 'center', color: '#555' }}>(ФИО, подпись)</div>
            </td>
            <td style={{ width: '33%', verticalAlign: 'top', paddingTop: '3mm', fontSize: '9pt', textAlign: 'right' }}>
              <div style={{ fontWeight: 600, marginBottom: '8mm' }}>{t('printFooterDate')}</div>
              <div style={{ borderBottom: '1pt solid #000', marginBottom: '1mm' }}>&nbsp;</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────── FINANCIAL PRINT CONTENT ─────────────── */
function FinancialPrintContent({ patient, visits: visitsProp, t }) {
  const p = norm(patient);

  function fmt(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('ru-RU'); } catch { return iso; }
  }

  const visits = visitsProp || p.visits || [];
  const treatmentPlan = p.treatmentPlan || [];

  // Calculate totals from visits (handles new manipulations structure + legacy)
  function calcVisitGrand(v) {
    // New structure: manipulations[]
    if ((v.manipulations || []).length > 0) {
      return (v.manipulations || []).reduce((s, m) => s + (parseFloat(m.price) || 0), 0);
    }
    // Legacy: toothEntries[]
    if ((v.toothEntries || []).length > 0) {
      return (v.toothEntries || []).reduce((sum, te) => {
        const pCost = (te.procedures || []).reduce((s, pr) => s + (parseFloat(pr.price) || 0), 0);
        const mCost = (te.materials || []).reduce((s, m) => s + ((parseFloat(m.qty) || 0) * (parseFloat(m.price) || 0)), 0);
        return sum + pCost + mCost;
      }, 0);
    }
    const matTotal = (v.materials || []).reduce((s, m) => s + ((parseFloat(m.qty) || 0) * (parseFloat(m.price) || 0)), 0);
    return (parseFloat(v.costProcedures) || parseFloat(v.costProc) || 0) +
           (parseFloat(v.costMaterials) || parseFloat(v.costMat) || matTotal);
  }

  const grandTotalAll = visits.reduce((s, v) => s + calcVisitGrand(v), 0);
  const grandPaidAll = visits.reduce((s, v) => s + (parseFloat(v.paid) || 0), 0);
  const grandBalanceAll = Math.max(0, grandTotalAll - grandPaidAll);

  // Also include treatmentPlan rows
  const planTotal = treatmentPlan.reduce((s, r) => s + (parseFloat(r.price) || 0), 0);

  const hasData = visits.length > 0 || treatmentPlan.length > 0;

  return (
    <div className="print-area">
      <div className="print-header">
        <div className="print-clinic">{t('printClinic')}</div>
        <div className="print-card-title">{t('financialPdfTitle')}</div>
        <div className="print-card-date">
          {p.full_name || '—'} | {t('financialGenerated')} {fmt(new Date().toISOString())}
        </div>
      </div>

      {!hasData && (
        <section className="print-section">
          <div style={{ color: '#888', fontStyle: 'italic' }}>{t('financialNoData')}</div>
        </section>
      )}

      {/* Visit-based financials */}
      {visits.length > 0 && (
        <section className="print-section">
          <div className="print-section-title">{t('printVisits')}</div>
          {visits.map((v, i) => {
            const total = calcVisitGrand(v);
            const paid = parseFloat(v.paid) || 0;
            const balance = Math.max(0, total - paid);

            return (
              <div key={v.id || i} className="print-visit">
                <div className="print-visit-header">
                  {t('financialVisit')} #{i + 1}
                  {v.date && ` — ${fmt(v.date)}`}
                  {v.doctor && ` | ${v.doctor}`}
                </div>
                <table className="print-table">
                  <tbody>
                    {/* New structure: manipulations */}
                    {(v.manipulations || []).length > 0 && v.manipulations.map((m, mi) => (
                      parseFloat(m.price) > 0 ? (
                        <tr key={m.id || mi}>
                          <td className="print-label">
                            {m.tooth ? `${t('manipTooth')} ${m.tooth}: ` : ''}{m.service || m.action || '—'}
                          </td>
                          <td>{Number(m.price).toLocaleString('ru-RU')} {t('currency')}</td>
                        </tr>
                      ) : null
                    ))}
                    {/* Legacy: toothEntries */}
                    {!(v.manipulations || []).length && (v.toothEntries || []).length > 0 && (
                      v.toothEntries.map((te, tei) => {
                        const teProcCost = (te.procedures || []).reduce((s, pr) => s + (parseFloat(pr.price) || 0), 0);
                        const teMatCost = (te.materials || []).reduce((s, m) => s + ((parseFloat(m.qty) || 0) * (parseFloat(m.price) || 0)), 0);
                        const teTotal = teProcCost + teMatCost;
                        return teTotal > 0 ? (
                          <tr key={te.id || tei}>
                            <td className="print-label">{t('financialToothNum')} {te.toothNumber || (tei + 1)}</td>
                            <td>{teTotal.toLocaleString('ru-RU')} {t('currency')}</td>
                          </tr>
                        ) : null;
                      })
                    )}
                    <tr>
                      <td className="print-label" style={{ fontWeight: 700 }}>{t('financialGrandTotal')}</td>
                      <td style={{ fontWeight: 700 }}>{total.toLocaleString('ru-RU')} {t('currency')}</td>
                    </tr>
                    {paid > 0 && (
                      <tr>
                        <td className="print-label">{t('financialPaid')}</td>
                        <td>{paid.toLocaleString('ru-RU')} {t('currency')}</td>
                      </tr>
                    )}
                    {balance > 0 && (
                      <tr>
                        <td className="print-label">{t('financialBalance')}</td>
                        <td>{balance.toLocaleString('ru-RU')} {t('currency')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}
        </section>
      )}

      {/* Treatment plan financials */}
      {treatmentPlan.length > 0 && planTotal > 0 && (
        <section className="print-section">
          <div className="print-section-title">{t('treatPlanCard')}</div>
          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>№</th>
                <th>{t('financialTreatType')}</th>
                <th style={{ width: 120 }}>{t('financialPrice')}</th>
              </tr>
            </thead>
            <tbody>
              {treatmentPlan.map((row, i) => (
                <tr key={i}>
                  <td style={{ textAlign: 'center', color: '#888' }}>{i + 1}</td>
                  <td>{row.treatment || '—'}</td>
                  <td>{row.price ? `${Number(row.price).toLocaleString('ru-RU')} ${t('currency')}` : '—'}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} style={{ fontWeight: 700, textAlign: 'right' }}>{t('financialGrandTotal')}</td>
                <td style={{ fontWeight: 700 }}>{planTotal.toLocaleString('ru-RU')} {t('currency')}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* Grand summary across all visits */}
      {visits.length > 0 && (
        <section className="print-section">
          <div className="print-section-title">{t('financialGrandTotal')}</div>
          <table className="print-table">
            <tbody>
              <tr>
                <td className="print-label" style={{ fontWeight: 700 }}>{t('financialGrandTotal')}</td>
                <td style={{ fontWeight: 700 }}>{grandTotalAll.toLocaleString('ru-RU')} {t('currency')}</td>
              </tr>
              <tr>
                <td className="print-label">{t('financialGrandPaid')}</td>
                <td>{grandPaidAll.toLocaleString('ru-RU')} {t('currency')}</td>
              </tr>
              <tr>
                <td className="print-label">{t('financialGrandBalance')}</td>
                <td style={{ color: grandBalanceAll > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                  {grandBalanceAll.toLocaleString('ru-RU')} {t('currency')}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      <div className="print-footer">
        <div className="print-sign-grid">
          <div className="print-sign-cell">
            <div className="print-sign-label">{t('printFooterDocSig')}</div>
            <div className="print-sign-line-blank"></div>
            <div className="print-sign-hint">(ФИО, подпись)</div>
          </div>
          <div className="print-sign-cell">
            <div className="print-sign-label">{t('printFooterPatSig')}</div>
            <div className="print-sign-line-blank"></div>
            <div className="print-sign-hint">(ФИО, подпись)</div>
          </div>
          <div className="print-sign-cell">
            <div className="print-sign-label">{t('printFooterDate')}</div>
            <div className="print-sign-line-blank"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrintCard({ patient }) {
  const { t, lang } = useLang();

  // Single state object — updated atomically to avoid two-render race condition
  // { mode: 'medical'|'financial'|null, data: patientObject|null, visits: [], longTermPlan: [] }
  const [printJob, setPrintJob] = useState({ mode: null, data: null, visits: [], longTermPlan: [] });
  // Live visits + plan loaded from Supabase for the preview
  const [liveVisits, setLiveVisits] = useState([]);
  const [livePlan, setLivePlan] = useState([]);

  useEffect(() => {
    if (!patient?.id) return;
    getVisitsByPatient(patient.id).then(v => setLiveVisits(v || []));
    getTreatmentPlanByPatient(patient.id).then(p => setLivePlan(p || []));
  }, [patient?.id]);
  const printPending = useRef(false);

  // ── Wait for React to fully paint #print-area, then trigger window.print() ──
  useEffect(() => {
    if (!printJob.mode || !printJob.data) return;
    if (printPending.current) return;
    printPending.current = true;

    // All data is already in state (from localStorage, no network call).
    // Double rAF + 250ms ensures the browser has fully painted #print-area
    // before window.print() is called. This prevents the 1-page / empty PDF
    // issue in Sandpack and on slower machines.
    let timerId;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        timerId = setTimeout(() => {
          window.print();
          setTimeout(() => {
            setPrintJob({ mode: null, data: null });
            printPending.current = false;
          }, 300);
        }, 250);
      });
    });

    return () => clearTimeout(timerId);
  }, [printJob]);

  async function loadAndPrint(mode) {
    if (!patient?.id) {
      alert('Нет данных для печати');
      return;
    }
    // Fetch latest patient + visits + plan from Supabase in parallel
    const [latest, visits, plan] = await Promise.all([
      getPatientById(patient.id),
      getVisitsByPatient(patient.id),
      getTreatmentPlanByPatient(patient.id),
    ]);
    printPending.current = false;
    setPrintJob({
      mode,
      data: latest || { ...patient },
      visits: visits || liveVisits,
      longTermPlan: plan || livePlan,
    });
  }

  if (!patient) {
    return <div className="print-no-data">{t('noName')}</div>;
  }

  const displayPatient = printJob.data || patient;

  return (
    <div>
      {/* Print buttons */}
      <div className="print-actions">
        <button className="btn-save" onClick={() => loadAndPrint('medical')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: 'middle' }}>
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          {t('printBtn')}
        </button>
        <button className="btn-nav" style={{ marginLeft: '0.5rem' }} onClick={() => loadAndPrint('financial')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: 'middle' }}>
            <line x1="12" y1="1" x2="12" y2="23"/>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          {t('financialPdfBtn')}
        </button>
      </div>

      {/* Screen preview — always visible (medical view) */}
      <PrintContent patient={displayPatient} visits={liveVisits} longTermPlan={livePlan} t={t} lang={lang} />

      {/* Print area — mounted when print job is active; hidden on screen via CSS */}
      {printJob.mode === 'medical' && printJob.data && (
        <div id="print-area">
          <PrintContent patient={printJob.data} visits={printJob.visits} longTermPlan={printJob.longTermPlan} t={t} lang={lang} />
        </div>
      )}
      {printJob.mode === 'financial' && printJob.data && (
        <div id="print-area">
          <FinancialPrintContent patient={printJob.data} visits={printJob.visits} t={t} />
        </div>
      )}
    </div>
  );
}

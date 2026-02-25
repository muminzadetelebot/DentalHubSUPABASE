import { useState } from 'react';

// Standard FDI 2-digit tooth numbering
// Upper jaw: 18-11 (right→left for patient) | 21-28
// Lower jaw: 48-41 (right→left for patient) | 31-38
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT  = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const LOWER_LEFT  = [31, 32, 33, 34, 35, 36, 37, 38];

const STATUS_OPTIONS = [
  { value: '',      label: '—',  title: 'Холӣ' },
  { value: 'C',     label: 'C',  title: 'Кариес' },
  { value: 'P',     label: 'P',  title: 'Пломба' },
  { value: 'Cr',    label: 'Cr', title: 'Корона' },
  { value: 'Pt',    label: 'Pt', title: 'Протез' },
  { value: 'R',     label: 'R',  title: 'Реставрация' },
  { value: 'E',     label: 'E',  title: 'Кашида шуд' },
  { value: 'I',     label: 'I',  title: 'Имплант' },
];

const STATUS_COLORS = {
  '':   '#ffffff',
  'C':  '#ff6b6b',
  'P':  '#74b9ff',
  'Cr': '#a29bfe',
  'Pt': '#fd79a8',
  'R':  '#55efc4',
  'E':  '#b2bec3',
  'I':  '#fdcb6e',
};

function ToothCell({ num, status, onClick }) {
  const bg = STATUS_COLORS[status] || '#ffffff';
  const isExtracted = status === 'E';
  return (
    <div className="tooth-cell" onClick={() => onClick(num)} title={`Дандон ${num}`}>
      <div
        className={`tooth-box${isExtracted ? ' tooth-box--extracted' : ''}`}
        style={{ background: bg }}
      >
        {status ? (
          <span className="tooth-code">{status}</span>
        ) : null}
      </div>
      <div className="tooth-num">{num}</div>
    </div>
  );
}

export default function Odontogram({ value, onChange }) {
  const [selected, setSelected] = useState(null); // tooth number being edited

  function getStatus(num) {
    return value[num] || '';
  }

  function setStatus(num, st) {
    onChange({ ...value, [num]: st });
    setSelected(null);
  }

  function handleClick(num) {
    setSelected(selected === num ? null : num);
  }

  const selectedStatus = selected ? getStatus(selected) : '';

  return (
    <div className="odontogram">
      <div className="odonto-legend">
        {STATUS_OPTIONS.filter(o => o.value).map(o => (
          <span key={o.value} className="odonto-legend-item">
            <span className="odonto-legend-dot" style={{ background: STATUS_COLORS[o.value] }}></span>
            {o.value} — {o.title}
          </span>
        ))}
      </div>

      <div className="odonto-jaw odonto-jaw--upper">
        <div className="odonto-label">Боло (Верхняя)</div>
        <div className="odonto-row">
          {UPPER_RIGHT.map(n => (
            <ToothCell key={n} num={n} status={getStatus(n)} onClick={handleClick} />
          ))}
          <div className="odonto-midline"></div>
          {UPPER_LEFT.map(n => (
            <ToothCell key={n} num={n} status={getStatus(n)} onClick={handleClick} />
          ))}
        </div>
      </div>

      <div className="odonto-gap"></div>

      <div className="odonto-jaw odonto-jaw--lower">
        <div className="odonto-label">Поён (Нижняя)</div>
        <div className="odonto-row">
          {LOWER_RIGHT.map(n => (
            <ToothCell key={n} num={n} status={getStatus(n)} onClick={handleClick} />
          ))}
          <div className="odonto-midline"></div>
          {LOWER_LEFT.map(n => (
            <ToothCell key={n} num={n} status={getStatus(n)} onClick={handleClick} />
          ))}
        </div>
      </div>

      {selected && (
        <div className="odonto-picker">
          <div className="odonto-picker-title">Дандон {selected} — Ҳолат интихоб кунед:</div>
          <div className="odonto-picker-opts">
            {STATUS_OPTIONS.map(o => (
              <button
                key={o.value}
                className={`odonto-opt${selectedStatus === o.value ? ' odonto-opt--active' : ''}`}
                style={{ '--dot': STATUS_COLORS[o.value] }}
                onClick={() => setStatus(selected, o.value)}
              >
                <span className="odonto-opt-dot" style={{ background: STATUS_COLORS[o.value] }}></span>
                {o.value || '—'} <span className="odonto-opt-sub">{o.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="odonto-summary">
        {Object.entries(value).filter(([, v]) => v).length === 0
          ? <span className="text-muted">Ягон дандон қайд нашудааст</span>
          : Object.entries(STATUS_COLORS).filter(([k]) => k).map(([code]) => {
              const teeth = Object.entries(value).filter(([, v]) => v === code).map(([k]) => k);
              if (!teeth.length) return null;
              const opt = STATUS_OPTIONS.find(o => o.value === code);
              return (
                <span key={code} className="odonto-sum-item">
                  <span className="odonto-legend-dot" style={{ background: STATUS_COLORS[code] }}></span>
                  {opt?.title}: {teeth.join(', ')}
                </span>
              );
            })
        }
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import ICD10_DENTAL from '../utils/icd10Dental';

/**
 * Reusable ICD-10 code search input with autocomplete dropdown.
 * Props:
 *   value      – current icdCode string
 *   lang       – 'ru' | 'tj'
 *   onChange   – fn({ icdCode, descriptionRu, descriptionTj })
 *   placeholder – optional
 */
export default function IcdSearchInput({ value, lang, onChange, placeholder }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Sync external value resets (e.g. form clear)
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    function handle(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const filtered = query.trim().length >= 1
    ? ICD10_DENTAL.filter(item => {
        const q = query.toLowerCase();
        return (
          item.code.toLowerCase().includes(q) ||
          item.ru.toLowerCase().includes(q) ||
          item.tj.toLowerCase().includes(q)
        );
      }).slice(0, 10)
    : [];

  function select(item) {
    setQuery(item.code);
    setOpen(false);
    onChange({ icdCode: item.code, descriptionRu: item.ru, descriptionTj: item.tj });
  }

  function handleInput(e) {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    const exact = ICD10_DENTAL.find(i => i.code.toLowerCase() === val.toLowerCase());
    if (exact) {
      onChange({ icdCode: exact.code, descriptionRu: exact.ru, descriptionTj: exact.tj });
    } else {
      onChange({ icdCode: val, descriptionRu: '', descriptionTj: '' });
    }
  }

  return (
    <div className="icd-code-wrap" ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        className="icd-code-input"
        placeholder={placeholder || 'K02.1...'}
        value={query}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="icd-dropdown">
          {filtered.map(item => (
            <div key={item.code} className="icd-dropdown-item" onMouseDown={() => select(item)}>
              <span className="icd-item-code">{item.code}</span>
              <span className="icd-item-desc">{lang === 'tj' ? item.tj : item.ru}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

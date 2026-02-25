import { useState, useCallback, useEffect } from 'react';
import { useLang } from '../context/LangContext';
import {
  getTodayQueue, addToQueue, updateQueueEntry, deleteQueueEntry, getPatients,
} from '../utils/storage';

const STATUS_COLORS = {
  waiting:   '#d97706',
  serving:   '#16a34a',
  done:      '#6b7280',
  cancelled: '#dc2626',
};

function statusLabel(status, t) {
  const map = {
    waiting:   t('queueStatusWaiting'),
    serving:   t('queueStatusServing'),
    done:      t('queueStatusDone'),
    cancelled: t('queueStatusCancelled'),
  };
  return map[status] || status;
}

function fmt(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

export default function LiveQueue({ onClose, session }) {
  const { t } = useLang();
  const [queue, setQueue] = useState(() => getTodayQueue());
  const [phone, setPhone] = useState('');
  const [searchMsg, setSearchMsg] = useState(null); // { type: 'ok'|'new'|'err', text }
  const [foundPatient, setFoundPatient] = useState(null);
  const [allPatients, setAllPatients] = useState([]);

  // Load patients once from Supabase
  useEffect(() => {
    getPatients().then(data => setAllPatients(data || []));
  }, []);

  const refresh = useCallback(() => setQueue(getTodayQueue()), []);

  // ── phone search ──────────────────────────────────────────────
  function handlePhoneChange(val) {
    setPhone(val);
    setSearchMsg(null);
    setFoundPatient(null);
    if (val.trim().length >= 5) {
      const found = allPatients.find(p => (p.phone || '').replace(/\D/g, '').includes(val.replace(/\D/g, '')));
      if (found) {
        setFoundPatient(found);
        setSearchMsg({ type: 'ok', text: `${t('queuePhoneFound')}: ${found.fullName || found.name || ''}` });
      } else {
        setSearchMsg({ type: 'new', text: t('queuePhoneNotFound') });
      }
    }
  }

  function handleAdd() {
    if (!phone.trim()) {
      setSearchMsg({ type: 'err', text: t('queueNoPhone') });
      return;
    }
    addToQueue(phone.trim(), foundPatient?.id || null, foundPatient?.fullName || foundPatient?.name || null);
    const msg = foundPatient ? t('queueAdded') : t('queueAddedNew');
    setSearchMsg({ type: 'done', text: msg });
    setPhone('');
    setFoundPatient(null);
    refresh();
    setTimeout(() => setSearchMsg(null), 3000);
  }

  function handleStatus(id, status) {
    updateQueueEntry(id, { status });
    refresh();
  }

  function handleDelete(id) {
    if (!window.confirm(t('queueConfirmDelete'))) return;
    deleteQueueEntry(id);
    refresh();
  }

  // ── serving / next ──────────────────────────────────────────
  const serving = queue.find(q => q.status === 'serving');
  const waiting = queue.filter(q => q.status === 'waiting').sort((a, b) => a.queueNumber - b.queueNumber);
  const nextUp = waiting[0] || null;

  return (
    <div className="lq-root">
      {/* ── Toolbar ── */}
      <div className="lq-toolbar">
        <button className="cal-close-btn" onClick={onClose} title="Закрыть">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <span className="lq-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: 'middle' }}>
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          {t('queueTitle')}
        </span>

        {/* Now serving banner */}
        <div className="lq-serving-banner">
          {serving ? (
            <>
              <span className="lq-serving-label">{t('queueNowServing')} <strong className="lq-serving-num">#{serving.queueNumber}</strong></span>
              <span className="lq-serving-name">{serving.patientName || t('queueNewPatient')}</span>
            </>
          ) : (
            <span className="lq-serving-empty">{t('queueNone')}</span>
          )}
          {nextUp && (
            <span className="lq-next-badge">{t('queueNext')}: <strong>#{nextUp.queueNumber}</strong></span>
          )}
        </div>

        {/* Open display board button */}
        <button
          className="lq-display-btn"
          onClick={() => window.open(window.location.href.split('#')[0] + '#queue-display', '_blank', 'width=1280,height=720')}
          title={t('queueOpenDisplay')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          {t('queueOpenDisplay')}
        </button>
      </div>

      <div className="lq-body">
        {/* ── Add form ── */}
        <div className="lq-add-panel">
          <div className="lq-add-row">
            <div className="lq-phone-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lq-phone-icon">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <input
                type="tel"
                className="lq-phone-input"
                placeholder={t('queuePhonePh')}
                value={phone}
                onChange={e => handlePhoneChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <button className="lq-add-btn" onClick={handleAdd}>{t('queueAddBtn')}</button>
          </div>

          {searchMsg && (
            <div className={`lq-search-msg lq-search-msg--${searchMsg.type}`}>
              {searchMsg.type === 'ok' && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
              {searchMsg.type === 'new' && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              )}
              {searchMsg.text}
            </div>
          )}
        </div>

        {/* ── Queue table ── */}
        <div className="lq-table-wrap">
          {queue.length === 0 ? (
            <div className="lq-empty">{t('queueEmpty')}</div>
          ) : (
            <table className="lq-table">
              <thead>
                <tr>
                  <th>{t('queueColNum')}</th>
                  <th>{t('queueColPatient')}</th>
                  <th>{t('queueColPhone')}</th>
                  <th>{t('queueTime')}</th>
                  <th>{t('queueColStatus')}</th>
                  <th>{t('queueColActions')}</th>
                </tr>
              </thead>
              <tbody>
                {[...queue].sort((a, b) => a.queueNumber - b.queueNumber).map(entry => (
                  <tr key={entry.id} className={`lq-row lq-row--${entry.status}`}>
                    <td>
                      <span className="lq-num-badge" style={{ background: STATUS_COLORS[entry.status] || '#1a73e8' }}>
                        #{entry.queueNumber}
                      </span>
                    </td>
                    <td>
                      <span className="lq-patient-name">
                        {entry.patientName || t('queueNewPatient')}
                      </span>
                      {entry.isNewPatient && (
                        <span className="lq-new-badge">{t('queueNewPatient')}</span>
                      )}
                    </td>
                    <td className="lq-phone-cell">{entry.phone || '—'}</td>
                    <td className="lq-time-cell">{fmt(entry.createdAt)}</td>
                    <td>
                      <span className="lq-status-chip" style={{
                        background: (STATUS_COLORS[entry.status] || '#1a73e8') + '22',
                        color: STATUS_COLORS[entry.status] || '#1a73e8',
                        borderColor: STATUS_COLORS[entry.status] || '#1a73e8',
                      }}>
                        {statusLabel(entry.status, t)}
                      </span>
                    </td>
                    <td>
                      <div className="lq-actions">
                        {entry.status === 'waiting' && (
                          <button className="lq-btn lq-btn--accept"
                            onClick={() => handleStatus(entry.id, 'serving')}
                            title={t('queueAccept')}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                            {t('queueAccept')}
                          </button>
                        )}
                        {entry.status === 'serving' && (
                          <button className="lq-btn lq-btn--done"
                            onClick={() => handleStatus(entry.id, 'done')}
                            title={t('queueDone')}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            {t('queueDone')}
                          </button>
                        )}
                        {(entry.status === 'waiting' || entry.status === 'serving') && (
                          <button className="lq-btn lq-btn--cancel"
                            onClick={() => handleStatus(entry.id, 'cancelled')}
                            title={t('queueCancel')}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                            {t('queueCancel')}
                          </button>
                        )}
                        {session?.role === 'admin' && (
                          <button className="lq-btn lq-btn--delete"
                            onClick={() => handleDelete(entry.id)}
                            title={t('queueDelete')}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              <path d="M10 11v6"/><path d="M14 11v6"/>
                              <path d="M9 6V4h6v2"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

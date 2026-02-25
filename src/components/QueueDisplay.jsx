import { useState, useEffect, useRef } from 'react';
import { getTodayQueue } from '../utils/storage';

// ── Web Audio bell ──────────────────────────────────────────────
function playBell() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Ding tone: 880 Hz sine, decaying
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.2);
    // Second overtone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.setValueAtTime(1320, ctx.currentTime);
    gain2.gain.setValueAtTime(0.25, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.8);
  } catch {
    // AudioContext not available — silently skip
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getDisplayData() {
  const queue = getTodayQueue();
  const active = queue.filter(q => q.status !== 'cancelled');
  const serving = active.find(q => q.status === 'serving') || null;
  const waiting = active
    .filter(q => q.status === 'waiting')
    .sort((a, b) => a.queueNumber - b.queueNumber);
  const nextUp = waiting[0] || null;
  const displayList = active
    .filter(q => q.status !== 'done')
    .sort((a, b) => a.queueNumber - b.queueNumber);
  return { serving, nextUp, displayList };
}

function statusLabel(status) {
  const map = {
    waiting: 'Ожидает',
    serving: 'Идёт приём',
    done: 'Завершён',
    cancelled: 'Отменён',
  };
  return map[status] || status;
}

function fmt(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export default function QueueDisplay() {
  const [data, setData] = useState(() => getDisplayData());
  const [flash, setFlash] = useState(false); // green flash when number changes
  const prevServingRef = useRef(data.serving?.queueNumber ?? null);
  const [time, setTime] = useState(() => new Date());

  // Poll every 3 seconds
  useEffect(() => {
    const tick = setInterval(() => {
      const fresh = getDisplayData();
      const prevNum = prevServingRef.current;
      const newNum = fresh.serving?.queueNumber ?? null;

      // Detect change in serving number — play bell + flash
      if (newNum !== null && newNum !== prevNum) {
        playBell();
        setFlash(true);
        setTimeout(() => setFlash(false), 1000);
      }
      prevServingRef.current = newNum;
      setData(fresh);
    }, 3000);

    // Clock tick every second
    const clockTick = setInterval(() => setTime(new Date()), 1000);

    return () => {
      clearInterval(tick);
      clearInterval(clockTick);
    };
  }, []);

  const { serving, nextUp, displayList } = data;

  const dateStr = todayStr()
    ? new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    <div className="qd-root">
      {/* ── Header ── */}
      <div className="qd-header">
        <div className="qd-clinic-name">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C8.5 2 6 4.5 6 7c0 1.5.5 2.8 1.3 3.8L6 21h12l-1.3-10.2C17.5 9.8 18 8.5 18 7c0-2.5-2.5-5-6-5z"/>
          </svg>
          <span>Dr.Dentist.Data</span>
        </div>
        <div className="qd-datetime">
          <div className="qd-date">{dateStr}</div>
          <div className="qd-time">
            {time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </div>

      {/* ── Main calling area ── */}
      <div className="qd-main">
        {/* Current (serving) */}
        <div className={`qd-card qd-card--serving${flash ? ' qd-card--flash' : ''}`}>
          <div className="qd-card-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
              <line x1="6" y1="1" x2="6" y2="4"/>
              <line x1="10" y1="1" x2="10" y2="4"/>
              <line x1="14" y1="1" x2="14" y2="4"/>
            </svg>
          </div>
          <div className="qd-card-label">Сейчас вызывается</div>
          {serving ? (
            <>
              <div className="qd-number qd-number--serving">{serving.queueNumber}</div>
              <div className="qd-patient-name">{serving.patientName || 'Новый пациент'}</div>
            </>
          ) : (
            <div className="qd-number qd-number--empty">—</div>
          )}
        </div>

        {/* Next */}
        <div className="qd-card qd-card--next">
          <div className="qd-card-icon">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
          <div className="qd-card-label">Следующий</div>
          {nextUp ? (
            <>
              <div className="qd-number qd-number--next">{nextUp.queueNumber}</div>
              <div className="qd-patient-name qd-patient-name--muted">{nextUp.patientName || 'Новый пациент'}</div>
            </>
          ) : (
            <div className="qd-number qd-number--empty">—</div>
          )}
        </div>
      </div>

      {/* ── Queue list ── */}
      <div className="qd-list-section">
        <div className="qd-list-title">Очередь на сегодня</div>
        {displayList.length === 0 ? (
          <div className="qd-list-empty">Очередь пуста</div>
        ) : (
          <table className="qd-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Пациент</th>
                <th>Время</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map(entry => (
                <tr key={entry.id} className={`qd-row qd-row--${entry.status}`}>
                  <td>
                    <span className={`qd-num-chip qd-num-chip--${entry.status}`}>
                      {entry.queueNumber}
                    </span>
                  </td>
                  <td className="qd-name-cell">
                    {entry.patientName || 'Новый пациент'}
                  </td>
                  <td className="qd-time-cell">{fmt(entry.createdAt)}</td>
                  <td>
                    <span className={`qd-status-pill qd-status-pill--${entry.status}`}>
                      {statusLabel(entry.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="qd-footer">
        Обновляется автоматически каждые 3 секунды
      </div>
    </div>
  );
}

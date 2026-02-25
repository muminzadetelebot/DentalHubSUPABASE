import { useState, useEffect, useCallback } from 'react';
import { useLang } from '../context/LangContext';
import { getAppointments, upsertAppointment, deleteAppointment, getPatients } from '../utils/storage';
// getPatients is async (Supabase), used below with useEffect

// Working hours 09:00 – 18:00, 30-min slots
const HOURS_START = 9;
const HOURS_END = 18;
const SLOT_MINS = 30;
const TOTAL_SLOTS = ((HOURS_END - HOURS_START) * 60) / SLOT_MINS; // 18

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function getWeekDates(anchor) {
  const d = new Date(anchor);
  const day = d.getDay(); // 0=Sun
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((day + 6) % 7)); // Monday
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(mon);
    x.setDate(mon.getDate() + i);
    return x;
  });
}

function slotToTime(slotIdx) {
  const totalMin = HOURS_START * 60 + slotIdx * SLOT_MINS;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToSlot(timeStr) {
  if (!timeStr) return -1;
  const [h, m] = timeStr.split(':').map(Number);
  return Math.floor(((h - HOURS_START) * 60 + m) / SLOT_MINS);
}

const STATUS_COLORS = {
  booked: '#1a73e8',
  arrived: '#16a34a',
  noshow: '#dc2626',
  moved: '#d97706',
};

const EMPTY_APPT = (dateStr, timeStr) => ({
  id: makeId(),
  patientId: '',
  patientName: '',
  doctor: '',
  date: dateStr || toDateStr(new Date()),
  time: timeStr || '09:00',
  duration: 30,
  cabinet: '',
  comment: '',
  status: 'booked',
});

// ── Appointment Modal ────────────────────────────────────────────
function ApptModal({ appt, patients, onSave, onDelete, onClose, t }) {
  const [form, setForm] = useState({ ...appt });
  const [patientSearch, setPatientSearch] = useState('');
  const [showPList, setShowPList] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const filteredPatients = patientSearch.length >= 1
    ? patients.filter(p => {
        const name = (p.fullName || p.name || '').toLowerCase();
        return name.includes(patientSearch.toLowerCase());
      }).slice(0, 8)
    : [];

  function selectPatient(p) {
    set('patientId', p.id);
    set('patientName', p.fullName || p.name || '');
    setPatientSearch(p.fullName || p.name || '');
    setShowPList(false);
  }

  function handleSave(e) {
    e.preventDefault();
    if (!form.patientName.trim()) return;
    onSave({ ...form, patientName: form.patientName.trim() });
  }

  const STATUS_KEYS = ['booked', 'arrived', 'noshow', 'moved'];
  const STATUS_LABELS = {
    booked: t('statusBooked'),
    arrived: t('statusArrived'),
    noshow: t('statusNoShow'),
    moved: t('statusMoved'),
  };

  return (
    <div className="cal-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cal-modal-box">
        <div className="cal-modal-header">
          <span>{form.id && appt._existing ? t('apptEdit') : t('calNewAppt')}</span>
          <button className="cal-modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form className="cal-modal-form" onSubmit={handleSave}>
          {/* Patient */}
          <div className="form-group" style={{ position: 'relative' }}>
            <label>{t('apptPatient')} *</label>
            <input
              type="text"
              placeholder={t('apptPatientPh')}
              value={patientSearch || form.patientName}
              onChange={e => {
                setPatientSearch(e.target.value);
                set('patientName', e.target.value);
                set('patientId', '');
                setShowPList(true);
              }}
              onFocus={() => setShowPList(true)}
              autoComplete="off"
              required
            />
            {showPList && filteredPatients.length > 0 && (
              <div className="cal-patient-dropdown">
                {filteredPatients.map(p => (
                  <div key={p.id} className="cal-patient-item" onMouseDown={() => selectPatient(p)}>
                    <span className="cal-patient-name">{p.fullName || p.name}</span>
                    {p.phone && <span className="cal-patient-phone">{p.phone}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Doctor */}
          <div className="form-group">
            <label>{t('apptDoctor')}</label>
            <input type="text" placeholder={t('apptDoctorPh')} value={form.doctor}
              onChange={e => set('doctor', e.target.value)} />
          </div>

          {/* Date + Time row */}
          <div className="cal-modal-row">
            <div className="form-group">
              <label>{t('apptDate')}</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>{t('apptTime')}</label>
              <input type="time" value={form.time} min="09:00" max="18:00"
                onChange={e => set('time', e.target.value)} required />
            </div>
          </div>

          {/* Duration + Cabinet row */}
          <div className="cal-modal-row">
            <div className="form-group">
              <label>{t('apptDuration')}</label>
              <select value={form.duration} onChange={e => set('duration', Number(e.target.value))}>
                {[15, 20, 30, 45, 60, 90, 120].map(d => (
                  <option key={d} value={d}>{d} {t('apptDurationShort')}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('apptCabinet')}</label>
              <input type="text" placeholder={t('apptCabinetPh')} value={form.cabinet}
                onChange={e => set('cabinet', e.target.value)} />
            </div>
          </div>

          {/* Status */}
          <div className="form-group">
            <label>{t('apptStatus')}</label>
            <div className="cal-status-row">
              {STATUS_KEYS.map(s => (
                <button key={s} type="button"
                  className={`cal-status-btn${form.status === s ? ' cal-status-btn--active' : ''}`}
                  style={form.status === s ? { background: STATUS_COLORS[s], color: '#fff', borderColor: STATUS_COLORS[s] } : {}}
                  onClick={() => set('status', s)}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="form-group">
            <label>{t('apptComment')}</label>
            <textarea placeholder={t('apptCommentPh')} value={form.comment}
              onChange={e => set('comment', e.target.value)} rows={2} />
          </div>

          <div className="cal-modal-footer">
            {appt._existing && (
              <button type="button" className="btn-danger-sm"
                onClick={() => { if (window.confirm(t('apptConfirmDelete'))) onDelete(form.id); }}>
                {t('apptDelete')}
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" className="btn-cancel" onClick={onClose}>{t('apptCancel')}</button>
            <button type="submit" className="btn-save">{t('apptSave')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Today's patients sidebar ────────────────────────────────────
function TodaySidebar({ appts, t, onOpen }) {
  const sorted = [...appts].sort((a, b) => (a.time > b.time ? 1 : -1));
  return (
    <div className="cal-today-sidebar">
      <div className="cal-today-title">{t('todayPatients')}</div>
      {sorted.length === 0 && <div className="cal-today-empty">{t('noApptToday')}</div>}
      {sorted.map(a => (
        <div key={a.id} className="cal-today-item" onClick={() => onOpen(a)}>
          <span className="cal-today-time">{a.time}</span>
          <span className="cal-today-name">{a.patientName}</span>
          <span className="cal-today-badge" style={{ background: STATUS_COLORS[a.status] || STATUS_COLORS.booked }}>
            {a.duration}{t('apptDurationShort')}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Week grid ────────────────────────────────────────────────────
function WeekGrid({ weekDates, appts, t, onSlotClick, onApptClick }) {
  const DAY_NAMES_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const todayStr = toDateStr(new Date());

  // Build a map: dateStr -> list of appts
  const apptsByDate = {};
  weekDates.forEach(d => { apptsByDate[toDateStr(d)] = []; });
  appts.forEach(a => { if (apptsByDate[a.date]) apptsByDate[a.date].push(a); });

  const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) => i);

  return (
    <div className="cal-week-grid">
      {/* Header row */}
      <div className="cal-week-header">
        <div className="cal-time-col-hdr" />
        {weekDates.map((d, i) => {
          const ds = toDateStr(d);
          const isToday = ds === todayStr;
          return (
            <div key={ds} className={`cal-day-hdr${isToday ? ' cal-day-hdr--today' : ''}`}>
              <span className="cal-day-name">{DAY_NAMES_RU[i]}</span>
              <span className="cal-day-num">{d.getDate()}</span>
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div className="cal-week-body">
        {/* Time column */}
        <div className="cal-time-col">
          {slots.map(si => (
            <div key={si} className="cal-time-cell">{slotToTime(si)}</div>
          ))}
        </div>

        {/* Day columns */}
        {weekDates.map(d => {
          const ds = toDateStr(d);
          const dayAppts = apptsByDate[ds] || [];
          return (
            <div key={ds} className="cal-day-col">
              {slots.map(si => (
                <div key={si} className="cal-slot" onClick={() => onSlotClick(ds, slotToTime(si))} />
              ))}
              {/* Render appt blocks */}
              {dayAppts.map(a => {
                const slotIdx = timeToSlot(a.time);
                if (slotIdx < 0) return null;
                const slotsOccupied = Math.max(1, Math.ceil((a.duration || 30) / SLOT_MINS));
                const topPct = (slotIdx / TOTAL_SLOTS) * 100;
                const heightPct = (slotsOccupied / TOTAL_SLOTS) * 100;
                const color = STATUS_COLORS[a.status] || STATUS_COLORS.booked;
                return (
                  <div key={a.id} className="cal-appt-block"
                    style={{ top: `${topPct}%`, height: `${heightPct}%`, background: color, borderColor: color }}
                    onClick={e => { e.stopPropagation(); onApptClick(a); }}
                    title={`${a.time} — ${a.patientName}${a.doctor ? ' / ' + a.doctor : ''}`}>
                    <span className="cal-appt-time">{a.time}</span>
                    <span className="cal-appt-name">{a.patientName}</span>
                    {a.doctor && <span className="cal-appt-doc">{a.doctor}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Day grid ─────────────────────────────────────────────────────
function DayGrid({ dateStr, appts, t, onSlotClick, onApptClick }) {
  const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) => i);
  const dayAppts = appts.filter(a => a.date === dateStr);
  return (
    <div className="cal-day-grid">
      <div className="cal-week-body" style={{ gridTemplateColumns: '60px 1fr' }}>
        <div className="cal-time-col">
          {slots.map(si => (
            <div key={si} className="cal-time-cell">{slotToTime(si)}</div>
          ))}
        </div>
        <div className="cal-day-col" style={{ flex: 1 }}>
          {slots.map(si => (
            <div key={si} className="cal-slot" onClick={() => onSlotClick(dateStr, slotToTime(si))} />
          ))}
          {dayAppts.map(a => {
            const slotIdx = timeToSlot(a.time);
            if (slotIdx < 0) return null;
            const slotsOccupied = Math.max(1, Math.ceil((a.duration || 30) / SLOT_MINS));
            const topPct = (slotIdx / TOTAL_SLOTS) * 100;
            const heightPct = (slotsOccupied / TOTAL_SLOTS) * 100;
            const color = STATUS_COLORS[a.status] || STATUS_COLORS.booked;
            return (
              <div key={a.id} className="cal-appt-block"
                style={{ top: `${topPct}%`, height: `${heightPct}%`, background: color, borderColor: color }}
                onClick={e => { e.stopPropagation(); onApptClick(a); }}>
                <span className="cal-appt-time">{a.time}</span>
                <span className="cal-appt-name">{a.patientName}</span>
                {a.doctor && <span className="cal-appt-doc">{a.doctor}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Doctor view ───────────────────────────────────────────────────
function DoctorGrid({ dateStr, appts, t, onSlotClick, onApptClick }) {
  const dayAppts = appts.filter(a => a.date === dateStr);
  const doctors = [...new Set(dayAppts.map(a => a.doctor || '—'))].filter(Boolean);
  if (doctors.length === 0) {
    return <div className="cal-no-appts">{t('calNoAppts')}</div>;
  }
  const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) => i);
  return (
    <div className="cal-week-grid">
      <div className="cal-week-header">
        <div className="cal-time-col-hdr" />
        {doctors.map(doc => (
          <div key={doc} className="cal-day-hdr">
            <span className="cal-day-name">{doc}</span>
          </div>
        ))}
      </div>
      <div className="cal-week-body" style={{ gridTemplateColumns: `60px repeat(${doctors.length}, 1fr)` }}>
        <div className="cal-time-col">
          {slots.map(si => <div key={si} className="cal-time-cell">{slotToTime(si)}</div>)}
        </div>
        {doctors.map(doc => {
          const docAppts = dayAppts.filter(a => (a.doctor || '—') === doc);
          return (
            <div key={doc} className="cal-day-col">
              {slots.map(si => (
                <div key={si} className="cal-slot" onClick={() => onSlotClick(dateStr, slotToTime(si))} />
              ))}
              {docAppts.map(a => {
                const slotIdx = timeToSlot(a.time);
                if (slotIdx < 0) return null;
                const slotsOccupied = Math.max(1, Math.ceil((a.duration || 30) / SLOT_MINS));
                const topPct = (slotIdx / TOTAL_SLOTS) * 100;
                const heightPct = (slotsOccupied / TOTAL_SLOTS) * 100;
                const color = STATUS_COLORS[a.status] || STATUS_COLORS.booked;
                return (
                  <div key={a.id} className="cal-appt-block"
                    style={{ top: `${topPct}%`, height: `${heightPct}%`, background: color, borderColor: color }}
                    onClick={e => { e.stopPropagation(); onApptClick(a); }}>
                    <span className="cal-appt-time">{a.time}</span>
                    <span className="cal-appt-name">{a.patientName}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Calendar ────────────────────────────────────────────────
export default function AppointmentCalendar({ onClose }) {
  const { t } = useLang();
  const [view, setView] = useState('week'); // 'week' | 'day' | 'doctor'
  const [anchor, setAnchor] = useState(new Date());
  const [appts, setAppts] = useState(() => getAppointments());
  const [patients, setPatients] = useState([]);
  const [modal, setModal] = useState(null); // null | appt object

  const todayStr = toDateStr(new Date());
  const todayAppts = appts.filter(a => a.date === todayStr);
  const weekDates = getWeekDates(anchor);
  const anchorStr = toDateStr(anchor);

  // Load patients async from Supabase
  useEffect(() => {
    getPatients().then(data => setPatients(data || []));
  }, []);

  const refresh = useCallback(() => {
    setAppts(getAppointments());
    getPatients().then(data => setPatients(data || []));
  }, []);

  function openNew(dateStr, timeStr) {
    setModal({ ...EMPTY_APPT(dateStr, timeStr), _existing: false });
  }

  function openEdit(appt) {
    setModal({ ...appt, _existing: true });
  }

  function handleSave(appt) {
    const { _existing, ...data } = appt;
    upsertAppointment(data);
    refresh();
    setModal(null);
  }

  function handleDelete(id) {
    deleteAppointment(id);
    refresh();
    setModal(null);
  }

  function goPrev() {
    const d = new Date(anchor);
    if (view === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setAnchor(d);
  }

  function goNext() {
    const d = new Date(anchor);
    if (view === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setAnchor(d);
  }

  function goToday() { setAnchor(new Date()); }

  const MONTH_NAMES = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

  function rangeLabel() {
    if (view === 'week') {
      const first = weekDates[0];
      const last = weekDates[6];
      if (first.getMonth() === last.getMonth()) {
        return `${first.getDate()} – ${last.getDate()} ${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`;
      }
      return `${first.getDate()} ${MONTH_NAMES[first.getMonth()]} – ${last.getDate()} ${MONTH_NAMES[last.getMonth()]} ${first.getFullYear()}`;
    }
    return `${anchor.getDate()} ${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
  }

  return (
    <div className="cal-root">
      {/* Toolbar */}
      <div className="cal-toolbar">
        <button className="cal-close-btn" onClick={onClose} title="Закрыть">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <span className="cal-title">{t('calendarTitle')}</span>

        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={goPrev}>{t('calPrevWeek')}</button>
          <button className="cal-today-btn" onClick={goToday}>{t('calToday')}</button>
          <button className="cal-nav-btn" onClick={goNext}>{t('calNextWeek')}</button>
        </div>

        <span className="cal-range-label">{rangeLabel()}</span>

        <div className="cal-view-tabs">
          {[['week', t('calWeekView')], ['day', t('calDayView')], ['doctor', t('calDoctorView')]].map(([v, label]) => (
            <button key={v} className={`cal-view-tab${view === v ? ' cal-view-tab--active' : ''}`}
              onClick={() => setView(v)}>{label}</button>
          ))}
        </div>

        <button className="btn-new-appt" onClick={() => openNew(view === 'week' ? todayStr : anchorStr, '09:00')}>
          {t('calNewAppt')}
        </button>
      </div>

      <div className="cal-body">
        {/* Today sidebar */}
        <TodaySidebar appts={todayAppts} t={t} onOpen={openEdit} />

        {/* Grid area */}
        <div className="cal-grid-area">
          {view === 'week' && (
            <WeekGrid weekDates={weekDates} appts={appts} t={t}
              onSlotClick={openNew} onApptClick={openEdit} />
          )}
          {view === 'day' && (
            <DayGrid dateStr={anchorStr} appts={appts} t={t}
              onSlotClick={openNew} onApptClick={openEdit} />
          )}
          {view === 'doctor' && (
            <DoctorGrid dateStr={anchorStr} appts={appts} t={t}
              onSlotClick={openNew} onApptClick={openEdit} />
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <ApptModal
          appt={modal}
          patients={patients}
          t={t}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

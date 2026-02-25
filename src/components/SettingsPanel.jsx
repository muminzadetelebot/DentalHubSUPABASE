import { useState, useEffect } from 'react';
import { useLang } from '../context/LangContext';
import {
  getUsers, createUser, updateUser, setUserPassword,
  toggleUserActive, verifyPassword, generateOtp, verifyOtp,
  addAuditEntry, getAuditLog,
} from '../utils/userStorage';

// ── Small helpers ────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('ru-RU'); } catch { return iso; }
}

// ── Role badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  return (
    <span className={`role-badge role-badge--${role === 'registrar' ? 'reg' : role}`}>
      {role}
    </span>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="settings-overlay" onClick={onCancel}>
      <div className="settings-dialog settings-dialog--sm" onClick={e => e.stopPropagation()}>
        <div className="settings-dialog-header">
          <span>Подтверждение</span>
        </div>
        <div className="settings-dialog-body">
          <p style={{ marginBottom: '1.25rem', lineHeight: 1.6 }}>{message}</p>
          <div className="settings-row-btns">
            <button className="settings-btn settings-btn--danger" onClick={onConfirm}>Да, подтвердить</button>
            <button className="settings-btn settings-btn--ghost" onClick={onCancel}>Отмена</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add / Edit User Modal ────────────────────────────────────────────────────
function UserFormModal({ user, session, onSave, onClose }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    name: user?.name || '',
    username: user?.username || '',
    phone: user?.phone || '',
    email: user?.email || '',
    role: user?.role || 'doctor',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');

  function patch(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function handleSave() {
    setError('');
    if (!form.name.trim()) { setError('Введите имя'); return; }
    if (!form.username.trim()) { setError('Введите username'); return; }
    if (!isEdit && !form.password) { setError('Введите пароль'); return; }
    if (!isEdit && form.password !== form.confirmPassword) {
      setError('Пароли не совпадают'); return;
    }
    try {
      if (isEdit) {
        const updated = updateUser(user.id, {
          name: form.name.trim(),
          username: form.username.trim().toLowerCase(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          role: form.role,
        });
        addAuditEntry({
          action: 'user_edited',
          actorId: session.id,
          actorName: session.name || session.login,
          targetId: user.id,
          targetName: form.name,
          details: "Редактирование профиля",
        });
        onSave(updated);
      } else {
        const created = createUser({
          name: form.name.trim(),
          username: form.username.trim().toLowerCase(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          role: form.role,
          password: form.password,
          clinicId: session.clinicId || 'clinic_default',
        });
        addAuditEntry({
          action: 'user_created',
          actorId: session.id,
          actorName: session.name || session.login,
          targetId: created.id,
          targetName: form.name,
          details: "Создан новый пользователь",
        });
        onSave(created);
      }
    } catch (err) {
      if (err.message === 'USERNAME_TAKEN') {
        setError('Этот username уже занят');
      } else {
        setError(err.message);
      }
    }
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-dialog" onClick={e => e.stopPropagation()}>
        <div className="settings-dialog-header">
          <span>{isEdit ? 'Редактировать пользователя' : 'Добавить пользователя'}</span>
          <button className="settings-close-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="settings-dialog-body">
          <div className="settings-form-grid">
            <div className="form-group">
              <label>Имя *</label>
              <input value={form.name} onChange={e => patch('name', e.target.value)} placeholder="Полное имя..." />
            </div>
            <div className="form-group">
              <label>Username *</label>
              <input value={form.username} onChange={e => patch('username', e.target.value)} placeholder="Логин..." />
            </div>
            <div className="form-group">
              <label>Телефон</label>
              <input value={form.phone} onChange={e => patch('phone', e.target.value)} placeholder="+992..." />
            </div>
            <div className="form-group">
              <label>Email / Gmail</label>
              <input value={form.email} onChange={e => patch('email', e.target.value)} placeholder="user@gmail.com" />
            </div>
            <div className="form-group">
              <label>Роль *</label>
              <select value={form.role} onChange={e => patch('role', e.target.value)}>
                <option value="admin">Администратор</option>
                <option value="doctor">Врач</option>
                <option value="registrar">Регистратор</option>
              </select>
            </div>
            {!isEdit && (
              <>
                <div className="form-group">
                  <label>Пароль *</label>
                  <input type="password" value={form.password} onChange={e => patch('password', e.target.value)} placeholder="Минимум 6 символов..." />
                </div>
                <div className="form-group">
                  <label>Подтвердить пароль *</label>
                  <input type="password" value={form.confirmPassword} onChange={e => patch('confirmPassword', e.target.value)} placeholder="Повторите пароль..." />
                </div>
              </>
            )}
          </div>
          {error && <div className="settings-error">{error}</div>}
          <div className="settings-row-btns" style={{ marginTop: '1rem' }}>
            <button className="settings-btn settings-btn--primary" onClick={handleSave}>
              {isEdit ? 'Сохранить' : 'Создать'}
            </button>
            <button className="settings-btn settings-btn--ghost" onClick={onClose}>Отмена</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Change Password Modal (with OTP flow) ────────────────────────────────────
function ChangePasswordModal({ user, session, onClose }) {
  // step: 'method' | 'otp' | 'newpw' | 'done'
  const [step, setStep] = useState('method');
  const [method, setMethod] = useState('phone'); // 'phone' | 'email'
  const [otpCode, setOtpCode] = useState('');
  const [demoCode, setDemoCode] = useState(''); // shown in demo mode
  const [otpError, setOtpError] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');

  // Admin changing another user's password skips OTP
  const skipOtp = session.id !== String(user.id);

  function handleSendOtp() {
    const code = generateOtp(user.id);
    setDemoCode(code);
    setStep('otp');
  }

  function handleVerifyOtp() {
    setOtpError('');
    if (verifyOtp(user.id, otpCode)) {
      setStep('newpw');
    } else {
      setOtpError('Неверный код или срок действия истёк');
    }
  }

  function handleSetPassword() {
    setPwError('');
    if (!newPw) { setPwError('Введите новый пароль'); return; }
    if (newPw.length < 6) { setPwError('Пароль должен быть не менее 6 символов'); return; }
    if (newPw !== confirmPw) { setPwError('Пароли не совпадают'); return; }
    setUserPassword(user.id, newPw);
    addAuditEntry({
      action: 'password_changed',
      actorId: session.id,
      actorName: session.name || session.login,
      targetId: user.id,
      targetName: user.name,
      details: skipOtp ? 'Администратор сменил пароль' : 'Пользователь сменил пароль через OTP',
    });
    setStep('done');
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-dialog settings-dialog--sm" onClick={e => e.stopPropagation()}>
        <div className="settings-dialog-header">
          <span>Смена пароля — {user.name}</span>
          <button className="settings-close-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="settings-dialog-body">
          {step === 'done' && (
            <div className="settings-success">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <div>Пароль успешно изменён</div>
              <button className="settings-btn settings-btn--primary" onClick={onClose} style={{ marginTop: '0.75rem' }}>Закрыть</button>
            </div>
          )}

          {step === 'method' && !skipOtp && (
            <>
              <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                Для подтверждения выберите способ получения OTP-кода:
              </p>
              <div className="settings-method-list">
                {user.phone && (
                  <label className="settings-method-item">
                    <input type="radio" name="otp_method" value="phone"
                      checked={method === 'phone'}
                      onChange={() => setMethod('phone')} />
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.29 6.29l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    Код на телефон: {user.phone}
                  </label>
                )}
                {user.email && (
                  <label className="settings-method-item">
                    <input type="radio" name="otp_method" value="email"
                      checked={method === 'email'}
                      onChange={() => setMethod('email')} />
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    Код на Email: {user.email}
                  </label>
                )}
                {!user.phone && !user.email && (
                  <p className="settings-error" style={{ marginBottom: 0 }}>
                    У пользователя нет телефона и email. Сначала добавьте контакт.
                  </p>
                )}
              </div>
              {(user.phone || user.email) && (
                <button className="settings-btn settings-btn--primary" style={{ marginTop: '1rem' }} onClick={handleSendOtp}>
                  Отправить код
                </button>
              )}
            </>
          )}

          {step === 'method' && skipOtp && (
            <>
              <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                Вы администратор — OTP не требуется. Введите новый пароль для <strong>{user.name}</strong>.
              </p>
              <button className="settings-btn settings-btn--primary" onClick={() => setStep('newpw')}>
                Продолжить
              </button>
            </>
          )}

          {step === 'otp' && (
            <>
              <p style={{ marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                Код отправлен. Введите его ниже:
              </p>
              {demoCode && (
                <div className="settings-demo-otp">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Демо-режим. Ваш OTP: <strong>{demoCode}</strong>
                </div>
              )}
              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label>OTP-код</label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value)}
                  placeholder="6 цифр..."
                  maxLength={6}
                  autoFocus
                />
              </div>
              {otpError && <div className="settings-error">{otpError}</div>}
              <div className="settings-row-btns" style={{ marginTop: '0.75rem' }}>
                <button className="settings-btn settings-btn--primary" onClick={handleVerifyOtp}>Проверить</button>
                <button className="settings-btn settings-btn--ghost" onClick={onClose}>Отмена</button>
              </div>
            </>
          )}

          {step === 'newpw' && (
            <>
              <div className="form-group">
                <label>Новый пароль</label>
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Минимум 6 символов..." autoFocus />
              </div>
              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label>Подтвердить пароль</label>
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Повторите пароль..." />
              </div>
              {pwError && <div className="settings-error">{pwError}</div>}
              <div className="settings-row-btns" style={{ marginTop: '0.75rem' }}>
                <button className="settings-btn settings-btn--primary" onClick={handleSetPassword}>Сохранить пароль</button>
                <button className="settings-btn settings-btn--ghost" onClick={onClose}>Отмена</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Audit Log Tab ─────────────────────────────────────────────────────────────
function AuditLogTab() {
  const [log, setLog] = useState([]);
  useEffect(() => { setLog(getAuditLog()); }, []);

  const ACTION_LABELS = {
    user_created: 'Создан пользователь',
    user_edited: 'Редактирование профиля',
    password_changed: 'Смена пароля',
    user_blocked: 'Блокировка пользователя',
    user_unblocked: 'Разблокировка пользователя',
    patient_created: 'Создан пациент',
    patient_deleted: 'Удалён пациент',
    diagnosis_changed: 'Изменён диагноз',
  };

  return (
    <div>
      <div className="settings-section-title">Журнал действий</div>
      {log.length === 0 ? (
        <div className="settings-empty">Журнал пуст</div>
      ) : (
        <div className="settings-audit-list">
          {log.map(entry => (
            <div key={entry.id} className="settings-audit-row">
              <div className="settings-audit-time">{fmtDate(entry.timestamp)}</div>
              <div className="settings-audit-actor">{entry.actorName || entry.actorId}</div>
              <div className="settings-audit-action">
                <span className="settings-audit-badge">{ACTION_LABELS[entry.action] || entry.action}</span>
              </div>
              <div className="settings-audit-target">{entry.targetName}</div>
              <div className="settings-audit-details">{entry.details}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main SettingsPanel ────────────────────────────────────────────────────────
export default function SettingsPanel({ session, onClose }) {
  const { t } = useLang();
  const [tab, setTab] = useState('users');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Clinic-scoped: only show users belonging to this clinic, never superadmin
  function getClinicUsers() {
    return getUsers().filter(u =>
      u.role !== 'superadmin' &&
      u.clinicId === (session.clinicId || 'clinic_default')
    );
  }

  const [users, setUsers] = useState(() => getClinicUsers());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [pwUser, setPwUser] = useState(null);
  const [confirmBlock, setConfirmBlock] = useState(null);

  function refresh() { setUsers(getClinicUsers()); }

  function handleToggleBlock(u) {
    setConfirmBlock(u);
  }

  function doToggleBlock() {
    if (!confirmBlock) return;
    const updated = toggleUserActive(confirmBlock.id);
    addAuditEntry({
      action: updated.isActive ? 'user_unblocked' : 'user_blocked',
      actorId: session.id,
      actorName: session.name || session.login,
      targetId: confirmBlock.id,
      targetName: confirmBlock.name,
      details: updated.isActive ? 'Пользователь разблокирован' : 'Пользователь заблокирован',
    });
    refresh();
    setConfirmBlock(null);
  }

  // Filtered list (search + role)
  const filteredUsers = users.filter(u => {
    const q = search.trim().toLowerCase();
    const matchText = !q ||
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.phone || '').includes(q) ||
      (u.email || '').toLowerCase().includes(q);
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchText && matchRole;
  });

  const activeCount = users.filter(u => u.isActive).length;
  const blockedCount = users.length - activeCount;

  return (
    <div className="settings-root">
      {/* Header */}
      <div className="settings-header">
        <div className="settings-header-left">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
          </svg>
          <span>{t('settingsTitle')}</span>
        </div>
        <button className="settings-close-btn" onClick={onClose} title="Закрыть">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="settings-tabs">
        <button className={`settings-tab${tab === 'users' ? ' settings-tab--active' : ''}`} onClick={() => setTab('users')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          {t('settingsUsersTab')} ({users.length})
        </button>
        <button className={`settings-tab${tab === 'audit' ? ' settings-tab--active' : ''}`} onClick={() => setTab('audit')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
          </svg>
          {t('settingsAuditTab')}
        </button>
      </div>

      {/* Content */}
      <div className="settings-body">
        {tab === 'users' && (
          <div>
            {/* Summary stats */}
            <div className="settings-user-stats">
              <div className="settings-stat">
                <span className="settings-stat-num">{users.length}</span>
                <span className="settings-stat-label">Всего</span>
              </div>
              <div className="settings-stat">
                <span className="settings-stat-num settings-stat-num--active">{activeCount}</span>
                <span className="settings-stat-label">Активных</span>
              </div>
              {blockedCount > 0 && (
                <div className="settings-stat">
                  <span className="settings-stat-num settings-stat-num--blocked">{blockedCount}</span>
                  <span className="settings-stat-label">Заблок.</span>
                </div>
              )}
            </div>

            {/* Toolbar: search + role filter + add button */}
            <div className="settings-toolbar settings-toolbar--wrap">
              <input
                className="settings-search"
                type="text"
                placeholder="Поиск по имени, логину, телефону..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select
                className="settings-search"
                style={{ maxWidth: 180 }}
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
              >
                <option value="all">Все роли</option>
                <option value="admin">Администраторы</option>
                <option value="doctor">Врачи</option>
                <option value="registrar">Регистраторы</option>
              </select>
              <button className="settings-btn settings-btn--primary" onClick={() => setShowAddModal(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                {t('settingsAddUser')}
              </button>
            </div>

            <div className="settings-table-wrap">
              <table className="settings-table">
                <thead>
                  <tr>
                    <th>{t('settingsColName')}</th>
                    <th>{t('settingsColUsername')}</th>
                    <th>{t('settingsColPhone')}</th>
                    <th>{t('settingsColEmail')}</th>
                    <th>{t('settingsColRole')}</th>
                    <th>{t('settingsColStatus')}</th>
                    <th>{t('settingsColActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        {search || roleFilter !== 'all' ? 'Совпадений не найдено' : 'Нет пользователей'}
                      </td>
                    </tr>
                  )}
                  {filteredUsers.map(u => (
                    <tr key={u.id} className={!u.isActive ? 'settings-row--blocked' : ''}>
                      <td className="settings-user-name">
                        {u.name}
                        {u.mustChangePassword && (
                          <span className="sa-must-change" title="Требуется смена пароля">🔑</span>
                        )}
                        {String(u.id) === String(session.id) && (
                          <span className="settings-you-badge">вы</span>
                        )}
                      </td>
                      <td><code className="settings-code">{u.username}</code></td>
                      <td className="settings-muted">{u.phone || '—'}</td>
                      <td className="settings-muted">{u.email || '—'}</td>
                      <td><RoleBadge role={u.role} /></td>
                      <td>
                        <span className={`settings-status${u.isActive ? ' settings-status--active' : ' settings-status--blocked'}`}>
                          {u.isActive ? t('settingsStatusActive') : t('settingsStatusBlocked')}
                        </span>
                      </td>
                      <td>
                        <div className="settings-actions">
                          <button
                            className="settings-action-btn"
                            title={t('settingsEdit')}
                            onClick={() => setEditUser(u)}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            className="settings-action-btn"
                            title={t('settingsChangePw')}
                            onClick={() => setPwUser(u)}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                          </button>
                          {/* Don't allow blocking yourself */}
                          {String(u.id) !== String(session.id) && (
                            <button
                              className={`settings-action-btn${!u.isActive ? ' settings-action-btn--unblock' : ' settings-action-btn--block'}`}
                              title={u.isActive ? t('settingsBlock') : t('settingsUnblock')}
                              onClick={() => handleToggleBlock(u)}
                            >
                              {u.isActive ? (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                                </svg>
                              ) : (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'audit' && <AuditLogTab />}
      </div>

      {/* Modals */}
      {showAddModal && (
        <UserFormModal
          user={null}
          session={session}
          onSave={() => { refresh(); setShowAddModal(false); }}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {editUser && (
        <UserFormModal
          user={editUser}
          session={session}
          onSave={() => { refresh(); setEditUser(null); }}
          onClose={() => setEditUser(null)}
        />
      )}
      {pwUser && (
        <ChangePasswordModal
          user={pwUser}
          session={session}
          onClose={() => { setPwUser(null); }}
        />
      )}
      {confirmBlock && (
        <ConfirmModal
          message={confirmBlock.isActive
            ? `Заблокировать пользователя «${confirmBlock.name}»? Он не сможет войти в систему.`
            : `Разблокировать пользователя «${confirmBlock.name}»?`}
          onConfirm={doToggleBlock}
          onCancel={() => setConfirmBlock(null)}
        />
      )}
    </div>
  );
}

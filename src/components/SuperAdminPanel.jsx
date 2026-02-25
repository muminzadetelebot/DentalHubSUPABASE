import { useState } from 'react';
import {
  getClinics, createClinic, updateClinic,
  getSubscriptions, updateSubscription, createSubscription,
  getActionLogs, addActionLog,
} from '../utils/clinicStorage';
import {
  getUsersForClinic, toggleUserActive,
  resetUserPasswordTemp, addAuditEntry, createUser,
  updateUser, setUserPassword, verifyPassword,
} from '../utils/userStorage';

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('ru-RU'); } catch { return iso; }
}
function fmtDateShort(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('ru-RU'); } catch { return iso; }
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function StatusBadge({ status }) {
  const map = {
    active:  { cls: 'sa-badge sa-badge--active',  label: 'Активна' },
    trial:   { cls: 'sa-badge sa-badge--trial',   label: 'Триал' },
    expired: { cls: 'sa-badge sa-badge--expired', label: 'Истекла' },
    blocked: { cls: 'sa-badge sa-badge--blocked', label: 'Заблок.' },
    none:    { cls: 'sa-badge sa-badge--expired', label: 'Нет' },
  };
  const info = map[status] || map.none;
  return <span className={info.cls}>{info.label}</span>;
}

function UserStatusBadge({ isActive }) {
  return isActive
    ? <span className="sa-badge sa-badge--active">Активен</span>
    : <span className="sa-badge sa-badge--blocked">Заблок.</span>;
}

function RoleBadge({ role }) {
  const cls = role === 'superadmin' ? 'role-badge--superadmin'
    : role === 'clinic_admin' ? 'role-badge--clinic-admin'
    : role === 'admin' ? 'role-badge--admin'
    : role === 'doctor' ? 'role-badge--doctor'
    : 'role-badge--reg';
  const label = role === 'superadmin' ? 'SuperAdmin'
    : role === 'clinic_admin' ? 'Адм. клиники'
    : role === 'admin' ? 'Администратор'
    : role === 'doctor' ? 'Врач'
    : 'Регистратор';
  return <span className={`role-badge ${cls}`}>{label}</span>;
}

// ── Temp password display modal ───────────────────────────────────────────────
function TempPasswordModal({ username, tempPw, onClose }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(tempPw).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="sa-overlay" onClick={onClose}>
      <div className="sa-dialog sa-dialog--sm" onClick={e => e.stopPropagation()}>
        <div className="sa-dialog-header">
          <span>Временный пароль сгенерирован</span>
          <button className="sa-close-btn" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="sa-dialog-body">
          <div className="sa-tempw-info">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p>Скопируйте и передайте пользователю <strong>{username}</strong>. При первом входе потребуется смена пароля.</p>
          </div>
          <div className="sa-tempw-box">
            <code className="sa-tempw-code">{tempPw}</code>
            <button className="sa-btn sa-btn--edit" onClick={handleCopy} title="Скопировать">
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              )}
            </button>
          </div>
          <p className="sa-tempw-note">Этот пароль показывается только один раз. Закройте окно после копирования.</p>
          <div className="sa-dialog-btns">
            <button className="btn-save" onClick={onClose}>Закрыть</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Clinic Form Modal ─────────────────────────────────────────────────────────
function ClinicFormModal({ clinic, onSave, onClose }) {
  const isEdit = !!clinic;
  const [clinicForm, setClinicForm] = useState({
    name: clinic?.name || '',
    phone: clinic?.phone || '',
    email: clinic?.email || '',
    address: clinic?.address || '',
    license: clinic?.license || '',
  });
  const [adminForm, setAdminForm] = useState({
    name: '',
    username: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function setC(k, v) { setClinicForm(f => ({ ...f, [k]: v })); }
  function setA(k, v) { setAdminForm(f => ({ ...f, [k]: v })); }

  function handleSave() {
    setError('');
    if (!clinicForm.name.trim()) { setError('Название клиники обязательно'); return; }

    if (!isEdit) {
      // Validate admin fields only on create
      if (!adminForm.name.trim()) { setError('ФИО администратора обязательно'); return; }
      if (!adminForm.username.trim()) { setError('Логин администратора обязателен'); return; }
      if (adminForm.username.includes(' ')) { setError('Логин не должен содержать пробелы'); return; }
      if (!adminForm.password) { setError('Пароль обязателен'); return; }
      if (adminForm.password.length < 6) { setError('Пароль должен быть не менее 6 символов'); return; }
      if (adminForm.password !== adminForm.confirmPassword) { setError('Пароли не совпадают'); return; }
    }

    setLoading(true);
    setTimeout(() => {
      try {
        if (isEdit) {
          updateClinic(clinic.id, clinicForm);
          onSave({ mode: 'edit' });
        } else {
          const newClinic = createClinic(clinicForm);
          const newUser = createUser({
            name: adminForm.name.trim(),
            username: adminForm.username.trim().toLowerCase(),
            phone: adminForm.phone.trim(),
            email: adminForm.email.trim(),
            role: 'clinic_admin',
            password: adminForm.password,
            clinicId: newClinic.id,
          });
          addActionLog({
            clinicId: newClinic.id,
            userId: 'superadmin',
            userName: 'SuperAdmin',
            action: 'clinic_created',
            entity: 'clinic',
            entityId: newClinic.id,
            details: newClinic.name,
          });
          addActionLog({
            clinicId: newClinic.id,
            userId: 'superadmin',
            userName: 'SuperAdmin',
            action: 'user_created',
            entity: 'user',
            entityId: newUser.id,
            details: `clinic_admin: ${newUser.username}`,
          });
          onSave({ mode: 'create', clinicName: newClinic.name, adminName: newUser.name });
        }
      } catch (err) {
        if (err.message === 'USERNAME_TAKEN') {
          setError('Этот логин уже занят. Выберите другой.');
        } else {
          setError('Ошибка при создании. Попробуйте снова.');
        }
        setLoading(false);
      }
    }, 300);
  }

  return (
    <div className="sa-overlay" onClick={onClose}>
      <div className="sa-dialog sa-dialog--wide" onClick={e => e.stopPropagation()}>
        <div className="sa-dialog-header">
          <span>{isEdit ? 'Редактировать клинику' : 'Добавить клинику'}</span>
          <button className="sa-close-btn" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="sa-dialog-body">

          {/* ── Clinic section ── */}
          <div className="sa-form-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Данные клиники
          </div>

          <div className="sa-form-grid">
            <div className="form-group sa-form-col--full">
              <label>Название *</label>
              <input value={clinicForm.name} onChange={e => setC('name', e.target.value)} placeholder="Стоматология «Улыбка»" />
            </div>
            <div className="form-group">
              <label>Телефон</label>
              <input value={clinicForm.phone} onChange={e => setC('phone', e.target.value)} placeholder="+992..." />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={clinicForm.email} onChange={e => setC('email', e.target.value)} placeholder="clinic@example.com" />
            </div>
            <div className="form-group sa-form-col--full">
              <label>Адрес</label>
              <input value={clinicForm.address} onChange={e => setC('address', e.target.value)} placeholder="г. Душанбе, ул. ..." />
            </div>
            <div className="form-group sa-form-col--full">
              <label>Лицензия <span className="sa-optional">(опционально)</span></label>
              <input value={clinicForm.license} onChange={e => setC('license', e.target.value)} placeholder="№ ..." />
            </div>
          </div>

          {/* ── Admin user section (only on create) ── */}
          {!isEdit && (
            <>
              <div className="sa-form-section-title sa-form-section-title--admin">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Администратор клиники
                <span className="sa-role-chip">clinic_admin</span>
              </div>

              <div className="sa-form-grid">
                <div className="form-group sa-form-col--full">
                  <label>ФИО *</label>
                  <input value={adminForm.name} onChange={e => setA('name', e.target.value)} placeholder="Иванов Иван Иванович" />
                </div>
                <div className="form-group">
                  <label>Логин (Username) *</label>
                  <input value={adminForm.username} onChange={e => setA('username', e.target.value)} placeholder="admin_smile" autoComplete="off" />
                </div>
                <div className="form-group">
                  <label>Телефон</label>
                  <input value={adminForm.phone} onChange={e => setA('phone', e.target.value)} placeholder="+992..." />
                </div>
                <div className="form-group sa-form-col--full">
                  <label>Email</label>
                  <input type="email" value={adminForm.email} onChange={e => setA('email', e.target.value)} placeholder="admin@clinic.com" />
                </div>
                <div className="form-group">
                  <label>Пароль *</label>
                  <div className="login-pw-wrap">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={adminForm.password}
                      onChange={e => setA('password', e.target.value)}
                      placeholder="Минимум 6 символов"
                      autoComplete="new-password"
                    />
                    <button type="button" className="login-pw-toggle" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                      {showPw ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Подтверждение пароля *</label>
                  <div className="login-pw-wrap">
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={adminForm.confirmPassword}
                      onChange={e => setA('confirmPassword', e.target.value)}
                      placeholder="Повторите пароль"
                      autoComplete="new-password"
                    />
                    <button type="button" className="login-pw-toggle" onClick={() => setShowConfirmPw(v => !v)} tabIndex={-1}>
                      {showConfirmPw ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="sa-pw-note">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Пароль сохраняется в зашифрованном виде и не отображается после сохранения. Для сброса — используйте функцию сброса пароля.
              </div>
            </>
          )}

          {error && <div className="sa-error">{error}</div>}
          <div className="sa-dialog-btns">
            <button className="btn-save" onClick={handleSave} disabled={loading}>
              {loading ? 'Создание...' : (isEdit ? 'Сохранить' : 'Создать клинику')}
            </button>
            <button className="btn-nav" onClick={onClose} disabled={loading}>Отмена</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── My Account (SuperAdmin profile settings) ─────────────────────────────────
function MyAccountPanel({ session }) {
  const [form, setForm] = useState({
    username: session.login || '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleSave(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.currentPassword) { setError('Введите текущий пароль'); return; }

    // Load current superadmin record
    const users = JSON.parse(localStorage.getItem('dental_clinic_users') || '[]');
    const me = users.find(u => u.role === 'superadmin');
    if (!me) { setError('Аккаунт не найден'); return; }

    if (!verifyPassword(form.currentPassword, me.passwordHash)) {
      setError('Текущий пароль неверный');
      return;
    }

    // Validate new username uniqueness
    if (form.username.trim() && form.username.trim() !== me.username) {
      const taken = users.find(u => u.username === form.username.trim() && u.id !== me.id);
      if (taken) { setError('Этот логин уже занят'); return; }
    }

    // Validate password change if any new password entered
    if (form.newPassword) {
      if (form.newPassword.length < 6) { setError('Новый пароль: минимум 6 символов'); return; }
      if (form.newPassword !== form.confirmPassword) { setError('Пароли не совпадают'); return; }
    }

    setLoading(true);
    setTimeout(() => {
      try {
        const patch = {};
        if (form.username.trim()) patch.username = form.username.trim().toLowerCase();
        if (form.email.trim()) patch.email = form.email.trim();
        if (form.phone.trim()) patch.phone = form.phone.trim();
        updateUser(me.id, patch);

        if (form.newPassword) {
          setUserPassword(me.id, form.newPassword);
          addActionLog({
            clinicId: '*',
            userId: me.id,
            userName: me.name,
            action: 'password_changed',
            entity: 'user',
            entityId: me.id,
            details: 'SuperAdmin changed own password',
          });
        }
        if (Object.keys(patch).length > 0) {
          addActionLog({
            clinicId: '*',
            userId: me.id,
            userName: me.name,
            action: 'profile_updated',
            entity: 'user',
            entityId: me.id,
            details: `Fields: ${Object.keys(patch).join(', ')}`,
          });
        }

        setSuccess('Изменения сохранены успешно');
        setForm(f => ({ ...f, currentPassword: '', newPassword: '', confirmPassword: '' }));
      } catch (err) {
        setError(err.message === 'USERNAME_TAKEN' ? 'Этот логин уже занят' : 'Ошибка при сохранении');
      }
      setLoading(false);
    }, 300);
  }

  const EyeOn = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
  const EyeOff = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

  return (
    <div className="sa-panel sa-account-panel">
      <div className="sa-account-header">
        <div className="sa-account-avatar">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div>
          <div className="sa-account-name">{session.name}</div>
          <span className="role-badge role-badge--superadmin">SuperAdmin</span>
        </div>
      </div>

      <form className="sa-account-form" onSubmit={handleSave} autoComplete="off">

        <div className="sa-form-section-title" style={{ marginTop: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          Данные профиля
        </div>

        <div className="sa-form-grid">
          <div className="form-group">
            <label>Новый логин (Username)</label>
            <input
              value={form.username}
              onChange={e => set('username', e.target.value)}
              placeholder={session.login || 'superadmin'}
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label>Телефон</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+992..." />
          </div>
          <div className="form-group sa-form-col--full">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="superadmin@example.com" />
          </div>
        </div>

        <div className="sa-form-section-title sa-form-section-title--admin">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Смена пароля
        </div>

        <div className="form-group">
          <label>Текущий пароль *</label>
          <div className="login-pw-wrap">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={form.currentPassword}
              onChange={e => set('currentPassword', e.target.value)}
              placeholder="Текущий пароль"
              autoComplete="current-password"
            />
            <button type="button" className="login-pw-toggle" onClick={() => setShowCurrent(v => !v)} tabIndex={-1}>
              {showCurrent ? <EyeOff /> : <EyeOn />}
            </button>
          </div>
        </div>

        <div className="sa-form-grid">
          <div className="form-group">
            <label>Новый пароль</label>
            <div className="login-pw-wrap">
              <input
                type={showNew ? 'text' : 'password'}
                value={form.newPassword}
                onChange={e => set('newPassword', e.target.value)}
                placeholder="Минимум 6 символов"
                autoComplete="new-password"
              />
              <button type="button" className="login-pw-toggle" onClick={() => setShowNew(v => !v)} tabIndex={-1}>
                {showNew ? <EyeOff /> : <EyeOn />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Повтор нового пароля</label>
            <div className="login-pw-wrap">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={e => set('confirmPassword', e.target.value)}
                placeholder="Повторите пароль"
                autoComplete="new-password"
              />
              <button type="button" className="login-pw-toggle" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}>
                {showConfirm ? <EyeOff /> : <EyeOn />}
              </button>
            </div>
          </div>
        </div>

        <div className="sa-pw-note">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Пароль хранится в зашифрованном виде. Заполните поле «Новый пароль» только если хотите его изменить.
        </div>

        {error && (
          <div className="sa-error" style={{ marginBottom: '0.75rem' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}
        {success && (
          <div className="sa-success-banner" style={{ margin: '0 0 0.75rem' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>{success}</span>
          </div>
        )}

        <button className="btn-save" type="submit" disabled={loading}>
          {loading ? 'Сохранение...' : 'Сохранить изменения'}
        </button>
      </form>
    </div>
  );
}

// ── Subscription Form Modal ───────────────────────────────────────────────────
function SubFormModal({ clinicId, clinicName, onSave, onClose }) {
  const existing = getSubscriptions().find(s => s.clinicId === clinicId);
  const [form, setForm] = useState({
    plan: existing?.plan || 'starter',
    status: existing?.status || 'active',
    expiresAt: existing?.expiresAt
      ? existing.expiresAt.slice(0, 10)
      : new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleSave() {
    const expiresAt = new Date(form.expiresAt).toISOString();
    if (existing) {
      updateSubscription(clinicId, { plan: form.plan, status: form.status, expiresAt });
    } else {
      createSubscription({ clinicId, plan: form.plan, status: form.status, days: 365 });
      updateSubscription(clinicId, { expiresAt });
    }
    onSave();
  }

  return (
    <div className="sa-overlay" onClick={onClose}>
      <div className="sa-dialog sa-dialog--sm" onClick={e => e.stopPropagation()}>
        <div className="sa-dialog-header">
          <span>Подписка: {clinicName}</span>
          <button className="sa-close-btn" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="sa-dialog-body">
          <div className="form-group">
            <label>Тариф</label>
            <select value={form.plan} onChange={e => set('plan', e.target.value)}>
              <option value="trial">Триал (1 врач, 100 пациентов)</option>
              <option value="starter">Starter (3 врача, 500 пациентов)</option>
              <option value="professional">Professional (10 врачей, 5000 пациентов)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Статус</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="active">Активна</option>
              <option value="trial">Триал</option>
              <option value="expired">Истекла</option>
              <option value="blocked">Заблокирована</option>
            </select>
          </div>
          <div className="form-group">
            <label>Действует до</label>
            <input type="date" value={form.expiresAt} onChange={e => set('expiresAt', e.target.value)} />
          </div>
          <div className="sa-dialog-btns">
            <button className="btn-save" onClick={handleSave}>Сохранить</button>
            <button className="btn-nav" onClick={onClose}>Отмена</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main SuperAdminPanel ──────────────────────────────────────────────────────
export default function SuperAdminPanel({ session, onClose }) {
  const [tab, setTab] = useState('clinics');
  const [clinics, setClinics] = useState(() => getClinics());
  const [subs, setSubs] = useState(() => getSubscriptions());
  const [logs, setLogs] = useState(() => getActionLogs({ limit: 200 }));
  // All users except superadmin (SA never shows its own account)
  const [users, setUsers] = useState(() =>
    getUsersForClinic('*', 'superadmin').filter(u => u.role !== 'superadmin')
  );
  const [clinicModal, setClinicModal] = useState(null);
  const [subModal, setSubModal] = useState(null);
  const [tempPwModal, setTempPwModal] = useState(null); // { username, tempPw }
  const [successMsg, setSuccessMsg] = useState(null); // { clinicName, adminName }
  const [logFilter, setLogFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [clinicFilter, setClinicFilter] = useState('all');

  function refresh() {
    setClinics(getClinics());
    setSubs(getSubscriptions());
    setLogs(getActionLogs({ limit: 200 }));
    setUsers(getUsersForClinic('*', 'superadmin').filter(u => u.role !== 'superadmin'));
  }

  function getSubForClinic(clinicId) {
    return subs.find(s => s.clinicId === clinicId) || null;
  }

  function getClinicName(clinicId) {
    return clinics.find(c => c.id === clinicId)?.name || clinicId;
  }

  // ── Block / unblock user ──────────────────────────────────────────────────
  function handleToggleBlock(user) {
    const action = user.isActive ? 'block' : 'unblock';
    if (!window.confirm(user.isActive
      ? `Заблокировать пользователя «${user.name}»?`
      : `Разблокировать пользователя «${user.name}»?`)) return;
    toggleUserActive(user.id);
    addAuditEntry({
      action: `user_${action}ed`,
      actorId: session.id,
      actorName: session.name,
      targetId: user.id,
      targetName: user.name,
      details: `SuperAdmin ${action}ed user`,
    });
    addActionLog({
      clinicId: user.clinicId,
      userId: session.id,
      userName: session.name,
      action: `user_${action}`,
      entity: 'user',
      entityId: user.id,
      details: user.name,
    });
    refresh();
  }

  // ── Reset password (temp) ─────────────────────────────────────────────────
  function handleResetPassword(user) {
    if (!window.confirm(`Сгенерировать временный пароль для «${user.name}»? Старый пароль будет сброшен.`)) return;
    const tempPw = resetUserPasswordTemp(user.id);
    addAuditEntry({
      action: 'password_reset',
      actorId: session.id,
      actorName: session.name,
      targetId: user.id,
      targetName: user.name,
      details: 'SuperAdmin reset password (temp)',
    });
    addActionLog({
      clinicId: user.clinicId,
      userId: session.id,
      userName: session.name,
      action: 'password_reset',
      entity: 'user',
      entityId: user.id,
      details: `Temporary password set for ${user.name}`,
    });
    setTempPwModal({ username: user.name, tempPw });
    refresh();
  }

  // ── Filtered users list ───────────────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    const matchText = !userFilter.trim() ||
      u.name.toLowerCase().includes(userFilter.toLowerCase()) ||
      u.username.toLowerCase().includes(userFilter.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(userFilter.toLowerCase());
    const matchClinic = clinicFilter === 'all' || u.clinicId === clinicFilter;
    return matchText && matchClinic;
  });

  const filteredLogs = logFilter.trim()
    ? logs.filter(l =>
        l.action.includes(logFilter) ||
        l.userName.toLowerCase().includes(logFilter.toLowerCase()) ||
        l.entity.includes(logFilter) ||
        l.clinicId.includes(logFilter)
      )
    : logs;

  const TABS = [
    { key: 'clinics',       label: 'Клиники' },
    { key: 'users',         label: `Пользователи (${users.length})` },
    { key: 'subscriptions', label: 'Подписки' },
    { key: 'logs',          label: 'Журнал' },
    { key: 'account',       label: 'Мой аккаунт' },
  ];

  return (
    <div className="sa-root">
      {/* Header */}
      <div className="sa-header">
        <div className="sa-header-left">
          <span className="role-badge role-badge--superadmin">SuperAdmin</span>
          <h2 className="sa-title">Управление платформой DentalHub</h2>
        </div>
        <button className="sa-close-btn sa-close-btn--lg" onClick={onClose} title="Закрыть">
          <CloseIcon />
        </button>
      </div>

      {/* Stats */}
      <div className="sa-stats">
        <div className="sa-stat-card">
          <div className="sa-stat-num">{clinics.length}</div>
          <div className="sa-stat-label">Клиник</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-num">{users.filter(u => u.isActive).length}</div>
          <div className="sa-stat-label">Активных пользователей</div>
        </div>
        <div className="sa-stat-card sa-stat-card--warn">
          <div className="sa-stat-num">{subs.filter(s => s.status === 'expired' || s.status === 'blocked').length}</div>
          <div className="sa-stat-label">Истекших / заблок.</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-num">{subs.filter(s => s.status === 'active' || s.status === 'trial').length}</div>
          <div className="sa-stat-label">Активных подписок</div>
        </div>
      </div>

      {/* Success notification */}
      {successMsg && (
        <div className="sa-success-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <div>
            <strong>Клиника создана:</strong> {successMsg.clinicName}
            <br />
            <strong>Администратор создан:</strong> {successMsg.adminName}
          </div>
          <button className="sa-close-btn" onClick={() => setSuccessMsg(null)}><CloseIcon /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="sa-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`sa-tab${tab === t.key ? ' sa-tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CLINICS TAB ── */}
      {tab === 'clinics' && (
        <div className="sa-panel">
          <div className="sa-panel-toolbar">
            <button className="btn-save" onClick={() => setClinicModal('new')}>+ Добавить клинику</button>
          </div>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>#</th><th>Название</th><th>Телефон</th><th>Email</th>
                  <th>Подписка</th><th>Статус</th><th>Создана</th><th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {clinics.map((c, i) => {
                  const sub = getSubForClinic(c.id);
                  const planLabels = { trial: 'Триал', starter: 'Starter', professional: 'Pro' };
                  return (
                    <tr key={c.id}>
                      <td className="sa-td-num">{i + 1}</td>
                      <td className="sa-td-name">{c.name}</td>
                      <td>{c.phone || '—'}</td>
                      <td>{c.email || '—'}</td>
                      <td>{sub ? planLabels[sub.plan] || sub.plan : '—'}</td>
                      <td>{sub ? <StatusBadge status={sub.status} /> : <span className="sa-badge sa-badge--expired">Нет</span>}</td>
                      <td>{fmtDateShort(c.createdAt)}</td>
                      <td>
                        <div className="sa-action-btns">
                          <button className="sa-btn sa-btn--edit" onClick={() => setClinicModal(c)} title="Редактировать">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button className="sa-btn sa-btn--sub" onClick={() => setSubModal({ clinicId: c.id, clinicName: c.name })} title="Подписка">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <div className="sa-panel">
          <div className="sa-panel-toolbar">
            <input
              className="sa-search"
              type="text"
              placeholder="Поиск по имени, логину, email..."
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
            />
            <select
              className="sa-search"
              style={{ maxWidth: 200 }}
              value={clinicFilter}
              onChange={e => setClinicFilter(e.target.value)}
            >
              <option value="all">Все клиники</option>
              {clinics.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button className="sa-btn sa-btn--edit" onClick={refresh} title="Обновить">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>

          {/* Security notice */}
          <div className="sa-security-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Пароли пользователей никогда не отображаются. Используйте «Сбросить пароль» для выдачи временного.
          </div>

          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Имя</th><th>Логин</th><th>Email</th><th>Телефон</th>
                  <th>Роль</th><th>Клиника</th><th>Статус</th><th>Создан</th><th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Пользователей нет</td></tr>
                )}
                {filteredUsers.map(u => (
                  <tr key={u.id} className={!u.isActive ? 'sa-row--blocked' : ''}>
                    <td className="sa-td-name">
                      {u.name}
                      {u.mustChangePassword && (
                        <span className="sa-must-change" title="Требуется смена пароля">🔑</span>
                      )}
                    </td>
                    <td><code className="sa-code">{u.username}</code></td>
                    <td>{u.email || '—'}</td>
                    <td>{u.phone || '—'}</td>
                    <td><RoleBadge role={u.role} /></td>
                    <td>{getClinicName(u.clinicId)}</td>
                    <td><UserStatusBadge isActive={u.isActive} /></td>
                    <td className="sa-td-time">{fmtDateShort(u.createdAt)}</td>
                    <td>
                      <div className="sa-action-btns">
                        {/* Block / Unblock */}
                        <button
                          className={`sa-btn ${u.isActive ? 'sa-btn--block' : 'sa-btn--unblock'}`}
                          onClick={() => handleToggleBlock(u)}
                          title={u.isActive ? 'Заблокировать' : 'Разблокировать'}
                        >
                          {u.isActive ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                            </svg>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 13l4 4L19 7"/>
                            </svg>
                          )}
                        </button>
                        {/* Reset password */}
                        <button
                          className="sa-btn sa-btn--resetpw"
                          onClick={() => handleResetPassword(u)}
                          title="Сбросить пароль (временный)"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SUBSCRIPTIONS TAB ── */}
      {tab === 'subscriptions' && (
        <div className="sa-panel">
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Клиника</th><th>Тариф</th><th>Статус</th>
                  <th>Истекает</th><th>Лимиты (врачи / пациенты / МБ)</th><th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {subs.map(s => {
                  const clinic = clinics.find(c => c.id === s.clinicId);
                  const planLabels = { trial: 'Триал', starter: 'Starter', professional: 'Professional' };
                  const exp = new Date(s.expiresAt);
                  const expiringSoon = (exp - Date.now()) < 14 * 24 * 3600 * 1000 && exp > Date.now();
                  return (
                    <tr key={s.id} className={expiringSoon ? 'sa-row--warn' : ''}>
                      <td className="sa-td-name">{clinic?.name || s.clinicId}</td>
                      <td>{planLabels[s.plan] || s.plan}</td>
                      <td><StatusBadge status={s.status} /></td>
                      <td><span className={expiringSoon ? 'sa-expiry-warn' : ''}>{fmtDateShort(s.expiresAt)}</span></td>
                      <td>{s.limits ? `${s.limits.doctors} / ${s.limits.patients} / ${s.limits.storageMb}` : '—'}</td>
                      <td>
                        <button className="sa-btn sa-btn--edit"
                          onClick={() => setSubModal({ clinicId: s.clinicId, clinicName: clinic?.name || s.clinicId })}
                          title="Изменить подписку">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── LOGS TAB ── */}
      {tab === 'logs' && (
        <div className="sa-panel">
          <div className="sa-panel-toolbar">
            <input
              className="sa-search"
              type="text"
              placeholder="Фильтр по действию, пользователю, клинике..."
              value={logFilter}
              onChange={e => setLogFilter(e.target.value)}
            />
            <button className="sa-btn sa-btn--edit" onClick={refresh} title="Обновить">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>
          <div className="sa-table-wrap">
            <table className="sa-table sa-table--logs">
              <thead>
                <tr>
                  <th>Дата/Время</th><th>Клиника</th><th>Пользователь</th>
                  <th>Действие</th><th>Объект</th><th>IP</th><th>Детали</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Логов нет</td></tr>
                )}
                {filteredLogs.map(l => (
                  <tr key={l.id}>
                    <td className="sa-td-time">{fmtDate(l.createdAt)}</td>
                    <td><code className="sa-code">{l.clinicId}</code></td>
                    <td>{l.userName || l.userId || '—'}</td>
                    <td><span className="sa-action-chip">{l.action}</span></td>
                    <td>{l.entity}{l.entityId ? <> <code className="sa-code">{l.entityId}</code></> : ''}</td>
                    <td><code className="sa-code">{l.ip}</code></td>
                    <td className="sa-td-details">{l.details || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ACCOUNT TAB ── */}
      {tab === 'account' && (
        <MyAccountPanel session={session} />
      )}

      {/* Modals */}
      {clinicModal && (
        <ClinicFormModal
          clinic={clinicModal === 'new' ? null : clinicModal}
          onSave={(result) => {
            refresh();
            setClinicModal(null);
            if (result && result.mode === 'create') {
              setSuccessMsg({ clinicName: result.clinicName, adminName: result.adminName });
              setTimeout(() => setSuccessMsg(null), 6000);
            }
          }}
          onClose={() => setClinicModal(null)}
        />
      )}
      {subModal && (
        <SubFormModal
          clinicId={subModal.clinicId}
          clinicName={subModal.clinicName}
          onSave={() => { refresh(); setSubModal(null); }}
          onClose={() => setSubModal(null)}
        />
      )}
      {tempPwModal && (
        <TempPasswordModal
          username={tempPwModal.username}
          tempPw={tempPwModal.tempPw}
          onClose={() => setTempPwModal(null)}
        />
      )}
    </div>
  );
}

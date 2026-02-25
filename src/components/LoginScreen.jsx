import { useState } from 'react';
import { useLang } from '../context/LangContext';
import {
  getUserByUsername, verifyPassword, resetUsersToDefaults, setUserPassword,
  generateOtp, verifyOtp,
} from '../utils/userStorage';
import {
  getLoginFails, recordLoginFail, clearLoginFails,
  clearAllLockouts, addActionLog, checkSubscription,
} from '../utils/clinicStorage';

export { verifyPassword };

// ── Eye icons shared ──────────────────────────────────────────────────────────
function EyeOn() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function EyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

// ── Forgot Password flow ──────────────────────────────────────────────────────
function ForgotPasswordScreen({ onBack }) {
  // step: 'identify' | 'otp' | 'newpw' | 'done'
  const [step, setStep] = useState('identify');
  const [identifier, setIdentifier] = useState(''); // username, email or phone
  const [foundUser, setFoundUser] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpCode, setOtpCode] = useState(''); // shown in demo mode
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleIdentify(e) {
    e.preventDefault();
    setError('');
    const val = identifier.trim().toLowerCase();
    if (!val) { setError('Введите логин, email или телефон'); return; }

    // Find user by username, email or phone
    const all = JSON.parse(localStorage.getItem('dental_clinic_users') || '[]');
    const user = all.find(u =>
      u.username === val ||
      (u.email && u.email.toLowerCase() === val) ||
      (u.phone && u.phone.replace(/\s/g, '') === val.replace(/\s/g, ''))
    );
    if (!user) { setError('Пользователь не найден'); return; }

    setLoading(true);
    setTimeout(() => {
      const code = generateOtp(user.id);
      setFoundUser(user);
      setOtpCode(code); // show code in demo (in prod — send SMS/email)
      addActionLog({
        clinicId: user.clinicId || '*',
        userId: user.id,
        userName: user.name,
        action: 'password_reset_requested',
        entity: 'user',
        entityId: user.id,
        details: 'OTP sent for password reset',
      });
      setLoading(false);
      setStep('otp');
    }, 400);
  }

  function handleOtp(e) {
    e.preventDefault();
    setError('');
    if (!otpInput.trim()) { setError('Введите код'); return; }
    if (verifyOtp(foundUser.id, otpInput.trim())) {
      setStep('newpw');
    } else {
      setError('Неверный код или срок действия истёк');
    }
  }

  function handleNewPw(e) {
    e.preventDefault();
    setError('');
    if (newPw.length < 6) { setError('Пароль минимум 6 символов'); return; }
    if (newPw !== confirmPw) { setError('Пароли не совпадают'); return; }
    setLoading(true);
    setTimeout(() => {
      setUserPassword(foundUser.id, newPw);
      addActionLog({
        clinicId: foundUser.clinicId || '*',
        userId: foundUser.id,
        userName: foundUser.name,
        action: 'password_reset_completed',
        entity: 'user',
        entityId: foundUser.id,
        details: 'Password reset via OTP flow',
      });
      setLoading(false);
      setStep('done');
    }, 300);
  }

  return (
    <div className="login-card">
      <div className="login-logo">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <div className="login-title">Восстановление пароля</div>

      {step === 'identify' && (
        <>
          <div className="login-subtitle" style={{ marginBottom: '1.25rem' }}>
            Введите логин, email или телефон вашего аккаунта
          </div>
          <form className="login-form" onSubmit={handleIdentify} autoComplete="off">
            <div className="login-field">
              <label className="login-label">Логин / Email / Телефон</label>
              <input
                className="login-input"
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                autoFocus
                required
              />
            </div>
            {error && (
              <div className="login-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{error}</span>
              </div>
            )}
            <button className="login-submit" type="submit" disabled={loading}>
              {loading ? <span className="login-spinner" /> : 'Отправить код'}
            </button>
            <button type="button" className="login-forgot-link" onClick={onBack}>
              Вернуться к входу
            </button>
          </form>
        </>
      )}

      {step === 'otp' && (
        <>
          <div className="login-subtitle" style={{ marginBottom: '1rem' }}>
            Код подтверждения отправлен для <strong>{foundUser?.name}</strong>
          </div>
          {otpCode && (
            <div className="login-otp-demo">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span>Демо-режим: код <strong>{otpCode}</strong> (в реальной системе придёт по SMS/Email)</span>
            </div>
          )}
          <form className="login-form" onSubmit={handleOtp} autoComplete="off">
            <div className="login-field">
              <label className="login-label">Код подтверждения</label>
              <input
                className="login-input"
                type="text"
                value={otpInput}
                onChange={e => setOtpInput(e.target.value)}
                placeholder="6-значный код"
                maxLength={6}
                autoFocus
                required
              />
            </div>
            {error && (
              <div className="login-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{error}</span>
              </div>
            )}
            <button className="login-submit" type="submit">Подтвердить</button>
            <button type="button" className="login-forgot-link" onClick={() => setStep('identify')}>
              Назад
            </button>
          </form>
        </>
      )}

      {step === 'newpw' && (
        <>
          <div className="login-subtitle" style={{ marginBottom: '1.25rem' }}>
            Придумайте новый пароль
          </div>
          <form className="login-form" onSubmit={handleNewPw} autoComplete="off">
            <div className="login-field">
              <label className="login-label">Новый пароль</label>
              <div className="login-pw-wrap">
                <input
                  className="login-input"
                  type={showPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="Минимум 6 символов"
                  autoFocus
                  required
                />
                <button type="button" className="login-pw-toggle" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                  {showPw ? <EyeOff /> : <EyeOn />}
                </button>
              </div>
            </div>
            <div className="login-field">
              <label className="login-label">Повтор пароля</label>
              <div className="login-pw-wrap">
                <input
                  className="login-input"
                  type={showPw ? 'text' : 'password'}
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Повторите пароль"
                  required
                />
              </div>
            </div>
            {error && (
              <div className="login-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{error}</span>
              </div>
            )}
            <button className="login-submit" type="submit" disabled={loading}>
              {loading ? <span className="login-spinner" /> : 'Сохранить пароль'}
            </button>
          </form>
        </>
      )}

      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <div className="login-title" style={{ marginBottom: '0.5rem' }}>Пароль изменён</div>
          <div className="login-subtitle">Теперь вы можете войти с новым паролем</div>
          <button className="login-submit" style={{ marginTop: '1.25rem' }} onClick={onBack}>
            Войти
          </button>
        </div>
      )}
    </div>
  );
}

// ── Change Password Screen (forced after temp-password login) ─────────────────
export function ChangePasswordScreen({ pendingUser, onPasswordChanged }) {
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPw.length < 6) {
      setError('Пароль должен содержать не менее 6 символов');
      return;
    }
    if (newPw !== confirmPw) {
      setError('Пароли не совпадают');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      try {
        setUserPassword(pendingUser.id, newPw);
        // Also clear mustChangePassword flag
        const users = JSON.parse(localStorage.getItem('dental_clinic_users') || '[]');
        const idx = users.findIndex(u => u.id === String(pendingUser.id));
        if (idx >= 0) {
          users[idx].mustChangePassword = false;
          localStorage.setItem('dental_clinic_users', JSON.stringify(users));
        }
        onPasswordChanged({ ...pendingUser, mustChangePassword: false });
      } catch {
        setError('Ошибка при смене пароля. Попробуйте снова.');
      }
      setLoading(false);
    }, 300);
  }

  return (
    <div className="changepw-root">
      <div className="changepw-card">
        <div className="changepw-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div className="changepw-title">Смена пароля обязательна</div>
        <div className="changepw-subtitle">
          Администратор установил временный пароль для вашего аккаунта
          <strong> {pendingUser.name}</strong>. Придумайте новый пароль для продолжения.
        </div>
        <form className="changepw-form" onSubmit={handleSubmit} autoComplete="off">
          <div className="changepw-field">
            <label className="changepw-label">Новый пароль</label>
            <div className="login-pw-wrap">
              <input
                className="changepw-input"
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Минимум 6 символов"
                autoFocus
                required
              />
              <button type="button" className="login-pw-toggle" onClick={() => setShowNew(v => !v)} tabIndex={-1}>
                {showNew ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div className="changepw-field">
            <label className="changepw-label">Подтвердите пароль</label>
            <div className="login-pw-wrap">
              <input
                className="changepw-input"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Повторите пароль"
                required
              />
              <button type="button" className="login-pw-toggle" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}>
                {showConfirm ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          {error && (
            <div className="changepw-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{error}</span>
            </div>
          )}
          <button className="changepw-submit" type="submit" disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить новый пароль'}
          </button>
        </form>
      </div>
    </div>
  );
}

function createSession(user) {
  // Simulated JWT payload stored in sessionStorage
  const payload = {
    id: String(user.id),
    login: user.username || user.login,
    role: user.role,
    name: user.name,
    clinicId: user.clinicId || 'clinic_default',
    iat: Date.now(),
    exp: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
  };
  sessionStorage.setItem('dental_session', JSON.stringify(payload));
  return payload;
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem('dental_session');
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session.exp < Date.now()) {
      sessionStorage.removeItem('dental_session');
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem('dental_session');
}

export default function LoginScreen({ onLogin }) {
  const { t, lang, switchLang } = useLang();
  const [loginVal, setLoginVal] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  function handleUnlock() {
    clearAllLockouts();
    setIsLocked(false);
    setError('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const uname = loginVal.trim().toLowerCase();

    // ── Check lockout ──────────────────────────────────────────────
    const fails = getLoginFails(uname);
    if (fails.lockedUntil && Date.now() < fails.lockedUntil) {
      const minsLeft = Math.ceil((fails.lockedUntil - Date.now()) / 60000);
      setIsLocked(true);
      setError(t('loginLockedOut').replace('{min}', minsLeft));
      return;
    }
    setIsLocked(false);

    setLoading(true);
    // Simulate async auth delay
    setTimeout(() => {
      const user = getUserByUsername(uname);
      if (user && verifyPassword(password, user.passwordHash)) {
        if (!user.isActive) {
          setError(t('loginBlocked'));
          setLoading(false);
          return;
        }
        // ── Check subscription (skip for superadmin) ───────────────
        if (user.role !== 'superadmin') {
          const sub = checkSubscription(user.clinicId, user.role);
          if (!sub.active) {
            setError(t('loginSubscriptionExpired'));
            setLoading(false);
            return;
          }
        }
        // ── Success ────────────────────────────────────────────────
        clearLoginFails(uname);
        addActionLog({
          clinicId: user.clinicId || '*',
          userId: user.id,
          userName: user.name,
          action: 'login',
          entity: 'user',
          entityId: user.id,
          details: user.mustChangePassword ? 'Login with temp password' : 'Successful login',
        });
        // If temp password set, don't create session yet — let App intercept
        if (user.mustChangePassword) {
          onLogin(null, user);
          setLoading(false);
          return;
        }
        const session = createSession({ ...user, login: user.username });
        onLogin(session, null);
      } else {
        // ── Failed attempt ─────────────────────────────────────────
        const result = recordLoginFail(uname);
        addActionLog({
          clinicId: '*',
          userId: '',
          userName: uname,
          action: 'login_failed',
          entity: 'user',
          entityId: uname,
          details: `Failed attempt ${result.count}/5`,
        });
        if (result.count >= 5) {
          setError(t('loginLockedOut').replace('{min}', '15'));
        } else {
          const remaining = 5 - result.count;
          setError(t('loginErrorAttempts').replace('{n}', remaining));
        }
      }
      setLoading(false);
    }, 400);
  }

  if (showForgot) {
    return (
      <div className="login-root">
        <div className="login-lang-switch">
          <button className={`lang-btn${lang === 'ru' ? ' lang-btn--active' : ''}`} onClick={() => switchLang('ru')}>RU</button>
          <span className="lang-sep">|</span>
          <button className={`lang-btn${lang === 'tj' ? ' lang-btn--active' : ''}`} onClick={() => switchLang('tj')}>TJ</button>
        </div>
        <ForgotPasswordScreen onBack={() => setShowForgot(false)} />
        <div className="login-footer">&copy; 2026 DentalHub</div>
      </div>
    );
  }

  return (
    <div className="login-root">
      {/* Lang switcher on login screen */}
      <div className="login-lang-switch">
        <button
          className={`lang-btn${lang === 'ru' ? ' lang-btn--active' : ''}`}
          onClick={() => switchLang('ru')}>RU</button>
        <span className="lang-sep">|</span>
        <button
          className={`lang-btn${lang === 'tj' ? ' lang-btn--active' : ''}`}
          onClick={() => switchLang('tj')}>TJ</button>
      </div>

      <div className="login-card">
        <div className="login-logo">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C8.5 2 6 4.5 6 7c0 1.5.5 2.8 1.3 3.8L6 21h12l-1.3-10.2C17.5 9.8 18 8.5 18 7c0-2.5-2.5-5-6-5z"/>
          </svg>
        </div>
        <div className="login-title">{t('loginSubtitle')}</div>
        <div className="login-subtitle">{t('loginTitle')}</div>

        <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
          <div className="login-field">
            <label className="login-label">{t('loginUsername')}</label>
            <input
              className="login-input"
              type="text"
              value={loginVal}
              onChange={e => setLoginVal(e.target.value)}
              placeholder=""
              autoFocus
              autoComplete="username"
              required
            />
          </div>

          <div className="login-field">
            <label className="login-label">{t('loginPassword')}</label>
            <div className="login-pw-wrap">
              <input
                className="login-input"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-pw-toggle"
                onClick={() => setShowPw(v => !v)}
                tabIndex={-1}
              >
                {showPw ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{error}</span>
              {isLocked && (
                <button type="button" className="login-unlock-btn" onClick={handleUnlock}>
                  Разблокировать
                </button>
              )}
            </div>
          )}

          <button
            className={`login-submit${loading ? ' login-submit--loading' : ''}`}
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <span className="login-spinner"></span>
            ) : t('loginBtn')}
          </button>
          <button type="button" className="login-forgot-link" onClick={() => setShowForgot(true)}>
            Забыли пароль?
          </button>
        </form>

      </div>

      <div className="login-footer">
        &copy; 2026 DentalHub
        <button
          className="login-reset-btn"
          onClick={() => {
            if (window.confirm('Сбросить данные пользователей к заводским настройкам? Пациенты и визиты НЕ удаляются.')) {
              resetUsersToDefaults();
              window.location.reload();
            }
          }}
        >
          Сброс пользователей
        </button>
      </div>
    </div>
  );
}

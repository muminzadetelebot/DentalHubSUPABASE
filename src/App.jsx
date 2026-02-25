import { useState } from 'react';
import './App.css';
import { LangProvider, useLang } from './context/LangContext';
import LoginScreen, { getSession, clearSession, ChangePasswordScreen } from './components/LoginScreen';
import NewPatientModal from './components/NewPatientModal';
import FindPatientModal from './components/FindPatientModal';
import AppointmentCalendar from './components/AppointmentCalendar';
import LiveQueue from './components/LiveQueue';
import SettingsPanel from './components/SettingsPanel';
import SuperAdminPanel from './components/SuperAdminPanel';
import { checkSubscription, addActionLog } from './utils/clinicStorage';

function AppInner() {
  const { t, lang, switchLang } = useLang();
  const [session, setSession] = useState(() => getSession());
  const [view, setView] = useState(null); // null | 'new' | 'find' | 'calendar' | 'queue' | 'settings' | 'superadmin'
  const [autoOpenPatient, setAutoOpenPatient] = useState(null); // patient to auto-select in FindPatientModal
  // pendingChangePw holds the raw user object when mustChangePassword=true at login
  const [pendingChangePw, setPendingChangePw] = useState(null);

  function handleLogin(sess, rawUser) {
    // If user must change password, intercept before creating a session
    if (rawUser && rawUser.mustChangePassword) {
      setPendingChangePw(rawUser);
      return;
    }
    setSession(sess);
    // If superadmin, go straight to superadmin panel
    if (sess.role === 'superadmin') {
      setView('superadmin');
    }
  }

  function handlePasswordChanged(updatedUser) {
    // Password was changed — now create session and proceed normally
    setPendingChangePw(null);
    // Re-import createSession logic by triggering login fresh from the updated user
    // We pass mustChangePassword=false so no loop
    const sess = {
      id: String(updatedUser.id),
      login: updatedUser.username,
      role: updatedUser.role,
      name: updatedUser.name,
      clinicId: updatedUser.clinicId || 'clinic_default',
      iat: Date.now(),
      exp: Date.now() + 8 * 60 * 60 * 1000,
    };
    sessionStorage.setItem('dental_session', JSON.stringify(sess));
    setSession(sess);
    if (sess.role === 'superadmin') setView('superadmin');
  }

  function handleLogout() {
    if (session) {
      addActionLog({
        clinicId: session.clinicId || '*',
        userId: session.id,
        userName: session.name,
        action: 'logout',
        entity: 'user',
        entityId: session.id,
        details: 'User logged out',
      });
    }
    clearSession();
    setSession(null);
    setView(null);
  }

  const roleLabels = t('roles');

  // Subscription check for non-superadmin
  const subInfo = session && session.role !== 'superadmin'
    ? checkSubscription(session.clinicId, session.role)
    : null;

  if (pendingChangePw) {
    return (
      <ChangePasswordScreen
        pendingUser={pendingChangePw}
        onPasswordChanged={handlePasswordChanged}
      />
    );
  }

  if (!session) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Superadmin sees only their panel
  if (session.role === 'superadmin') {
    return (
      <div className="app-root">
        <header className="app-header">
          <div className="header-logo">
            <img
              src="https://cdn.codia.ai/projects/aabfa738-0f57-48ee-af8c-38f843cd3eca/resource/ChatGPT%20Image%2021%20%C3%91-%C3%90%C2%B5%C3%90%C2%B2%C3%91-.%202026%20%C3%90%C2%B3.-%2014_34_50.png"
              alt="DentalHub"
              className="header-logo-img"
            />
            <span>DentalHub</span>
          </div>
          <div className="header-right">
            <div className="header-user">
              <span className="role-badge role-badge--superadmin">SuperAdmin</span>
              <span className="header-username">{session.name}</span>
              <button className="btn-logout" onClick={handleLogout} title={t('logout')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span>{t('logout')}</span>
              </button>
            </div>
          </div>
        </header>
        <main className="app-main">
          <SuperAdminPanel session={session} onClose={() => {}} />
        </main>
      </div>
    );
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="header-logo">
          <img
            src="https://cdn.codia.ai/projects/aabfa738-0f57-48ee-af8c-38f843cd3eca/resource/ChatGPT%20Image%2021%20%C3%91-%C3%90%C2%B5%C3%90%C2%B2%C3%91-.%202026%20%C3%90%C2%B3.-%2014_34_50.png"
            alt="DentalHub"
            className="header-logo-img"
          />
          <span>DentalHub</span>
        </div>
        <div className="header-right">
          <span className="header-date">
            {new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>

          {/* Language switcher */}
          <div className="lang-switcher">
            <button
              className={`lang-btn${lang === 'ru' ? ' lang-btn--active' : ''}`}
              onClick={() => switchLang('ru')}>RU</button>
            <span className="lang-sep">|</span>
            <button
              className={`lang-btn${lang === 'tj' ? ' lang-btn--active' : ''}`}
              onClick={() => switchLang('tj')}>TJ</button>
          </div>

          {/* User info + logout */}
          <div className="header-user">
            <span className={`role-badge role-badge--${
              session.role === 'registrar' ? 'reg'
              : session.role === 'clinic_admin' ? 'clinic-admin'
              : session.role
            }`}>
              {session.role === 'clinic_admin' ? 'Адм. клиники' : (roleLabels[session.role] || session.role)}
            </span>
            <span className="header-username">{session.name || session.login}</span>

            {/* Settings — admin and clinic_admin */}
            {(session.role === 'admin' || session.role === 'clinic_admin') && (
              <button
                className={`btn-settings${view === 'settings' ? ' btn-settings--active' : ''}`}
                onClick={() => setView(view === 'settings' ? null : 'settings')}
                title={t('settingsTitle')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                </svg>
                <span>{t('settingsTitle')}</span>
              </button>
            )}

            <button className="btn-logout" onClick={handleLogout} title={t('logout')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>{t('logout')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {/* Subscription warning banner */}
        {subInfo && !subInfo.active && (
          <div className="sub-banner sub-banner--expired">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {t('subscriptionExpired')}
          </div>
        )}
        {subInfo && subInfo.active && subInfo.daysLeft !== null && subInfo.daysLeft <= 14 && (
          <div className="sub-banner sub-banner--warn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            {t('subscriptionExpiringSoon').replace('{n}', subInfo.daysLeft)}
          </div>
        )}

        {view === null && (
          <div className="home-screen">
            <div className="home-welcome">
              <h1>{t('welcome')}</h1>
              <p>{t('subtitle')}</p>
            </div>
            <div className="home-actions">
              <button className="action-btn action-btn--primary" onClick={() => setView('new')}>
                <span className="action-btn-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="5"/>
                    <path d="M3 21v-1a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7v1"/>
                    <line x1="12" y1="14" x2="12" y2="20"/>
                    <line x1="9" y1="17" x2="15" y2="17"/>
                  </svg>
                </span>
                <span className="action-btn-label">{t('newPatient')}</span>
                <span className="action-btn-sub">{t('newPatientSub')}</span>
              </button>

              <button className="action-btn action-btn--secondary" onClick={() => setView('find')}>
                <span className="action-btn-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </span>
                <span className="action-btn-label">{t('findPatient')}</span>
                <span className="action-btn-sub">{t('findPatientSub')}</span>
              </button>

              <button className="action-btn action-btn--calendar" onClick={() => setView('calendar')}>
                <span className="action-btn-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                    <line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/>
                    <line x1="8" y1="18" x2="8" y2="18"/><line x1="12" y1="18" x2="12" y2="18"/>
                  </svg>
                </span>
                <span className="action-btn-label">{t('calendarBtn')}</span>
                <span className="action-btn-sub">{t('calendarBtnSub')}</span>
              </button>

              <button className="action-btn action-btn--queue" onClick={() => setView('queue')}>
                <span className="action-btn-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                </span>
                <span className="action-btn-label">{t('queueBtn')}</span>
                <span className="action-btn-sub">{t('queueBtnSub')}</span>
              </button>
            </div>
          </div>
        )}

        {view === 'new' && (
          <NewPatientModal
            onClose={() => setView(null)}
            onSaved={newPatient => {
              setAutoOpenPatient(newPatient);
              setView('find');
            }}
            session={session}
          />
        )}

        {view === 'find' && (
          <FindPatientModal
            onClose={() => { setView(null); setAutoOpenPatient(null); }}
            session={session}
            initialPatient={autoOpenPatient}
          />
        )}

        {view === 'calendar' && (
          <AppointmentCalendar onClose={() => setView(null)} />
        )}

        {view === 'queue' && (
          <LiveQueue onClose={() => setView(null)} session={session} />
        )}

        {view === 'settings' && (session.role === 'admin' || session.role === 'clinic_admin') && (
          <SettingsPanel session={session} onClose={() => setView(null)} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <LangProvider>
      <AppInner />
    </LangProvider>
  );
}

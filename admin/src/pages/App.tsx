import React, { useState } from 'react';
import { LoginPage } from './LoginPage';
import { DashboardPage } from './DashboardPage';
import {
  AdminAuthSession,
  clearAdminAuth,
  loadAdminAuth,
  saveAdminAuth,
} from '../auth';

export const App: React.FC = () => {
  const [session, setSession] = useState<AdminAuthSession | null>(() =>
    loadAdminAuth(),
  );

  const handleLoggedIn = (nextSession: AdminAuthSession) => {
    saveAdminAuth(nextSession);
    setSession(nextSession);
  };

  const handleLogout = () => {
    clearAdminAuth();
    setSession(null);
  };

  if (!session) {
    return <LoginPage onLoggedIn={handleLoggedIn} />;
  }

  return (
    <DashboardPage
      session={session}
      onSessionChange={setSession}
      onLogout={handleLogout}
    />
  );
};


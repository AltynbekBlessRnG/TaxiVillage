import React, { useState } from 'react';
import { LoginPage } from './LoginPage';
import { DashboardPage } from './DashboardPage';

export const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);

  if (!token) {
    return <LoginPage onLoggedIn={setToken} />;
  }

  return <DashboardPage token={token} onLogout={() => setToken(null)} />;
};


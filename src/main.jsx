import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './AuthContext';
import { LangProvider } from './LangContext';
import { applyTheme, getTheme } from './prefs';
import './styles.css';

applyTheme(getTheme());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LangProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LangProvider>
  </React.StrictMode>
);

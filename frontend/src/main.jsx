import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { registerSW } from '@/utils/pwa';
import 'antd/dist/reset.css';
import './index.css';
import './mobile.css';

// Register PWA Service Worker
registerSW();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

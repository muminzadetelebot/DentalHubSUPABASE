import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import QueueDisplay from './components/QueueDisplay';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

// Render queue display board when hash is #queue-display (no auth required)
const isQueueDisplay = window.location.hash === '#queue-display';

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {isQueueDisplay ? <QueueDisplay /> : <App />}
  </React.StrictMode>,
);

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Theme} from '@astryxdesign/core/theme';
import {rightmoveTheme} from './themes/rightmove/rightmoveTheme';
import {Dashboard} from './pages/Dashboard';
import './styles/dashboard.css';

const propertyId = new URLSearchParams(location.search).get('property');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Theme theme={rightmoveTheme} mode="light">
      <Dashboard propertyId={propertyId} />
    </Theme>
  </StrictMode>,
);

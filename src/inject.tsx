import {StrictMode, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Theme} from '@astryxdesign/core/theme';
import {rightmoveTheme} from './themes/rightmove/rightmoveTheme';
import {WeatherPanel} from './components/WeatherPanel';
import {detectPropertyId} from './properties';
import './styles/panel.css';

const HEART_SELECTOR = '[data-test="saveHeart"]';

// Cloud-sun glyph, drawn to the same 24px box Rightmove's heart uses.
const BUTTON_SVG = `
<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/>
  <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/>
  <path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>
</svg>`;

function App({propertyId, triggers}: {propertyId: string; triggers: HTMLButtonElement[]}) {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    const open = () => setIsOpen(true);
    triggers.forEach(trigger => trigger.addEventListener('click', open));
    return () => triggers.forEach(trigger => trigger.removeEventListener('click', open));
  }, [triggers]);
  const params = new URLSearchParams(location.search);
  params.set('property', propertyId);
  const dashboardUrl = `/dashboard.html?${params}`;
  return <WeatherPanel propertyId={propertyId} isOpen={isOpen} onOpenChange={setIsOpen} dashboardUrl={dashboardUrl} />;
}

function makeTrigger(heart: HTMLButtonElement): HTMLButtonElement {
  const button = document.createElement('button');
  // Reuse Rightmove's own button class so sizing and hover match the heart.
  button.className = heart.className;
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'dialog');
  button.title = 'Weather insights for this property';
  button.setAttribute('aria-label', 'Weather insights for this property');
  button.dataset.test = 'weatherToMove';
  button.innerHTML = BUTTON_SVG;
  // Rightmove colours the heart red via `.class svg{fill:#d01406}`; ours is stroke-based.
  const svg = button.querySelector('svg')!;
  svg.style.fill = 'none';
  svg.style.color = '#000433';
  return button;
}

function mount() {
  const heart = document.querySelector<HTMLButtonElement>(HEART_SELECTOR);
  if (!heart || document.querySelector('[data-test="weatherToMove"]')) return false;

  const trigger = makeTrigger(heart);
  // Same 1px divider Rightmove draws between Share and Save.
  const divider = heart.previousElementSibling?.cloneNode(true) as HTMLElement | null;
  heart.after(trigger);
  if (divider && divider.tagName === 'DIV') heart.after(divider);

  const triggers = [trigger];
  const propertyHeader = heart.closest('main')?.querySelector('h1[itemprop="streetAddress"]');
  if (propertyHeader) {
    const mobileTrigger = makeTrigger(heart);
    mobileTrigger.className = 'wtm-mobile-trigger';
    mobileTrigger.append('Weather insights');
    const updateVisibility = () => {
      mobileTrigger.hidden = trigger.getClientRects().length > 0;
    };
    updateVisibility();
    propertyHeader.after(mobileTrigger);
    new ResizeObserver(updateVisibility).observe(trigger);
    triggers.push(mobileTrigger);
  }

  const host = document.createElement('div');
  host.id = 'wtm-root';
  document.body.appendChild(host);

  createRoot(host).render(
    <StrictMode>
      <Theme theme={rightmoveTheme} mode="light">
        <App propertyId={detectPropertyId()} triggers={triggers} />
      </Theme>
    </StrictMode>,
  );
  return true;
}

// The saved page renders its toolbar synchronously, but on the live site the
// toolbar arrives after hydration, so keep observing until the heart exists.
if (!mount()) {
  const observer = new MutationObserver(() => mount() && observer.disconnect());
  observer.observe(document.body, {childList: true, subtree: true});
}

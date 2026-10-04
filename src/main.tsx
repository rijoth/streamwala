import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initFocusEngine } from './shared/focus/index.ts';
import { initNativeBackBridge } from './shared/input/index.ts';

// Initialize TV remote spatial navigation engine before rendering the React tree
initFocusEngine();

// Route the Android hardware/remote BACK button into the shared input funnel.
// No-op on the web build.
initNativeBackBridge();

createRoot(document.getElementById('root')!).render(<App />);

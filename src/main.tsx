import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initFocusEngine } from './shared/focus/index.ts';
import { initNativeBackBridge } from './shared/input/index.ts';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from './shared/product.ts';

// Reflect the product name from its single source of truth in the tab title.
document.title = `${PRODUCT_NAME} - ${PRODUCT_TAGLINE}`;

// Initialize TV remote spatial navigation engine before rendering the React tree
initFocusEngine();

// Route the Android hardware/remote BACK button into the shared input funnel.
// No-op on the web build.
initNativeBackBridge();

createRoot(document.getElementById('root')!).render(<App />);

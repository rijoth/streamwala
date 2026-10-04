import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initFocusEngine } from './shared/focus/index.ts';

// Initialize TV remote spatial navigation engine before rendering the React tree
initFocusEngine();

createRoot(document.getElementById('root')!).render(<App />);

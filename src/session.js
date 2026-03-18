import './styles.css';
import { renderSessionPage } from './pages/session.js';

const app = document.querySelector('#app');
const sessionSlug = document.body.dataset.sessionSlug;
const sessionType = document.body.dataset.sessionType;

renderSessionPage(app, sessionType, sessionSlug);

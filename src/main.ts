// 오차드 2150 — 입구
import './art'; // 글꼴·그림 스타일 (art.css)
import './styles/main.css';
import './styles/learning.css';
import './styles/feedback.css';
import './styles/readability.css';
import './styles/title.css';
import './styles/notebook.css';
import './styles/effects.css';
import './styles/practice.css';
import './styles/responsive.css';
import './styles/board.css';
import { App } from './ui/app';

function boot(): void {
  const root = document.getElementById('app');
  if (!root) return;
  const debug = new URLSearchParams(location.search).get('debug') === '1';
  try {
    new App(root, { debug });
  } catch (e) {
    console.error(e);
    const p = document.createElement('p');
    p.className = 'boot-error';
    p.textContent = '게임을 시작하지 못했어요. 페이지를 새로 고쳐 주세요.';
    root.replaceChildren(p);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

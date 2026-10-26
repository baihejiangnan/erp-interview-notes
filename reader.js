(() => {
  'use strict';
  const panels = [...document.querySelectorAll('.panel')];
  const ids = new Set(panels.map(panel => panel.id));
  const nav = [...document.querySelectorAll('.module-nav .module-link')];
  const search = document.getElementById('search');
  const searchPanel = document.getElementById('search-panel');
  const results = document.getElementById('search-results');
  const caption = document.getElementById('search-caption');
  const toc = document.getElementById('toc');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');
  const menu = document.getElementById('menu-toggle');
  const root = document.documentElement;
  const index = JSON.parse(document.getElementById('search-index').textContent);
  let current = 'quick';
  let currentHeadings = [];
  let fontSize = 17;
  let savedPreference = null;
  // Local file previews and privacy modes can disable storage; reading must still work.
  try { savedPreference = JSON.parse(localStorage.getItem('erp-reading') || 'null'); }
  catch (error) { console.warn('Reading preferences are unavailable.', error); }
  if (savedPreference && ['light','dark'].includes(savedPreference.theme)) root.dataset.theme = savedPreference.theme;
  if (savedPreference && [16,17,18,19,20,21].includes(savedPreference.fontSize)) fontSize = savedPreference.fontSize;
  const fontDown = document.getElementById('font-down');
  const fontUp = document.getElementById('font-up');
  function applyFont() {
    root.style.setProperty('--reading-size', fontSize + 'px');
    fontDown.disabled = fontSize <= 16;
    fontUp.disabled = fontSize >= 21;
  }
  function savePreferences() {
    try { localStorage.setItem('erp-reading', JSON.stringify({ theme: root.dataset.theme || 'light', fontSize })); }
    catch (error) { console.warn('Reading preferences were not saved.', error); }
  }
  function setMenu(open) {
    sidebar.classList.toggle('open', open); overlay.classList.toggle('open', open);
    menu.setAttribute('aria-expanded', String(open));
    sidebar.inert = matchMedia('(max-width: 800px)').matches && !open;
  }
  function makeToc(panel) {
    toc.replaceChildren();
    currentHeadings = [...panel.querySelectorAll('article h2, article h3, article [data-toc]')];
    for (const heading of currentHeadings) {
      const link = document.createElement('a');
      link.href = '#' + heading.id;
      link.textContent = heading.dataset.toc || heading.textContent;
      if (heading.tagName === 'H3' || heading.classList.contains('qa')) link.className = 'sub';
      toc.append(link);
    }
  }
  function showPanel(id, target, focus = false) {
    current = id;
    panels.forEach(panel => { panel.hidden = panel.id !== id; });
    searchPanel.hidden = true;
    search.value = '';
    document.querySelector('.outline').hidden = id === 'interview';
    nav.forEach(link => {
      const active = link.dataset.panel === id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    const panel = document.getElementById(id);
    document.getElementById('current-breadcrumb').textContent = nav.find(link => link.dataset.panel === id).querySelector('strong').textContent;
    document.title = panel.dataset.title + ' · ERP 面试复习手册';
    makeToc(panel);
    setMenu(false);
    if (target && target !== panel) {
      let ancestor = target;
      while (ancestor && ancestor !== panel) { if (ancestor.tagName === 'DETAILS') ancestor.open = true; ancestor = ancestor.parentElement; }
      target.scrollIntoView({ behavior: 'instant', block: 'start' });
      target.classList.remove('target-flash'); void target.offsetWidth; target.classList.add('target-flash');
    } else { window.scrollTo({ top: 0, behavior: 'instant' }); if (focus) panel.querySelector('h1').focus({ preventScroll: true }); }
    updateProgress();
  }
  function route(focus = false) {
    const key = location.hash.slice(1);
    const target = document.getElementById(key);
    const panel = target?.closest('.panel');
    if (panel && ids.has(panel.id)) showPanel(panel.id, target, focus);
    else showPanel('quick', null, focus);
  }
  document.querySelectorAll('[data-panel],[data-goto]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    const id = link.dataset.panel || link.dataset.goto;
    if (location.hash === '#' + id) showPanel(id, null, true); else location.hash = id;
  }));
  window.addEventListener('hashchange', () => route(true));
  document.querySelectorAll('[data-expand]').forEach(button => button.addEventListener('click', () => button.closest('.panel').querySelectorAll('.qa').forEach(item => { item.open = button.dataset.expand === 'true'; })));
  document.querySelectorAll('.back-top').forEach(button => button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' })));
  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  overlay.addEventListener('click', () => { setMenu(false); menu.focus(); });
  matchMedia('(max-width: 800px)').addEventListener('change', () => setMenu(false));
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); search.focus(); search.select(); }
    if (event.key === 'Escape') { if (search.value) { search.value = ''; route(); search.focus(); } if (menu.getAttribute('aria-expanded') === 'true') { setMenu(false); menu.focus(); } }
  });
  fontDown.addEventListener('click', () => { fontSize = Math.max(16, fontSize - 1); applyFont(); savePreferences(); });
  fontUp.addEventListener('click', () => { fontSize = Math.min(21, fontSize + 1); applyFont(); savePreferences(); });
  const themeToggle = document.getElementById('theme-toggle');
  function labelTheme() { themeToggle.textContent = root.dataset.theme === 'dark' ? '日间' : '夜间'; themeToggle.setAttribute('aria-label', root.dataset.theme === 'dark' ? '切换日间阅读' : '切换夜间阅读'); }
  themeToggle.addEventListener('click', () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; labelTheme(); savePreferences(); });
  let printState = [];
  window.addEventListener('beforeprint', () => {
    const panel = document.getElementById(current);
    panels.forEach(item => item.classList.toggle('printing', item === panel));
    printState = [...panel.querySelectorAll('details')].map(item => [item, item.open]);
    printState.forEach(([item]) => { item.open = true; });
  });
  window.addEventListener('afterprint', () => { printState.forEach(([item, open]) => { item.open = open; }); panels.forEach(panel => panel.classList.remove('printing')); });
  document.getElementById('print-button').addEventListener('click', () => window.print());
  let searchTimer;
  search.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 100); });
  function runSearch() {
    const query = search.value.trim();
    if (!query) { route(); return; }
    panels.forEach(panel => { panel.hidden = true; });
    searchPanel.hidden = false;
    document.querySelector('.outline').hidden = true;
    results.replaceChildren();
    const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const found = index.filter(record => terms.every(term => (record.title + ' ' + record.text).toLocaleLowerCase().includes(term)));
    caption.textContent = `“${query}” · 找到 ${found.length} 个相关章节，覆盖全部阅读资料。`;
    for (const record of found) {
      const link = document.createElement('a'); link.href = '#' + record.id; link.className = 'search-result';
      const category = document.createElement('small'); category.textContent = record.category;
      const heading = document.createElement('h2'); heading.textContent = record.title;
      const snippet = document.createElement('p');
      const position = record.text.toLocaleLowerCase().indexOf(terms[0]);
      const start = Math.max(0, position - 35);
      snippet.textContent = (start ? '…' : '') + record.text.slice(start, start + 155) + (record.text.length > start + 155 ? '…' : '');
      link.append(category, heading, snippet);
      link.addEventListener('click', event => {
        if (location.hash === '#' + record.id) { event.preventDefault(); showPanel(record.panel, document.getElementById(record.id)); }
      });
      results.append(link);
    }
    if (!found.length) { const empty = document.createElement('p'); empty.className = 'search-empty'; empty.textContent = '没有找到相关内容。试试更短的词，例如“事务”“分页”“超时”，或按 Esc 返回正文。'; results.append(empty); }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function updateProgress() {
    if (!searchPanel.hidden) return;
    const panel = document.getElementById(current);
    const max = Math.max(1, panel.offsetHeight - innerHeight + 140);
    const progress = Math.min(100, Math.max(0, Math.round(scrollY / max * 100)));
    document.getElementById('reading-progress').textContent = '当前章节 · ' + progress + '%';
    let active = currentHeadings[0];
    for (const heading of currentHeadings) { if (heading.getClientRects().length && heading.getBoundingClientRect().top <= 150) active = heading; }
    [...toc.children].forEach(link => link.classList.toggle('current', link.hash === '#' + active?.id));
  }
  let scrollPending = false;
  window.addEventListener('scroll', () => { if (!scrollPending) { requestAnimationFrame(() => { updateProgress(); scrollPending = false; }); scrollPending = true; } }, { passive: true });
  const interviewQuestions = [...document.querySelectorAll('.qa')].map(item => ({
    title: item.querySelector('.question-label').textContent.trim(),
    category: item.closest('.panel').dataset.title,
    key: item.closest('.panel').id + ':' + item.querySelector('.question-label').textContent.trim(),
    body: item.querySelector('.qa-body')
  }));
  const questionKeys = new Set(interviewQuestions.map(question => question.key));
  const pool = document.getElementById('interview-pool');
  const card = document.getElementById('interview-card');
  const interviewStatus = document.getElementById('interview-status');
  const storageNotice = document.getElementById('interview-storage');
  const interviewTitle = document.getElementById('interview-question');
  const answer = document.getElementById('interview-answer');
  const reveal = document.getElementById('interview-reveal');
  const mark = document.getElementById('interview-mark');
  let weakQuestions = new Set();
  let remaining = [];
  let activeQuestion = null;
  let drawn = 0;
  try {
    const saved = JSON.parse(localStorage.getItem('erp-interview-weak') || '[]');
    if (!Array.isArray(saved) || saved.some(key => typeof key !== 'string')) throw new Error('Invalid interview marks.');
    weakQuestions = new Set(saved.filter(key => questionKeys.has(key)));
  } catch (error) {
    storageNotice.hidden = false;
    storageNotice.textContent = '无法读取本地标记。可以继续练习，本次标记暂存在页面中。';
    console.warn('Interview marks could not be loaded.', error);
  }
  function updateInterviewStatus() {
    interviewStatus.textContent = `本轮已抽 ${drawn} 题 · 剩余 ${remaining.filter(question => pool.value === 'all' || weakQuestions.has(question.key)).length} 题 · 未掌握 ${weakQuestions.size} 题`;
    const isWeak = activeQuestion && weakQuestions.has(activeQuestion.key);
    mark.classList.toggle('is-weak', Boolean(isWeak));
    mark.textContent = isWeak ? '已掌握，移出复习' : '标记未掌握';
    document.getElementById('interview-mark-status').textContent = isWeak ? '已标记：还没掌握' : '';
  }
  function drawQuestion(focus = true) {
    remaining = remaining.filter(question => pool.value === 'all' || weakQuestions.has(question.key));
    if (!remaining.length) {
      remaining = interviewQuestions.filter(question => pool.value === 'all' || weakQuestions.has(question.key));
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      if (remaining.length > 1 && remaining.at(-1).key === activeQuestion?.key) {
        [remaining[0], remaining[remaining.length - 1]] = [remaining.at(-1), remaining[0]];
      }
      drawn = 0;
    }
    activeQuestion = remaining.pop() || null;
    card.hidden = !activeQuestion;
    document.getElementById('interview-empty').hidden = Boolean(activeQuestion);
    answer.hidden = true;
    answer.replaceChildren();
    reveal.setAttribute('aria-expanded', 'false');
    reveal.disabled = false;
    reveal.textContent = '我答完了，查看参考';
    if (activeQuestion) {
      drawn++;
      interviewTitle.textContent = activeQuestion.title;
      document.getElementById('interview-category').textContent = activeQuestion.category;
      if (focus) {
        interviewTitle.focus({preventScroll: true});
        interviewTitle.scrollIntoView({block: 'start', behavior: 'instant'});
      }
    }
    updateInterviewStatus();
  }
  reveal.addEventListener('click', () => {
    answer.replaceChildren(...activeQuestion.body.cloneNode(true).childNodes);
    answer.hidden = false;
    reveal.setAttribute('aria-expanded', 'true');
    reveal.textContent = '参考答案已展开';
    reveal.disabled = true;
  });
  mark.addEventListener('click', () => {
    if (weakQuestions.has(activeQuestion.key)) weakQuestions.delete(activeQuestion.key);
    else weakQuestions.add(activeQuestion.key);
    try {
      localStorage.setItem('erp-interview-weak', JSON.stringify([...weakQuestions]));
      storageNotice.hidden = true;
    } catch (error) {
      storageNotice.hidden = false;
      storageNotice.textContent = '浏览器未能保存标记。本次仍可练习，关闭或刷新后标记可能丢失。';
      console.warn('Interview marks could not be saved.', error);
    }
    updateInterviewStatus();
  });
  document.getElementById('interview-next').addEventListener('click', () => drawQuestion());
  pool.addEventListener('change', () => {
    remaining = [];
    drawQuestion(false);
  });
  drawQuestion(false);
  applyFont(); labelTheme(); route();
})();

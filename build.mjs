import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { marked } = await import(pathToFileURL(require.resolve('marked')).href);
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const plain = html => html.replace(/<[^>]*>/g, ' ').replace(/&(?:lt|gt|amp|quot|#39);/g, entity => ({'&lt;':'<','&gt;':'>','&amp;':'&','&quot;':'"','&#39;':"'"})[entity]).replace(/\s+/g, ' ').trim();
const sections = text => text.split(/^## /m).slice(1).map(section => '## ' + section);
const general = sections(read('sources/岗位准备.md'));
const project = sections(read('sources/ERP口述.md'));
const agent = read('sources/知识库Agent口述.md');
assert.equal(general.length, 8);
assert.equal(project.length, 7);

const modules = [
  {id:'quick', title:'上场准备', subtitle:'U8 · ERP · 入职动机', meta:'先练开场 · 30 秒与 90 秒版本', description:'先讲 U8 怎么认识 ERP，再讲为什么投汉得，最后落到实际做的 Agent 平台联调。', content:[general[1],general[0]].join('\n')},
  {id:'interview', title:'模拟面试', subtitle:'随机抽题 · 未掌握复习', meta:'40 道题 · 先回答，再看参考', description:'把手机当作面试官：随机抽一道题，先口述回答，再查看参考，标记还需要复习的地方。', content:read('interview.html')},
  {id:'project', title:'汉得经历线', subtitle:'U8 → ERP → Agent 平台', meta:'一条能自圆其说的叙事', description:'学校 U8 打底，冲着 ERP 投汉得，入职分到企业 Agent 平台做接口联调；边界清楚，动机成立。', content:agent.replace(/^# .*\n+/, '')},
  {id:'deep', title:'ERP 场景追问', subtitle:'事务、防重与分页', meta:'20 道追问 · 先回答，再展开参考', description:'重点练事务回滚、重复提交、前端去重与 DISTINCT。这里作为设计练习，不作为汉得实绩。', content:project.slice(3,5).join('\n')},
  {id:'questions', title:'岗位高频问答', subtitle:'20 道题与连续追问', meta:'Java / MySQL / ERP / AI', description:'每题先脱稿讲 40 至 90 秒，再展开答案。先答当前问题，被追问后再往下讲。', content:general[4]},
  {id:'practice', title:'场景与模拟', subtitle:'SQL 练习、模拟与反问', meta:'35 分钟模拟 · 面试前两小时路线', description:'用两个 ERP 场景检查理解，再完成一轮模拟。最后只复习答不清的地方。', content:general.slice(5).join('\n')},
  {id:'notes', title:'补充与核实', subtitle:'经历回忆与候选故事', meta:'已有依据 / 待核实示例 / 场景方案', description:'找回真实模块与接口，选择能解释清楚的故事。保留参考与事实之间的边界。', content:[general[2],general[3],project[6]].join('\n')}
];
const searchIndex = [];
let questionCount = 0;
function render(module) {
  let sequence = 0;
  let html = marked.parse(module.content);
  html = html.replace(/<h([23])>(.*?)<\/h\1>/gs, (_, level, title) => `<h${level} id="${module.id}-${++sequence}">${title.replace(/^[一二三四五六七八九十]+ /, '')}</h${level}>`);
  const question = (id, title, body) => {
    questionCount++;
    const text = plain(title);
    const number = text.match(/^\d+/)[0];
    return `<details class="qa" id="${id}" data-toc="${escape(text)}"><summary><span class="question-number">${number.padStart(2,'0')}</span><span class="question-label">${title.replace(/^\d+\s*/, '')}</span><span class="disclosure" aria-hidden="true"></span></summary><div class="qa-body">${body}</div></details>`;
  };
  if (module.id === 'questions') html = html.replace(/<h3 id="([^"]+)">(\d+ .*?)<\/h3>(.*?)(?=<h[23] |$)/gs, (_,id,title,body) => question(id,title,body));
  if (module.id === 'deep') html = html.replace(/<p><strong>(\d+ .*?)<\/strong><\/p>(.*?)(?=<p><strong>\d+ |<h[23] |$)/gs, (_,title,body) => question(`${module.id}-q${++sequence}`,title,body));
  html = html.replace(/<table>/g, '<div class="table-scroll" tabindex="0" role="region" aria-label="可横向滑动的对照表"><table>').replace(/<\/table>/g, '</table></div>');
  html = html.replace(/<a href="(https?:[^\"]+)"/g, '<a target="_blank" rel="noopener noreferrer" href="$1"');
  const positions = [...html.matchAll(/<h[23] id="([^"]+)">(.*?)<\/h[23]>|<details class="qa" id="([^"]+)" data-toc="([^"]+)"/gs)];
  positions.forEach((match, i) => searchIndex.push({panel:module.id,category:module.title,id:match[1] || match[3], title:plain(match[2] || match[4]),text:plain(html.slice(match.index, positions[i+1]?.index ?? html.length))}));
  const tools = html.includes('<details') ? '<div class="chapter-tools"><button type="button" data-expand="true">展开全部答案</button><button type="button" data-expand="false">收起全部答案</button><span>先试着回答，再点题目看参考。</span></div>' : '';
  return `<section id="${module.id}" class="panel" data-title="${module.title}" ${module.id === 'quick' ? '' : 'hidden'}><header class="chapter-header"><p class="chapter-meta">${module.meta}</p><h1 tabindex="-1">${module.title}</h1><p class="chapter-description">${module.description}</p></header>${module.id === 'quick' ? '<div class="reading-route"><span class="route-label">从这里开始</span><div><button data-goto="project">讲经历</button><span aria-hidden="true">→</span><button data-goto="deep">练追问</button><span aria-hidden="true">→</span><button data-goto="interview">随机抽题</button></div><p>碎片时间查一个问题，完整时间脱稿练一轮。</p></div>' : ''}${tools}<article class="prose">${html}</article><footer class="chapter-footer"><p>具体模块与故障为待核实示例；场景方案不代表已经完成的工作。</p><button type="button" class="back-top">回到本章开头 ↑</button></footer></section>`;
}
const panels = modules.map(render).join('\n');
assert.equal(questionCount, 40, 'Expected 20 project follow-ups and 20 role questions.');
const nav = modules.map((module,i) => `<a class="module-link ${i === 0 ? 'active' : ''}" href="#${module.id}" data-panel="${module.id}" ${i === 0 ? 'aria-current="page"' : ''}><span class="module-no">${String(i+1).padStart(2,'0')}</span><span><strong>${module.title}</strong><small>${module.subtitle}</small></span><span class="nav-arrow" aria-hidden="true">↗</span></a>`).join('');
const css = read('reader.css');
const js = read('reader.js');
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="ERP Java 开发面试复习手册，包含项目口述、40 道问答、事务与分页追问、模拟面试。"><meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="light dark"><meta name="theme-color" content="#f6f7f2"><link rel="icon" href="data:,"><title>ERP 面试复习手册</title><style>${css}</style></head>
<body><a class="skip-link" href="#main-content">跳到正文</a><div class="shell"><aside class="sidebar" id="sidebar" aria-label="学习栏目"><a class="brand" href="#quick" data-panel="quick"><span class="brand-monogram" aria-hidden="true">E.</span><span class="brand-text"><strong>ERP 面试复习手册</strong><small>INTERVIEW FIELD NOTES</small></span></a><p class="sidebar-label">${modules.length} 个栏目，按需练习</p><nav class="module-nav" aria-label="主导航">${nav}</nav><div class="sidebar-note"><strong>把一条业务链路讲完整。</strong><p>Java 后端 · ERP 业务<br>口述稿 + 接口 + 连续追问<br>每次练清楚一个问题。</p></div><div class="sidebar-bottom">个人学习资料 / 更新于 2026.10.26<br>纯静态页面，无统计脚本</div></aside><button class="mobile-overlay" id="mobile-overlay" aria-label="关闭栏目导航" tabindex="-1"></button><div class="main-shell"><header class="topbar"><button class="tool-button menu-button" id="menu-toggle" aria-controls="sidebar" aria-expanded="false">目录</button><div class="breadcrumb">学习手册 <span id="current-breadcrumb">上场准备</span></div><div class="toolbar"><label class="search-box"><span class="search-symbol" aria-hidden="true">⌕</span><input id="search" type="search" placeholder="搜索全部资料" aria-label="搜索全部资料" autocomplete="off"><kbd>Ctrl K</kbd></label><button class="tool-button" id="font-down" aria-label="缩小正文字号" title="缩小字号">A−</button><button class="tool-button" id="font-up" aria-label="放大正文字号" title="放大字号">A＋</button><button class="tool-button" id="theme-toggle" aria-label="切换夜间阅读">夜间</button><button class="tool-button print-button" id="print-button">打印</button></div></header><div class="content-layout"><main class="reader" id="main-content"><noscript><p class="noscript-note">未启用 JavaScript，下方显示全部资料；搜索、目录切换和字号设置需要启用 JavaScript。</p><style>.panel[hidden]{display:block!important}.outline{display:none}</style></noscript>${panels}<section class="search-panel" id="search-panel" aria-label="搜索结果" hidden><h1>在整本手册里查找</h1><p class="search-caption" id="search-caption" role="status" aria-live="polite"></p><div id="search-results"></div></section></main><aside class="outline" aria-label="本章目录"><p class="outline-title">本章内容</p><nav class="toc" id="toc" aria-label="章节目录"></nav><div class="outline-progress"><span id="reading-progress">当前章节 · 0%</span><br>也可以从顶部搜索。</div></aside></div></div></div><script id="search-index" type="application/json">${JSON.stringify(searchIndex).replaceAll('<','\\u003c')}</script><script>${js}</script></body></html>`;
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Heading and control IDs must be unique.');
for (const record of searchIndex) assert(ids.includes(record.id));
assert(searchIndex.some(record => record.title.includes('DISTINCT')));
assert(searchIndex.some(record => record.title.includes('catch')));
assert(!/C:[\\/]|(?<!\d)1[3-9]\d{9}(?!\d)|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|sk-proj-|gh[op]_[A-Za-z0-9]/i.test(html), 'Private source paths or contact details found.');
for (const [,href] of html.matchAll(/href="([^"]+)"/g)) assert(href.startsWith('#') || href.startsWith('https://') || href === 'data:,', `Unexpected link: ${href}`);
writeFileSync(new URL('index.html', import.meta.url), html);
console.log(JSON.stringify({modules:modules.length,questions:questionCount,searchEntries:searchIndex.length,bytes:Buffer.byteLength(html)}));

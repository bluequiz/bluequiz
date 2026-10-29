// 학생 데이터는 모두 textContent·속성으로만 넣는다(innerHTML 사용 금지).
const $ = id => document.getElementById(id);
const normalize = s => s.normalize('NFC').replace(/[\s*]+/g, '');
const fmt = ms => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
};

let data;
let game;

function readSettings() {
  const pick = name => document.querySelector(`input[name="${name}"]:checked`).value;
  return {
    mode: pick('mode'),
    limit: Number(pick('limit')),
    server: pick('server'),
    collab: pick('collab') === 'on',
    unreleased: pick('unreleased'),
    silhouette: pick('cover') === 'silhouette',
  };
}

const settingsKey = s =>
  `baquiz:best:${s.mode}${s.mode === 'timed' ? s.limit : ''}:${s.server}:${s.collab ? 'collab' : 'base'}${s.unreleased === 'off' ? '' : `:unreleased-${s.unreleased}`}:${s.silhouette ? 'sil' : 'mark'}`;

function settingsLabel(s) {
  return [
    s.mode === 'timed' ? `타이머 ${s.limit}분` : '무제한',
    s.server === 'jp' ? '일본 포함' : '글로벌',
    s.collab ? '콜라보 포함' : '콜라보 제외',
    ...({ global: ['미실장(글로벌 등장)'], all: ['미실장 전부'] }[s.unreleased] ?? []),
    s.silhouette ? '실루엣' : '물음표',
  ].join(' · ');
}

// 아이콘이 아직 없는 학생(예: 프라나)은 깨진 그림 대신 빈 칸으로 둔다.
function studentImage(st, className) {
  const img = el('img', className);
  img.src = `img/students/${st.id}.webp`;
  img.alt = '';
  img.loading = 'lazy';
  img.addEventListener('error', () => img.remove());
  return img;
}

function pickStudents(s) {
  return data.students.filter(st =>
    (st.unreleased ? s.unreleased === 'all' || (s.unreleased === 'global' && st.unreleased === 'global')
      : s.server === 'jp' ? st.jp : st.global) && (s.collab || st.section !== 'Collab'));
}

const better = (a, b) => !b || a.score > b.score || (a.score === b.score && a.time < b.time);
const bestText = best => (best ? `최고 ${best.score}명 · ${fmt(best.time)}` : '기록 없음');

function updateSetup() {
  const s = readSettings();
  $('limit-option').hidden = s.mode !== 'timed';
  if (!data) return;
  $('setup-count').textContent = pickStudents(s).length;
  $('setup-best').textContent = bestText(store.get(settingsKey(s)));
}

function buildBoard(students, silhouette) {
  const board = $('board');
  board.replaceChildren();
  const sections = new Map();
  for (const section of data.sections) {
    const list = students.filter(st => st.section === section.id);
    if (!list.length) continue;
    const root = el('section', 'section');
    const head = el('div', 'section-head');
    const count = el('span', 'count');
    const bar = el('i');
    const rule = el('div', 'rule');
    rule.append(bar);
    head.append(el('h2', null, section.name), count, rule);
    const grid = el('div', 'grid');
    root.append(head, grid);
    board.append(root);
    sections.set(section.id, { root, count, bar, total: list.length, found: 0 });
  }
  const cards = new Map();
  for (const st of students) {
    const card = el('div', 'card');
    const face = el('div', 'face', silhouette ? undefined : '?');
    if (silhouette) {
      face.append(studentImage(st, 'sil'));
    }
    const name = el('div', 'name', '???');
    card.append(face, name);
    sections.get(st.section).root.querySelector('.grid').append(card);
    cards.set(st.id, { card, face, name });
  }
  return { sections, cards };
}

function paintSection(sec) {
  sec.count.textContent = `${sec.found} / ${sec.total}`;
  sec.bar.style.width = `${(sec.found / sec.total) * 100}%`;
  sec.root.classList.toggle('done', sec.found === sec.total);
}

function showStudent(st, state) {
  const { card, face, name } = game.cards.get(st.id);
  let img = face.querySelector('img');
  if (!img) {
    img = studentImage(st);
    face.replaceChildren(img);
  }
  img.classList.remove('sil');
  img.alt = st.name;
  name.textContent = st.name;
  card.classList.add(state);
}

function start() {
  if (game) clearInterval(game.timer);
  const settings = readSettings();
  const students = pickStudents(settings);
  // 같은 정답은 출제 순서(키보토스 학생 → 콜라보)대로 아직 안 열린 학생을 연다.
  const answers = new Map();
  for (const st of students) {
    for (const a of st.answers) answers.set(a, [...(answers.get(a) ?? []), st]);
  }
  game = { settings, students, answers, found: new Set(), startedAt: performance.now(), over: false, ...buildBoard(students, settings.silhouette) };
  for (const sec of game.sections.values()) paintSection(sec);
  $('total').textContent = students.length;
  $('score').textContent = 0;
  $('clock-label').textContent = settings.mode === 'timed' ? '남은 시간' : '경과';
  $('answer').disabled = false;
  $('answer').value = '';
  feedback('');
  setGiveupArmed(false);
  $('giveup').hidden = false;
  $('setup').hidden = true;
  $('notice').hidden = true;
  $('game').hidden = false;
  $('answer').focus();
  game.timer = setInterval(tick, 250);
  tick();
}

function elapsed() {
  return Math.min(performance.now() - game.startedAt, game.settings.mode === 'timed' ? game.settings.limit * 60000 : Infinity);
}

function tick() {
  if (game.over) return;
  const used = elapsed();
  const clock = $('clock');
  if (game.settings.mode === 'timed') {
    const left = game.settings.limit * 60000 - used;
    clock.textContent = fmt(Math.ceil(left / 1000) * 1000);
    clock.classList.toggle('warn', left <= 60000);
    if (left <= 0) finish('timeout');
  } else {
    clock.textContent = fmt(used);
    clock.classList.remove('warn');
  }
}

function submit(event) {
  event.preventDefault();
  if (!game || game.over) return;
  const input = $('answer');
  const value = normalize(input.value);
  if (!value) return;
  const matches = game.answers.get(value);
  const next = matches?.find(st => !game.found.has(st.id));
  if (!matches) {
    feedback(`"${input.value.trim()}"은(는) 없는 이름입니다`);
  } else if (!next) {
    feedback('이미 맞힌 학생입니다');
  } else {
    game.found.add(next.id);
    showStudent(next, 'revealed');
    const sec = game.sections.get(next.section);
    sec.found++;
    paintSection(sec);
    $('score').textContent = game.found.size;
    feedback('');
    toast(next);
    input.value = '';
    if (game.found.size === game.students.length) finish('clear');
    return;
  }
  input.classList.remove('shake');
  void input.offsetWidth;
  input.classList.add('shake');
}

// 틀린 입력은 지우고, 안내 문구를 입력칸의 빈칸 안내(placeholder) 자리에 빨간색으로 보여 준다.
const PLACEHOLDER = '이름 입력 후 Enter';
function feedback(text) {
  const input = $('answer');
  if (text) input.value = '';
  input.placeholder = text || PLACEHOLDER;
  input.classList.toggle('error', Boolean(text));
  $('feedback').textContent = text;
}

function toast(st) {
  const box = el('div', 'toast', st.name);
  box.append(el('span', null, data.sections.find(s => s.id === st.section).name));
  $('toasts').append(box);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  setTimeout(() => box.remove(), 2200);
}

function finish(reason) {
  if (game.over) return;
  game.over = true;
  clearInterval(game.timer);
  tick();
  const time = elapsed();
  $('answer').disabled = true;
  feedback('');
  setGiveupArmed(false);
  $('giveup').hidden = true;
  for (const st of game.students) if (!game.found.has(st.id)) showStudent(st, 'missed');

  const record = { score: game.found.size, time };
  const key = settingsKey(game.settings);
  const prev = store.get(key);
  const isBest = record.score > 0 && better(record, prev);
  if (isBest) store.set(key, record);

  $('result-mode').textContent = settingsLabel(game.settings);
  $('result-title').textContent = { clear: '전원 정답', timeout: '시간 종료', giveup: '포기' }[reason];
  $('result-score').textContent = record.score;
  $('result-total').textContent = `/ ${game.students.length}`;
  $('result-time-label').textContent = game.settings.mode === 'timed' ? '사용 시간' : '기록';
  $('result-time').textContent = fmt(time);
  $('result-best').textContent = isBest ? '이번 기록' : prev ? `${prev.score}명 · ${fmt(prev.time)}` : '-';
  game.result = record;
  $('result').showModal();
}

let giveupTimer;
function setGiveupArmed(armed) {
  clearTimeout(giveupTimer);
  const btn = $('giveup');
  btn.textContent = armed ? '정말 포기?' : '포기';
  btn.classList.toggle('danger', armed);
  btn.dataset.armed = armed ? '1' : '';
  if (armed) giveupTimer = setTimeout(() => setGiveupArmed(false), 3000);
}

async function copyResult() {
  const text = `블루아카이브 기억력 테스트 (${settingsLabel(game.settings)})\n${game.result.score} / ${game.students.length} · ${fmt(game.result.time)}\n${location.origin}${location.pathname}`;
  try {
    await navigator.clipboard.writeText(text);
    $('copy').textContent = '복사됨';
  } catch {
    $('copy').textContent = '복사 실패';
  }
  setTimeout(() => { $('copy').textContent = '결과 복사'; }, 1500);
}

function toSetup() {
  if (game) { game.over = true; clearInterval(game.timer); }
  $('result').close();
  $('game').hidden = true;
  $('setup').hidden = false;
  $('notice').hidden = false;
  updateSetup();
}

document.querySelectorAll('#setup input').forEach(input => input.addEventListener('change', updateSetup));
$('start').addEventListener('click', start);
$('answer-form').addEventListener('submit', submit);
$('answer').addEventListener('input', () => { if ($('answer').classList.contains('error')) feedback(''); });
$('giveup').addEventListener('click', () => {
  if (game.over) return;
  if ($('giveup').dataset.armed) finish('giveup');
  else setGiveupArmed(true);
});
$('restart').addEventListener('click', () => { $('result').close(); start(); });
$('to-setup').addEventListener('click', () => {
  if (game && !game.over) $('leave').showModal();
  else toSetup();
});
$('leave-ok').addEventListener('click', () => { $('leave').close(); toSetup(); });
$('leave-cancel').addEventListener('click', () => { $('leave').close(); $('answer').focus(); });
$('result-restart').addEventListener('click', () => { $('result').close(); start(); });
$('result-close').addEventListener('click', () => $('result').close());
$('copy').addEventListener('click', copyResult);

updateSetup();
try {
  // 학생 목록이 바뀌었는데 브라우저에 남은 옛 목록을 쓰지 않도록 매번 서버에 확인한다.
  const res = await fetch('data/students.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(res.status);
  data = await res.json();
  const date = new Date(data.generatedAt);
  $('data-date').textContent = `${date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} 기준`;
  $('lead-date').textContent = date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' });
  $('start').disabled = false;
  updateSetup();
} catch {
  $('load-error').hidden = false;
}

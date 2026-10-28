// SchaleDB 학생 데이터를 받아 data/students.json과 img/students/*.webp를 만든다.
// 실행: node scripts/update-data.mjs  (Node 18 이상, 의존성 없음)
import { mkdir, readFile, readdir, unlink, writeFile, access } from 'node:fs/promises';

const BASE = 'https://schaledb.com';
const ROOT = new URL('../', import.meta.url);
const IMG_DIR = new URL('img/students/', ROOT);
const SCHOOL_ORDER = [
  'Abydos', 'Gehenna', 'Millennium', 'Trinity', 'Hyakkiyako', 'Shanhaijing', 'RedWinter',
  'Valkyrie', 'SRT', 'Arius', 'Highlander', 'WildHunt', 'Odyssey',
];

const isAlt = s => /[(*（]/.test(s.Name);
const baseName = name => name.replace(/\s*[(*（].*$/, '').trim();
const normalize = s => s.normalize('NFC').replace(/\s+/g, '');

async function getJson(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function download(id) {
  const file = new URL(`${id}.webp`, IMG_DIR);
  try { await access(file); return false; } catch {}
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE}/images/student/icon/${id}.webp`);
    if (res.ok) {
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      return true;
    }
    if (attempt >= 3) throw new Error(`아이콘 ${id}: HTTP ${res.status}`);
    await new Promise(r => setTimeout(r, 1000 * attempt));
  }
}

const overrides = JSON.parse(await readFile(new URL('data/overrides.json', ROOT), 'utf8'));
const collab = new Set(overrides.collab);
const [raw, loc] = await Promise.all([
  getJson('/data/kr/students.min.json'),
  getJson('/data/kr/localization.min.json'),
]);
const entries = Object.values(raw);
const known = new Set(entries.map(s => s.Id));
for (const id of [...collab, ...Object.keys(overrides.separate).map(Number)]) {
  if (!known.has(id)) console.warn(`overrides.json의 학생 ID ${id}가 SchaleDB에 없습니다.`);
}

// 같은 사람(성+이름)의 이격을 한 칸으로 묶는다. separate에 적힌 학생은 따로 한 칸이 된다.
const groups = new Map();
for (const s of entries) {
  const key = overrides.separate[s.Id] ? `id:${s.Id}` : `${s.FamilyName}|${s.PersonalName}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(s);
}

const students = [];
for (const versions of groups.values()) {
  versions.sort((a, b) => a.Id - b.Id);
  const rep = versions.find(s => !isAlt(s)) ?? versions[0];
  const override = overrides.separate[rep.Id];
  const isCollab = versions.some(s => collab.has(s.Id));
  const name = override?.name ?? (isCollab ? rep.Name : baseName(rep.Name));
  const answers = override?.answers ?? [isCollab ? rep.PersonalName : baseName(rep.Name)];
  students.push({
    id: rep.Id,
    name,
    answers: [...new Set(answers.map(normalize))],
    section: isCollab ? 'Collab' : rep.School,
    jp: versions.some(s => s.IsReleased[0]),
    global: versions.some(s => s.IsReleased[1]),
  });
}

const order = id => {
  if (id === 'ETC') return 1000;
  if (id === 'Collab') return 1001;
  const i = SCHOOL_ORDER.indexOf(id);
  return i === -1 ? 999 : i;
};
students.sort((a, b) => order(a.section) - order(b.section) || a.id - b.id);
const sections = [...new Set(students.map(s => s.section))].map(id => ({
  id,
  name: id === 'Collab' ? '콜라보' : loc.School[id] ?? id,
}));

// 같은 정답을 가진 학생이 있으면 앱은 입력할 때마다 아직 안 열린 쪽을 순서대로 연다.
const byAnswer = new Map();
for (const s of students) for (const a of s.answers) byAnswer.set(a, [...(byAnswer.get(a) ?? []), s.name]);
for (const [answer, names] of byAnswer) {
  if (names.length > 1) console.warn(`정답 "${answer}"이 겹칩니다: ${names.join(', ')}`);
}

await mkdir(IMG_DIR, { recursive: true });
const wanted = new Set(students.map(s => `${s.id}.webp`));
let downloaded = 0;
const queue = [...students];
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let s; (s = queue.shift());) if (await download(s.id)) downloaded++;
}));
let removed = 0;
for (const file of await readdir(IMG_DIR)) {
  if (file.endsWith('.webp') && !wanted.has(file)) { await unlink(new URL(file, IMG_DIR)); removed++; }
}

// 내용이 같으면 기준일을 그대로 둬서 갱신 작업이 빈 커밋을 만들지 않게 한다.
const outFile = new URL('data/students.json', ROOT);
let generatedAt = new Date().toISOString();
try {
  const prev = JSON.parse(await readFile(outFile, 'utf8'));
  if (JSON.stringify({ sections: prev.sections, students: prev.students }) === JSON.stringify({ sections, students })) {
    generatedAt = prev.generatedAt;
  }
} catch {}
await writeFile(outFile, JSON.stringify({ generatedAt, sections, students }, null, 1) + '\n');
console.log(`학생 ${students.length}명 (글로벌 ${students.filter(s => s.global).length}), 아이콘 새로 받음 ${downloaded}, 지움 ${removed}`);

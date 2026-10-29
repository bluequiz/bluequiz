// SchaleDB 학생 데이터와 data/unreleased.json(미실장 학생)을 합쳐 data/students.json을 만들고,
// 출시 학생 아이콘을 img/students/*.webp로 받는다. 미실장 학생 아이콘은 scripts/fetch-unreleased-icons.py가 만든다.
// 정렬은 data/order.json(나무위키 「틀:블루 아카이브/등장인물」 순서)을 따른다.
// 실행: node scripts/update-data.mjs  (Node 18 이상, 의존성 없음)
import { mkdir, readFile, readdir, unlink, writeFile, access } from 'node:fs/promises';

const BASE = 'https://schaledb.com';
const ROOT = new URL('../', import.meta.url);
const IMG_DIR = new URL('img/students/', ROOT);
const SECTION_NAMES = { Chronos: '크로노스', ETC: '기타', Collab: '콜라보', GSC: '총학생회' };

const isAlt = s => /[(*（]/.test(s.Name);
const baseName = name => name.replace(/\s*[(*（].*$/, '').trim();
const normalize = s => s.normalize('NFC').replace(/[\s*]+/g, '');
const readJson = async path => JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));

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

const overrides = await readJson('data/overrides.json');
const unreleased = await readJson('data/unreleased.json');
const order = await readJson('data/order.json');
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
  const base = versions.find(s => !isAlt(s));
  const override = overrides.separate[versions[0].Id];
  // 이격 버전만 있는 학생(예: 슈에링)은 이격으로 보고 뺀다.
  if (!base && !override) continue;
  const rep = base ?? versions[0];
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
    fullName: `${rep.FamilyName} ${rep.PersonalName}`.trim(),
  });
}

const releasedNames = new Set(students.map(s => s.fullName));
// unreleased.json에서 "jp": true인 학생은 일본 서버에 나왔지만 SchaleDB에 아직 없는 학생이다.
for (const u of unreleased) {
  if (releasedNames.has(u.page)) console.warn(`"${u.page}"이 SchaleDB에 들어왔습니다. data/unreleased.json에서 빼세요.`);
  const student = { id: u.id, name: u.name, answers: [normalize(u.name)], section: u.section, jp: Boolean(u.jp), global: false, fullName: u.page };
  if (!u.jp) student.unreleased = true;
  students.push(student);
}

const sectionIndex = id => {
  const i = order.sections.indexOf(id);
  return i === -1 ? order.sections.indexOf('ETC') - 0.5 : i;
};
const nameIndex = s => {
  const list = order.names[s.section] ?? [];
  const i = [s.name, s.fullName, ...s.answers].map(n => list.indexOf(n)).find(n => n !== -1);
  return i ?? Infinity;
};
const unordered = students.filter(s => nameIndex(s) === Infinity).map(s => s.name);
if (unordered.length) console.warn(`order.json에 없어 맨 뒤로 보낸 학생: ${unordered.join(', ')}`);
students.sort((a, b) => sectionIndex(a.section) - sectionIndex(b.section) || nameIndex(a) - nameIndex(b) || String(a.id).localeCompare(String(b.id), 'en', { numeric: true }));
for (const s of students) delete s.fullName;

const sections = [...new Set(students.map(s => s.section))].map(id => ({
  id,
  name: SECTION_NAMES[id] ?? loc.School[id] ?? id,
}));

// 같은 정답을 가진 학생이 있으면 앱은 입력할 때마다 아직 안 열린 쪽을 순서대로 연다.
const byAnswer = new Map();
for (const s of students) for (const a of s.answers) byAnswer.set(a, [...(byAnswer.get(a) ?? []), s.name]);
for (const [answer, names] of byAnswer) {
  if (names.length > 1) console.warn(`정답 "${answer}"이 겹칩니다: ${names.join(', ')}`);
}

await mkdir(IMG_DIR, { recursive: true });
const manual = new Set(unreleased.map(u => u.id));
const released = students.filter(s => !s.unreleased);
let downloaded = 0;
const queue = released.filter(s => !manual.has(s.id));
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let s; (s = queue.shift());) if (await download(s.id)) downloaded++;
}));
const wanted = new Set(students.map(s => `${s.id}.webp`));
let removed = 0;
for (const file of await readdir(IMG_DIR)) {
  if (file.endsWith('.webp') && !wanted.has(file)) { await unlink(new URL(file, IMG_DIR)); removed++; }
}
const missing = [];
for (const id of manual) {
  try { await access(new URL(`${id}.webp`, IMG_DIR)); } catch { missing.push(id); }
}
if (missing.length) console.warn(`아이콘이 없는 수동 등록 학생: ${missing.join(', ')} (scripts/fetch-unreleased-icons.py 실행)`);

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
console.log(`학생 ${released.length}명 (글로벌 ${released.filter(s => s.global).length}) + 미실장 ${students.length - released.length}명, 아이콘 새로 받음 ${downloaded}, 지움 ${removed}`);

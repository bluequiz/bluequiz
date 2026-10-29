# BA 기억력 테스트

블루 아카이브 학생 이름을 얼마나 기억하는지 확인하는 비공식 팬 퀴즈입니다.

**https://bluequiz.github.io/bluequiz/**

## 규칙
- 이름을 입력하고 Enter를 누르면 해당 학생 칸이 열립니다.
- **무제한 모드**: 시간 제한 없이 전원을 맞힐 때까지 진행합니다.
- **타이머 모드**: 5·10·15·20분 안에 최대한 많이 맞힙니다.
- **출제 범위**: 글로벌 서버 출시 학생이 기본이며, 일본 서버 출시 학생, 콜라보 학생, 미실장 학생(외모와 이름이 공개된 학생)을 더할 수 있습니다.
- **빈 칸**: 물음표 또는 실루엣 중에서 고릅니다.
- 이격(수영복 등)은 따로 출제하지 않고 학생당 한 칸입니다. 이격으로만 나온 학생도 제외합니다.
- 시로코\*테러는 "시로코테러"와 "쿠로코" 모두 정답입니다.
- 정답은 이름만 받습니다(예: 호시노). 콜라보 학생도 이름만 입력합니다(예: 미코토).
- 같은 이름이 둘이면 한 번 더 입력합니다. "미사키"는 아리우스 미사키가 먼저 열리고, 콜라보를 켰다면 한 번 더 입력하면 쇼쿠호 미사키가 열립니다.
- 최고 기록은 설정 조합별로 브라우저에만 저장됩니다.

## 구성
빌드 과정이 없는 정적 사이트이며 GitHub Pages로 배포합니다.

| 경로 | 내용 |
|---|---|
| `index.html`, `assets/` | 화면과 동작 |
| `data/students.json` | 학생 목록 (생성 파일) |
| `data/overrides.json` | 콜라보 학생, 별도 칸으로 둘 학생 지정 |
| `data/unreleased.json` | SchaleDB에 없는 학생 (미실장 학생, `"jp": true`는 일본 출시 후 SchaleDB 미반영 학생) |
| `data/order.json` | 학교·학생 정렬 순서 |
| `img/students/` | 학생 아이콘 (생성 파일) |
| `scripts/update-data.mjs` | 학생 목록과 출시 학생 아이콘을 다시 만드는 스크립트 (Node 18 이상, 의존성 없음) |
| `scripts/fetch-unreleased-icons.py` | `data/unreleased.json` 학생의 아이콘을 만드는 스크립트 (Pillow 필요) |

로컬에서 확인하려면 저장소 폴더에서 정적 서버를 띄웁니다.

```
python -m http.server 8787
```

## 권리 및 출처
- 비공식 팬사이트이며 NEXON Games·넥슨·Yostar와 관련이 없습니다. 어떠한 수익도 받지 않습니다.
- 블루 아카이브 및 학생 이름·이미지의 권리는 © NEXON Games Co., Ltd.에 있습니다. 넥슨 [게임IP 사용가이드](https://m.nexon.com/terms/743)를 따릅니다.
- 콜라보 캐릭터의 권리는 각 원작 권리자에게 있습니다. 자세한 표기는 [`img/students/NOTICE.md`](img/students/NOTICE.md)에 있습니다.
- 학생 데이터와 아이콘: [SchaleDB](https://schaledb.com)
- SchaleDB에 없는 학생(미실장 학생 등)의 이미지와 정렬 순서: [나무위키](https://namu.wiki) 「블루 아카이브/미출시 학생」, 「틀:블루 아카이브/등장인물」
- 글꼴: 경기천년제목 © 경기도 (jsDelivr로 불러옴)
- 아이디어: [원신 공익](https://lynette08.github.io/genshin_quiz/)

권리자 요청이 있으면 해당 내용을 바로 내립니다.

## 문의
bluequiz@tensi.org

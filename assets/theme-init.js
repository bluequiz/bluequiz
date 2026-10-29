// 첫 화면을 그리기 전에 테마를 정한다. <head>에서 스타일시트보다 먼저, 일반 스크립트로 불러온다.
// 저장값(localStorage['theme'] = 'light' | 'dark')이 없으면 시스템 설정을 따른다.
(function () {
  var theme = null;
  try {
    theme = localStorage.getItem('theme');
  } catch (e) { /* 저장소가 막혀도 시스템 설정으로 그린다 */ }
  if (theme !== 'light' && theme !== 'dark') {
    theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.classList.toggle('dark', theme === 'dark');
})();

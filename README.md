# 003.workout_mgmt — 건강관리 현황 시스템

2024년 10월부터의 운동 기록과 주간 인바디 기록을 정리·분석하는 개인 프로젝트입니다.
Android 휴대폰에 설치해 오프라인에서도 쓰는 PWA(설치형 웹앱)로 만듭니다.

- 시스템 구조: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

> 이 저장소는 public입니다. 운동 기록 텍스트, 인바디 사진 등 개인 데이터는 커밋하지 마세요.
> 데이터는 휴대폰 안에만 저장됩니다.

## 개발

```bash
npm install
npm run dev       # 개발 서버
npm run build     # 타입 검사 + 빌드 (dist/)
npm run icons     # 앱 아이콘 다시 생성 (Python + Pillow)
```

## 배포 (GitHub Pages)

1. 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정
2. `main` 브랜치에 push하면 자동 배포 → `https://y2j1004-run.github.io/003.workout_mgmt/`

## 휴대폰 설치 (Android)

1. Chrome으로 위 주소 접속
2. 메뉴(⋮) → **앱 설치** (또는 "홈 화면에 추가")
3. 이후 앱 서랍에서 일반 앱처럼 실행, 인터넷 없이도 동작

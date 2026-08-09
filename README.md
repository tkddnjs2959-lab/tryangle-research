# TRY앵글 퍼스널 리서치 — 백엔드

배우 퍼스널 브랜딩용 이미지/퍼스널리티 리서치 수집·집계 시스템.

> **이 문서가 이 저장소의 유일한 정리 문서다.**
> 별도 메모·체인지로그 파일을 만들지 말고, 구조가 바뀌면 본문을 고치고
> 진행 상황은 [작업 기록](#작업-기록)에 이어서 적는다. 다른 PC·다른 AI 세션이
> 이 파일만 읽고 이어받을 수 있어야 한다. 줄 단위 diff 는 `git log` 에 맡긴다.
> (홈페이지 저장소는 `tryangle-homepage/README.md` 가 같은 역할을 한다.)

## Supabase 프로젝트

| | |
|---|---|
| 이름 | `tryangle-personal-research` |
| Project ref | `xvpqjawckzdkzkohhbdg` |
| 리전 | `ap-northeast-2` (서울) |
| 요금 | 무료 티어 (월 $0) |

대시보드 → https://supabase.com/dashboard/project/xvpqjawckzdkzkohhbdg

## 접근 원칙

**브라우저는 DB에 직접 붙지 않는다.**

```
브라우저 → Next.js 서버 라우트 → Supabase (service key, 서버에만 존재)
```

모든 테이블에 RLS를 켜되 정책은 만들지 않았다. 정책이 없으면 `anon` / `authenticated`
는 아무것도 읽지 못하고, `service_role`만 RLS를 우회한다. anon key가 유출돼도
읽히는 것이 없다.

Supabase 린터가 `rls_enabled_no_policy`를 INFO로 표시하는데, **의도된 설계다.**
정책을 추가하지 말 것.

## 테이블

| 테이블 | 용도 |
|---|---|
| `actors` | 배우. 등록 시 `progress_token`(`/s/`) 자동 발급 |
| `keywords` | 키워드 사전. 현재 여자 ver 111개 (이미지 48 · 퍼스널리티 63) |
| `surveys` | 리서치. 배우 1명당 self·image·personality 3건 자동 생성 |
| `responses` | 응답 1건. **이름·연락처를 받지 않는다** |
| `response_keywords` | 응답 × 키워드. 표 키워드는 `keyword_id`, 자유 입력은 `custom_label` |
| `snapshots` | 확정 결과. 렌더 설정을 `config` jsonb에 통째로 보관 |
| `survey_progress` (뷰) | 진행 현황. **키워드를 포함하지 않는다 — 숫자만** |
| `cohort_weeks` | 기수별 1~12주차. 제목과 기수 단위 공개 여부 |
| `actor_week_overrides` | 배우별 주차 예외. 행이 없으면 기수 설정을 따른다 |
| `coaching_students` | 1:1 코칭 학생. `actor_id` 로 퍼스널 브랜딩 배우와 연동된다 |
| `actor_accounts` | 배우 카카오 연결과 배우가 등록한 프로필. `actors.note` 와 분리 |

### 자동 동작

- 배우 등록 → 리서치 3건 + 토큰 4개 자동 발급 (트리거 `trg_actor_create_surveys`)
- 배우 삭제 → 리서치·응답·키워드까지 연쇄 삭제
- 토큰은 `gen_token(8)`. 혼동되는 글자(I·O·0·1)를 뺀 32자 알파벳, 8자리 ≈ 1.1조 가지.
  `gen_random_bytes()` 기반이라 예측 불가

## 주차 공개 규칙 (1~12주차)

캐릭터 포지셔닝 클래스는 12주 과정이고, 대표가 주차를 하나씩 열어준다.
공개 판정은 두 단계이며 규칙 자체는 `src/lib/weeks.ts` 에 모여 있다.

```text
유효 공개 = 배우 예외(actor_week_overrides) 가 있으면 그 값
          = 없으면 기수 공개(cohort_weeks.is_open)
          = 둘 다 없으면 비공개
```

- **기수 단위** — `/admin/cohort/[기수]` 에서 열면 그 기수 배우 전원에게 열린다.
- **배우 예외** — `/admin/[배우]` 에서 특정 배우만 미리 열거나 막는다.
  `actor_week_overrides` 는 **행의 유무로 3-state 를 표현한다.** 행이 없으면
  "기수 설정을 따른다" 는 뜻이고, `is_open=false` 행은 "기수가 열려 있어도 이 배우는
  막는다" 는 뜻이다. 되돌릴 때는 값을 바꾸지 말고 행을 지운다.
- 기수가 없는(`cohort is null`) 배우는 기수 공개가 적용되지 않아 예외로만 열린다.
- 주차 제목은 커리큘럼이 확정되지 않아 어드민에서 편집한다. 비워두면 `N주차` 로
  표시된다. 1주차 기본값만 `퍼스널 리서치 툴` 로 깔려 있다 (`DEFAULT_WEEK_TITLE`).

배우 화면(`/s/[token]`)에는 **공개된 주차의 번호와 이름만** 나간다. 검수 결과물
(말풍선·보고서)은 자동으로 뜨지 않고 담당자가 직접 전달한다 — 프라이버시 규칙과
같은 이유다.

### 인원 기준

| 리서치 | `min_n` (가이드 최소) | `cap_n` (자동 잠금) |
|---|---|---|
| 셀프 체크 | 1 | 1 |
| 이미지 | 8 | 20 |
| 퍼스널리티 | 5 | 15 |

최소 인원을 넘겨 받는 건 환영이므로 `min_n`이 아니라 넉넉한 `cap_n`에서 잠근다.

## 프라이버시 규칙

퍼스널리티 리서치는 가족·연인·친한 지인이 체크한다. 5명 중 누가 무엇을 체크했는지는
사실상 특정 가능하므로 **배우에게 개별 응답을 절대 노출하지 않는다.**

- `/s/` 라우트는 `survey_progress` 뷰만 조회한다. 키워드를 조회하는 코드를 넣지 말 것
- 응답자 이름·연락처를 받지 않는다
- `device_hash`는 중복 제출 탐지 전용 단방향 해시. 원본을 저장하지 않는다
- 결과는 대표가 검수·확정한 뒤 직접 전달한다

## 자주 쓰는 쿼리

배우 등록 (토큰은 자동 발급):

```sql
insert into actors (name, birth_year, cohort) values ('김자두', 1996, '1기');
```

발급된 링크 확인:

```sql
select a.name, a.progress_token as progress, s.type, s.token
from actors a join surveys s on s.actor_id = a.id
where a.name = '김자두' order by s.type;
```

진행 현황:

```sql
select a.name, sp.type, sp.n, sp.min_n, sp.met, sp.is_open
from survey_progress sp join actors a on a.id = sp.actor_id
order by a.name, sp.type;
```

집계 (어드민 검수용):

```sql
select coalesce(k.label, rk.custom_label) as label,
       (k.id is null) as is_custom,
       count(distinct r.id) as raw
from surveys s
join responses r on r.survey_id = s.id
join response_keywords rk on rk.response_id = r.id
left join keywords k on k.id = rk.keyword_id
where s.actor_id = '<actor uuid>' and s.type = 'image'
group by 1,2 order by raw desc;
```

## 실행 방법

Node.js가 필요합니다. 아직 설치돼 있지 않다면:

```bash
winget install OpenJS.NodeJS.LTS
```

설치 중 관리자 권한(UAC) 창이 뜨면 허용해야 하고, 끝나면 **터미널을 새로 열어야**
`node` 명령이 잡힙니다.

그다음:

```bash
cd tryangle-research
npm install
```

`.env.local.example`을 `.env.local`로 복사하고 값을 채웁니다.
`SUPABASE_SERVICE_ROLE_KEY`는 아래에서 복사합니다:

https://supabase.com/dashboard/project/xvpqjawckzdkzkohhbdg/settings/api

```bash
npm run dev
```

배우를 한 명 등록하고 발급된 토큰으로 `http://localhost:3000/r/<토큰>`에 접속하면
응답 페이지가 뜹니다.

## 남은 일

- [x] 스키마 + 키워드 시딩 (여자 ver 111개)
- [x] 응답 제출 RPC (`submit_response`)
- [x] 응답 페이지 `/r/[token]` — 코드 작성 완료, **로컬 실행 검증 전**
- [x] 어드민 — 배우 목록·등록·링크 발급·응답 열람
- [x] 어드민 — 검수·렌더 이식 (1주차 퍼스널 리서치 툴)
- [x] 1~12주차 공개 구조
- [ ] 2~12주차 커리큘럼 확정 및 각 주차 툴 (지금은 공개 여부만 관리)
- [ ] 남자 ver 키워드 시딩 (`gender='male'`) — 표 받는 대로
- [ ] Vercel 배포 (환경변수 4개 등록)
- [ ] 카카오톡 알림 연동 (주차 공개 시 배우에게 자동 안내)

## actors.note 규칙 (중요)

**`actors.note` 는 대표가 쓰는 사람용 메모 칸이다. 기계가 읽는 값을 넣지 말 것.**

한동안 카카오 ID·배우 프로필·1주차 공개 여부를 `[[kakao_user_id:...]]` 같은
마커 문자열로 note 에 넣어뒀는데, 두 가지가 실제로 문제였다.

1. 조회가 `note LIKE '%...%'` 라 인덱스를 못 탄다.
2. 대표가 메모를 편집하다 마커를 지우면 그 배우의 카카오 로그인이 조용히 끊긴다.

지금은 전부 테이블로 나갔다 — 카카오·프로필은 `actor_accounts`,
주차 공개는 `cohort_weeks` / `actor_week_overrides`.
새 상태값이 필요하면 컬럼이나 테이블을 만들지, note 에 얹지 말 것.

## 두 트랙의 관계

배우는 두 트랙을 거친다. 데이터는 별개 테이블이고 `actor_id` 로만 이어져 있다.

```text
캐릭터 포지셔닝 클래스 (actors)   →   1:1 매체연기 코칭 (coaching_students)
  기수 · 리서치 · 1~12주차              회차 · 메모 · 결제
```

- 배우 상세의 **1:1 코칭으로 연동** 버튼이 `coaching_students` 행을 만들고
  `actor_id` 로 잇는다. 이름·생년·연락처는 그 시점에 복사한다.
- 이미 연동된 배우는 다시 만들지 않는다. 보관 처리된 학생이 있으면 되살린다.
- 코칭 탭에서는 연동된 학생에게 기수·리서치 응답 수·공개 주차를 함께 보여주고
  배우 상세로 넘어갈 수 있다.
- **연동 해제는 `actor_id` 만 지운다.** 코칭 메모·기록은 남는다.
  배우를 삭제해도 `on delete set null` 이라 코칭 기록은 살아남는다.

## 작업 기록

새 항목은 이 줄 바로 아래에 추가한다 (최신이 위).

### 2026-08-09 — 배우 계정·프로필을 actors.note 에서 분리

어드민 점검에서 가장 시급한 항목으로 꼽힌 것. 배경과 규칙은 위
[actors.note 규칙](#actorsnote-규칙-중요) 참고.

- 마이그레이션 `20260809000004_actor_accounts.sql` — **원격 DB 에 적용 완료**.
  이관 SQL 이 들어 있지만 적용 시점에 마커가 달린 배우는 0명이라 옮겨진 행은 없다.
- `actor-account.ts` 를 테이블 기반으로 재작성. 카카오 조회가 `LIKE` 에서
  인덱스가 걸린 `kakao_user_id` 정확 일치로 바뀌었다.
- 카카오 계정 중복 연결 방지가 앱 코드에서 **DB unique 제약**으로 내려갔다.
- `admin-data.ts` 의 `kakaoLinked` / `actorProfile` 도 테이블에서 읽는다.
- 검증: `tsc --noEmit`, `npm run build` 통과. 원격 DB 에서 트랜잭션으로
  (1) 메모에 가짜 마커를 넣고 편집해도 카카오 연결이 유지되는지,
  (2) 같은 카카오 ID 를 다른 배우에게 붙이면 unique 위반으로 막히는지
  확인하고 모두 롤백했다.

### 2026-08-09 — 퍼스널 브랜딩 ↔ 1:1 코칭 연동

두 트랙이 완전히 분리돼 있어 같은 배우를 코칭 탭에 손으로 다시 등록해야 했다.
`coaching_students.actor_id` 로 잇고 화면을 연결했다. 규칙은 위
[두 트랙의 관계](#두-트랙의-관계) 참고.

- 마이그레이션 `20260809000003_coaching_actor_link.sql` — **원격 DB 에 적용 완료**.
- 배우 상세에 `1:1 코칭 연동` 블록과 버튼 추가. 연동 후에는 코칭 탭 링크로 바뀐다.
- 코칭 탭의 연동된 학생에게 배우 요약(기수·리서치 진행·공개 주차)과
  배우 상세 링크, 연동 해제 버튼 추가.
- 검증: `tsc --noEmit`, `npm run build` 통과. 컬럼 추가 확인.
  **화면 실물 확인은 못 했다** (아래 2026-08-09 주차 항목과 같은 이유).

### 2026-08-09 — 기수별 1~12주차 공개 구조

대표가 주차를 하나씩 열어주는 구조를 만들었다. 규칙은 위
[주차 공개 규칙](#주차-공개-규칙-112주차) 참고.

- 마이그레이션 `20260809000002_program_weeks.sql` — `cohort_weeks`,
  `actor_week_overrides` 생성. **원격 DB 에 적용 완료** (배우 1명, 기수 `샘플`,
  1주차 행만 시딩된 상태).
- 기존 1주차 공개 여부를 `actors.note` 안에 `[[week1_open]]` 문자열로 들고 있던
  임시 구현을 걷어내고 테이블로 옮겼다. 마이그레이션에 이관 SQL 이 들어 있지만
  적용 시점에 마커가 달린 배우는 0명이라 실제로는 아무것도 옮기지 않았다.
- 신규 화면 `/admin/cohort/[기수]` — 주차 제목 편집 + 기수 전체 공개 토글.
- `/admin` 기수 헤더에 `주차 관리 (n/12 공개)` 링크, 배우 카드에 1~12 진행 표시.
- `/admin/[배우]` 의 1주차 전용 블록을 12주차 목록으로 교체. 주차마다 유효 공개
  상태와 근거(기수 공개 / 이 배우만 공개 / 비공개)를 보여주고, 개별 공개·개별
  차단·기수 설정 따르기를 고를 수 있다.
- `/s/[token]` 은 공개된 주차의 번호와 이름만 보여준다.
- 검수 툴 제목을 `1주차 · 퍼스널 리서치 툴` 로 바꿨다 — 이 툴이 1주차 프로그램이다.
- 검증: `npx tsc --noEmit` 과 `npm run build` 통과, 새 테이블 조회 SQL 확인.
  **어드민 화면 실물 확인은 못 했다** — 이 체크아웃에 `.env.local` 이 없어
  service_role 키 없이는 로컬 실행이 안 된다. 배포 후 화면 확인이 필요하다.

## 관련 파일

- `../퍼스널리서치_말풍선툴.html` — Phase 0 로컬 툴.
  집계·말풍선·보고서 렌더가 순수 함수로 들어있어 어드민으로 그대로 이식한다.
  인터넷이 안 되거나 종이 응답지를 받았을 때의 대비책으로도 남겨둔다.

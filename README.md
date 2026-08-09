# TRY앵글 퍼스널 리서치 — 백엔드

배우 퍼스널 브랜딩용 이미지/퍼스널리티 리서치 수집·집계 시스템.

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

### 자동 동작

- 배우 등록 → 리서치 3건 + 토큰 4개 자동 발급 (트리거 `trg_actor_create_surveys`)
- 배우 삭제 → 리서치·응답·키워드까지 연쇄 삭제
- 토큰은 `gen_token(8)`. 혼동되는 글자(I·O·0·1)를 뺀 32자 알파벳, 8자리 ≈ 1.1조 가지.
  `gen_random_bytes()` 기반이라 예측 불가

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
- [ ] 남자 ver 키워드 시딩 (`gender='male'`) — 표 받는 대로
- [ ] 진행 현황 페이지 `/s/[token]`
- [ ] 어드민 — 배우 목록·등록·링크 발급·응답 열람
- [ ] 어드민 — 검수·렌더 이식 (`퍼스널리서치_말풍선툴.html`의 순수 함수 재사용)
- [ ] Vercel 배포 (환경변수 4개 등록)

## 관련 파일

- `../퍼스널리서치_말풍선툴.html` — Phase 0 로컬 툴.
  집계·말풍선·보고서 렌더가 순수 함수로 들어있어 어드민으로 그대로 이식한다.
  인터넷이 안 되거나 종이 응답지를 받았을 때의 대비책으로도 남겨둔다.

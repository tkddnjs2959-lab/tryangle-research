-- =====================================================================
--  키워드 시딩 — 여자 ver
--  출처: 퍼스널리서치(여자ver).pdf  ⓒ Artist Branding Company TRY앵글
--  sort_order 는 원본 표의 좌→우, 위→아래 순서를 그대로 따른다.
--  (남자 ver 은 표를 받는 대로 gender='male' 로 추가)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 이미지 리서치 키워드 — 6열 × 8행 = 48개
-- ---------------------------------------------------------------------
insert into keywords (category, gender, label, sort_order) values
  ('image','female','수수한',      1),
  ('image','female','청순한',      2),
  ('image','female','부드러운',    3),
  ('image','female','서글서글한',  4),
  ('image','female','앳된',        5),
  ('image','female','해사한',      6),

  ('image','female','가녀린',      7),
  ('image','female','단아한',      8),
  ('image','female','우아한',      9),
  ('image','female','기품 있는',  10),
  ('image','female','성숙한',     11),
  ('image','female','여성스러운', 12),

  ('image','female','청초한',     13),
  ('image','female','선한',       14),
  ('image','female','귀여운',     15),
  ('image','female','러블리한',   16),
  ('image','female','몽환적인',   17),
  ('image','female','신비로운',   18),

  ('image','female','친숙한',     19),
  ('image','female','푸근한',     20),
  ('image','female','평범한',     21),
  ('image','female','개성있는',   22),
  ('image','female','매력적인',   23),
  ('image','female','매혹적인',   24),

  ('image','female','수려한',     25),
  ('image','female','고혹적인',   26),
  ('image','female','도회적인',   27),
  ('image','female','지적인',     28),
  ('image','female','세련된',     29),
  ('image','female','섹시한',     30),

  ('image','female','차가운',     31),
  ('image','female','도도한',     32),
  ('image','female','새침한',     33),
  ('image','female','동양적인',   34),
  ('image','female','이국적인',   35),
  ('image','female','중성적인',   36),

  ('image','female','날카로운',   37),
  ('image','female','매서운',     38),
  ('image','female','강인한',     39),
  ('image','female','강렬한',     40),
  ('image','female','서늘한',     41),
  ('image','female','악한',       42),

  ('image','female','처연한',     43),
  ('image','female','그늘진',     44),
  ('image','female','목가적인',   45),
  ('image','female','빈티지한',   46),
  ('image','female','헬쑥한',     47),
  ('image','female','파리한',     48)
on conflict (category, gender, label) do nothing;

-- ---------------------------------------------------------------------
-- 2. 퍼스널리티 리서치 키워드 — 7열 × 9행 = 63개
-- ---------------------------------------------------------------------
insert into keywords (category, gender, label, sort_order) values
  ('personality','female','수더분한',     1),
  ('personality','female','개구진',       2),
  ('personality','female','까칠한',       3),
  ('personality','female','씩씩한',       4),
  ('personality','female','차분한',       5),
  ('personality','female','내성적인',     6),
  ('personality','female','유머러스한',   7),

  ('personality','female','정의로운',     8),
  ('personality','female','다정한',       9),
  ('personality','female','소심한',      10),
  ('personality','female','독특한',      11),
  ('personality','female','털털한',      12),
  ('personality','female','당돌한',      13),
  ('personality','female','외향적인',    14),

  ('personality','female','상냥한',      15),
  ('personality','female','유쾌한',      16),
  ('personality','female','이성적인',    17),
  ('personality','female','시니컬한',    18),
  ('personality','female','엉뚱한',      19),
  ('personality','female','사려 깊은',   20),
  ('personality','female','냉정한',      21),

  ('personality','female','긍정적인',    22),
  ('personality','female','여린',        23),
  ('personality','female','신중한',      24),
  ('personality','female','무뚝뚝한',    25),
  ('personality','female','선한',        26),
  ('personality','female','강인한',      27),
  ('personality','female','반항적인',    28),

  ('personality','female','대담한',      29),
  ('personality','female','감정적인',    30),
  ('personality','female','자유분방한',  31),
  ('personality','female','백치미 있는', 32),
  ('personality','female','솔직한',      33),
  ('personality','female','얌전한',      34),
  ('personality','female','쾌활한',      35),

  ('personality','female','시크한',      36),
  ('personality','female','예의 바른',   37),
  ('personality','female','활발한',      38),
  ('personality','female','허당기 있는', 39),
  ('personality','female','무던한',      40),
  ('personality','female','야무진',      41),
  ('personality','female','호탕한',      42),

  ('personality','female','천진난만한',  43),
  ('personality','female','온순한',      44),
  ('personality','female','의리 있는',   45),
  ('personality','female','애교 있는',   46),
  ('personality','female','얄미운',      47),
  ('personality','female','예민한',      48),
  ('personality','female','똘끼 있는',   49),

  ('personality','female','강단 있는',   50),
  ('personality','female','직설적인',    51),
  ('personality','female','단호한',      52),
  ('personality','female','화끈한',      53),
  ('personality','female','성깔 있는',   54),
  ('personality','female','깡다구 좋은', 55),
  ('personality','female','뻔뻔한',      56),

  ('personality','female','도도한',      57),
  ('personality','female','쿨한',        58),
  ('personality','female','주책 맞은',   59),
  ('personality','female','푼수 같은',   60),
  ('personality','female','재치있는',    61),
  ('personality','female','까불까불한',  62),
  ('personality','female','까탈스러운',  63)
on conflict (category, gender, label) do nothing;

-- =============================================================================
-- CollectOps · 사용자 UI 설정 영속화 스키마 (Microsoft SQL Server / T-SQL)
-- =============================================================================
-- 현재 프론트엔드는 아래 설정을 브라우저 localStorage 에 저장한다.
-- 백엔드(DB) 연동 시 이 DDL 로 테이블을 만들고, 사용자별로 저장/조회한다.
--
--   localStorage 키                  →  테이블
--   --------------------------------    -------------------------------------
--   board-{boardId}-widgets-v2       →  user_board_widget (행의 존재 = 활성)
--   board-{boardId}-layout-v6        →  user_board_widget (pos_x/y, w, h ...)
--   nav-order-v1 (groups)            →  user_nav_group_order
--   nav-order-v1 (items)             →  user_nav_item_order
--
-- 설계 메모
--   * 모든 설정은 "사용자별"이다 (각 운영자가 자기 대시보드를 배치).
--   * user_id 는 애플리케이션 계정 식별자. 별도 사용자 테이블이 있다면 FK 로
--     교체할 것 (아래 FK 는 주석 처리해 두었다).
--   * board_id / widget_id / group_id / item_href 는 프론트의 상수 문자열을
--     그대로 저장한다 (예: board_id='dashboard', widget_id='graph',
--     group_id='monitoring', item_href='/monitor/charts').
--   * 한글 라벨이 들어갈 여지가 있는 문자열은 NVARCHAR 로 둔다.
--   * 시간은 UTC(SYSUTCDATETIME) 기준 DATETIME2 로 저장한다.
-- =============================================================================

SET XACT_ABORT ON;
GO

-- ---------------------------------------------------------------------------
-- 1) 보드별 위젯 배치 (활성 위젯 + react-grid-layout 좌표를 한 행으로)
--    행이 존재하면 = 그 보드에서 활성. 삭제하면 = 위젯 제거.
-- ---------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.user_board_widget', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.user_board_widget (
    id          BIGINT IDENTITY(1,1) NOT NULL
                  CONSTRAINT pk_user_board_widget PRIMARY KEY,
    user_id     VARCHAR(64)  NOT NULL,
    board_id    VARCHAR(32)  NOT NULL,   -- dashboard / charts / history / alerts / schedule / collectors
    widget_id   VARCHAR(48)  NOT NULL,   -- summary / graph / table / cli / trend ...
    -- react-grid-layout Layout 항목 (12열 그리드 기준)
    pos_x       SMALLINT     NOT NULL CONSTRAINT df_ubw_posx DEFAULT (0),
    pos_y       SMALLINT     NOT NULL CONSTRAINT df_ubw_posy DEFAULT (0),
    w           SMALLINT     NOT NULL CONSTRAINT df_ubw_w    DEFAULT (4),
    h           SMALLINT     NOT NULL CONSTRAINT df_ubw_h    DEFAULT (6),
    min_w       SMALLINT     NULL,
    min_h       SMALLINT     NULL,
    sort_order  SMALLINT     NOT NULL CONSTRAINT df_ubw_sort DEFAULT (0),  -- 활성 배열 내 안정적 정렬용
    created_at  DATETIME2(3) NOT NULL CONSTRAINT df_ubw_created DEFAULT (SYSUTCDATETIME()),
    updated_at  DATETIME2(3) NOT NULL CONSTRAINT df_ubw_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT uq_user_board_widget UNIQUE (user_id, board_id, widget_id)
    -- , CONSTRAINT fk_ubw_user FOREIGN KEY (user_id) REFERENCES dbo.app_user(id) ON DELETE CASCADE
  );

  CREATE INDEX idx_ubw_user_board ON dbo.user_board_widget (user_id, board_id);
END;
GO

-- ---------------------------------------------------------------------------
-- 2) 메뉴(사이드바) 그룹 순서
-- ---------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.user_nav_group_order', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.user_nav_group_order (
    id          BIGINT IDENTITY(1,1) NOT NULL
                  CONSTRAINT pk_user_nav_group_order PRIMARY KEY,
    user_id     VARCHAR(64)  NOT NULL,
    group_id    VARCHAR(32)  NOT NULL,   -- monitoring / ops / manage / help
    sort_order  SMALLINT     NOT NULL,
    updated_at  DATETIME2(3) NOT NULL CONSTRAINT df_ung_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT uq_user_nav_group UNIQUE (user_id, group_id)
    -- , CONSTRAINT fk_ung_user FOREIGN KEY (user_id) REFERENCES dbo.app_user(id) ON DELETE CASCADE
  );

  CREATE INDEX idx_ung_user ON dbo.user_nav_group_order (user_id);
END;
GO

-- ---------------------------------------------------------------------------
-- 3) 메뉴(사이드바) 그룹 내 항목 순서
-- ---------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.user_nav_item_order', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.user_nav_item_order (
    id          BIGINT IDENTITY(1,1) NOT NULL
                  CONSTRAINT pk_user_nav_item_order PRIMARY KEY,
    user_id     VARCHAR(64)  NOT NULL,
    group_id    VARCHAR(32)  NOT NULL,
    item_href   VARCHAR(128) NOT NULL,   -- /monitor, /monitor/charts ...
    sort_order  SMALLINT     NOT NULL,
    updated_at  DATETIME2(3) NOT NULL CONSTRAINT df_uni_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT uq_user_nav_item UNIQUE (user_id, group_id, item_href)
    -- , CONSTRAINT fk_uni_user FOREIGN KEY (user_id) REFERENCES dbo.app_user(id) ON DELETE CASCADE
  );

  CREATE INDEX idx_uni_user_group ON dbo.user_nav_item_order (user_id, group_id);
END;
GO

-- ---------------------------------------------------------------------------
-- updated_at 자동 갱신 트리거 (T-SQL: CREATE TRIGGER 는 배치 첫 문장이어야 하므로 GO 로 분리)
-- ---------------------------------------------------------------------------
CREATE OR ALTER TRIGGER dbo.trg_ubw_updated_at
  ON dbo.user_board_widget
  AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE t
     SET t.updated_at = SYSUTCDATETIME()
  FROM dbo.user_board_widget AS t
  INNER JOIN inserted AS i ON t.id = i.id;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_ung_updated_at
  ON dbo.user_nav_group_order
  AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE t
     SET t.updated_at = SYSUTCDATETIME()
  FROM dbo.user_nav_group_order AS t
  INNER JOIN inserted AS i ON t.id = i.id;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_uni_updated_at
  ON dbo.user_nav_item_order
  AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE t
     SET t.updated_at = SYSUTCDATETIME()
  FROM dbo.user_nav_item_order AS t
  INNER JOIN inserted AS i ON t.id = i.id;
END;
GO

-- ---------------------------------------------------------------------------
-- 테이블/컬럼 설명 (확장 속성)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.user_board_widget') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sys.sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'사용자별 보드 위젯 배치(활성 여부 = 행 존재) + 그리드 좌표',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'user_board_widget';
GO

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.user_nav_group_order') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sys.sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'사용자별 사이드바 그룹 노출 순서',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'user_nav_group_order';
GO

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.user_nav_item_order') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sys.sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'사용자별 사이드바 그룹 내 메뉴 항목 순서',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'user_nav_item_order';
GO

-- =============================================================================
-- 참고: UPSERT 예시 (백엔드 저장 로직 가이드)
-- =============================================================================
-- 위젯 배치 저장(추가/이동/리사이즈) — MERGE 로 단건 UPSERT:
--   MERGE dbo.user_board_widget AS tgt
--   USING (SELECT @user_id AS user_id, @board_id AS board_id, @widget_id AS widget_id) AS src
--      ON  tgt.user_id = src.user_id
--      AND tgt.board_id = src.board_id
--      AND tgt.widget_id = src.widget_id
--   WHEN MATCHED THEN
--     UPDATE SET pos_x = @pos_x, pos_y = @pos_y, w = @w, h = @h,
--                min_w = @min_w, min_h = @min_h, sort_order = @sort_order
--   WHEN NOT MATCHED THEN
--     INSERT (user_id, board_id, widget_id, pos_x, pos_y, w, h, min_w, min_h, sort_order)
--     VALUES (@user_id, @board_id, @widget_id, @pos_x, @pos_y, @w, @h, @min_w, @min_h, @sort_order);
--
-- 위젯 제거:
--   DELETE FROM dbo.user_board_widget
--    WHERE user_id = @user_id AND board_id = @board_id AND widget_id = @widget_id;
--
-- 보드 기본값 복원(localStorage.removeItem 대응):
--   DELETE FROM dbo.user_board_widget WHERE user_id = @user_id AND board_id = @board_id;
--
-- 메뉴 순서 저장: 트랜잭션 안에서 해당 user 의 기존 순서 DELETE 후 재삽입하거나,
-- 위와 같은 MERGE 패턴으로 처리.
-- =============================================================================

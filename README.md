# 社团信息化管理系统

一个**纯本地运行**的社团管理工具，把两套系统合成了一件趁手的工具：

- **主功能 · 社团运营**：来自 [BREEY05/FreeShift](https://github.com/BREEY05/FreeShift)，维护成员、录课表、找共同空闲、排活动、看统计。
- **附功能 · 刷题训练**：来自 [lovefrt/bluebridge-judge](https://github.com/lovefrt/bluebridge-judge)，本地题库 + 本地编译运行 + 逐测试点评测，做完直接看分数。

**使用前提只有一条：你就是这个社团的负责人。** 没有注册、登录、邀请码、加入申请，也没有"搜索别人的社团"——
打开就是自己的社团，自己是唯一的操作者，所有数据留在本机。

**不联网、不登录、不要授权**：一个进程、一个 SQLite 文件、一个题目目录，双击就能用。

---

## 快速开始

### 方式一：免安装绿色版（推荐，给不装开发环境的电脑用）

到 [Releases](https://github.com/BREEY05/club-info-system/releases/latest) 下载
`club-info-system-v1.2.0-win-x64.zip`（约 32 MB），解压到任意位置（中文路径也行），
**双击 `start.cmd`** 即可。

- 自带 Node 运行时，**不需要**安装 Node、pnpm 或任何依赖，**不需要联网**；
- 浏览器会自动打开 <http://127.0.0.1:3000/>，端口被占用时自动顺延；
- 数据写在绿色版目录的 `data\club.db`，题库在 `problems\`，整个文件夹拷走即搬家。

### 方式二：源码运行（开发用）

```bash
pnpm install
pnpm build
pnpm dev            # 或 node apps/server/src/index.ts
```

Windows 上双击 `start.cmd` 也会走这条路（首次自动装依赖 + 构建）。

默认地址：<http://127.0.0.1:3000>（总览） · <http://127.0.0.1:3000/practice>（题库）

### 环境要求

| 项目 | 要求 |
| --- | --- |
| Node.js | 仅源码运行需要，**22.18+**（用到内置 `node:sqlite` 与类型剥离） |
| pnpm | 仅源码运行需要，`npm i -g pnpm` |
| 判题语言 | 可选：Python（`python`/`python3`/`py`）、C/C++（`gcc`/`g++`，MinGW/MSYS2）、Java（`javac`+`java`） |

> 没装的编译环境不会报错：题库页会显示每种语言的可用状态，未安装的语言自动禁用。

### 自己打包绿色版

```bash
pnpm --filter @cims/web build
node build/portable.mjs        # 产物：dist/portable/ 与 dist/club-info-system-v*-win-x64.zip
node build/portable.mjs --no-zip
```

---

## 功能

### 社团运营（主功能）

一个负责人真正会反复用的六件事，各自一个页面：

| 页面 | 作用 |
| --- | --- |
| 总览 | 今天该干什么：4 个关键数字 + 接下来的活动 + 待办提醒（谁还没录课表、哪周还没排活动） |
| 课表 | 两种视图：**合并视图**看每个时段"几人空闲/共几人"，点开看具体是谁；**成员课表**逐个录入、点格子增删 |
| 成员 | 社团名册：姓名、职务（负责人/部长/干事/社员）、年级专业、电话，支持搜索与排序 |
| 空闲时间 | 勾选参加人 → 列出本周他们全都空着的时段，点一下「排活动」直接带出时间 |
| 活动 | 例会/培训/比赛统一登记：时间、地点、参与人、状态（待进行/已完成/已取消） |
| 统计 | 成员课表填写情况、哪天最容易凑齐人、活动开展情况、刷题进度 |
| 社团 | 社团档案（名称、负责人、联系方式、简介）+ 数据存放说明 |
| 时间段 | 每周的时间块（第1-2节 08:00–09:40…），课表、空闲、活动时间轴都以它为准 |
| 设置 | 学期与周次、CSV 导入导出、运行信息、重置数据 |

学期、周次、单双周、跨周课程都按真实日期自动计算（Asia/Shanghai）。

### 刷题训练（附功能）

- **题库**：全部题目、通过情况、最高分、测试点数量；可按难度、状态、标签、关键词筛选。
- **做题**：左侧题面（Markdown）、右侧代码编辑器（带行号、Tab 缩进、自动存草稿），提交后轮询评测结果。
- **评测结果**：总分、每个测试点的判定与用时、编译错误信息、WA 的具体差异（例如「第 3 个数据不一致：期望 0，实际 1」）。
- **做题记录**：两种视角——「按题目」汇总每道题练了几次、最好成绩；「时间线」翻单次评测细节并回看当时提交的代码。
- **新建题目**：页面内直接录题面 + 测试点，落盘为 `problems/<编号>/`。

支持语言：C++17、C11、Java、Python（`judgeCode` 中按语言补偿解释器启动开销）。

---

## 数据在哪

| 内容 | 位置 |
| --- | --- |
| 成员、课表、活动、学期、提交记录 | `data/club.db`（SQLite，WAL 模式） |
| 题库 | `problems/<题目编号>/`：`problem.json` + `statement.md` + `tests/*.in` `*.out` |
| 判题临时目录 | `data/judge-tmp/`（每次评测后自动清理） |

备份 = 复制 `data/club.db` 和 `problems/` 两个位置。设置页也提供了 CSV 导入导出。

---

## 目录结构

```
club-info-system/
├─ apps/
│  ├─ server/            Fastify + node:sqlite 后端
│  │  └─ src/
│  │     ├─ routes/      org / users / semester / slots / templates / schedules /
│  │     │               board / activities / stats / data / judge
│  │     ├─ services/    社团档案、成员、排课（冲突检测/周次展开）、活动、统计
│  │     ├─ judge/       判题：problems(题库读写) / engine(编译运行排队) /
│  │     │               runner(子进程+工具链探测) / compare(输出比对)
│  │     └─ db/          schema.sql、迁移、默认学期与时间段
│  └─ web/               React 18 + Vite + Tailwind 前端
│     └─ src/
│        ├─ pages/       Dashboard / Timetable / Members / FreeTime / Activities /
│        │               Stats / Club / Templates / Settings / Practice …
│        ├─ components/  布局、课表网格、成员与活动表单、题库组件
│        └─ api/         类型化 fetch 客户端
├─ packages/shared/      前后端共享类型与周次计算
├─ problems/             题库（8 道示例题，来自 bluebridge-judge）
├─ data/                 运行时数据库（不入库）
├─ start.cmd / start.sh  一键启动
```

---

## 开发模式

```bash
pnpm install
pnpm dev            # 前端 5173（代理 /api 到 3000）+ 后端 3000 热重载
pnpm typecheck      # 前后端类型检查
pnpm test           # 后端 105 个测试（社团/课表契约 + 活动 + 统计 + 判题引擎）
```

生产/日常使用：

```bash
pnpm build          # 构建 shared + web
node apps/server/src/index.ts   # 单进程同时托管 API 与前端静态文件
```

环境变量：`PORT`（默认 3000）、`HOST`（默认 127.0.0.1）、`PROBLEMS_DIR`（题库目录）、`DATABASE_PATH`、`CIMS_OPEN`（是否自动开浏览器）。

---

## 与两个原仓库的差异

1. **按"单人"重新设计**：原 FreeShift 是多人协作工具（搜组织、邀请码、加入申请、审批、公平性分配）。
   现在使用者只有一个社团负责人，这些环节整块删掉——社团表只剩档案字段，成员只由负责人录入，
   新增了活动安排与运营统计，页面从"协作表"变成"管理台"。
2. **鉴权全部移除**：删掉了邮箱验证码登录、访问授权白名单、`auth_*` 表与邮件发送依赖；所有请求都以本机负责人身份操作自己的社团。
3. **两套技术栈合一**：原判题系统是 Python/Flask + Jinja 模板，已用 TypeScript 重写为 Fastify 路由 + React 页面，评测核心（编译、限时、输出比对、判定优先级）按原逻辑移植。
4. **题目数据格式保持兼容**：仍然是 `problem.json` + `statement.md` + `tests/`，原仓库的题库可直接拷进 `problems/`。
5. **去掉考试/账号体系**：原系统的试卷、考试场次、学生账号、排行榜依赖登录态，合并版只保留「题库 + 做题 + 做题记录」。
6. **补全了示例题题面**：`problems/D2-1` ~ `D2-5` 的输入输出格式已根据测试数据补写，并附样例。

## 已知限制

- 内存限制只在 Java 上通过 `-Xmx` 生效；C/C++/Python 在本地不做强制（Windows 无可靠的单进程内存约束手段），超时与输出上限是强制执行的。
- 判题串行执行（避免并发抢占 CPU 影响计时），一次只跑一份提交。
- 没有多用户/远程访问设计：默认只监听 `127.0.0.1`，别把它暴露到公网。

## 致谢

- 排课与协作表逻辑：[FreeShift](https://github.com/BREEY05/FreeShift)
- 题库与评测思路：[lovefrt/bluebridge-judge](https://github.com/lovefrt/bluebridge-judge)

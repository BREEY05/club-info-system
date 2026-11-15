# 社团信息化管理系统

一个**纯本地运行**的社团管理小工具，把两套系统合到了一起：

- **主功能 · 排课表**：来自 [BREEY05/FreeShift](https://github.com/BREEY05/FreeShift)，按学期周次维护社团成员的时间安排、汇总组织表、找共同空闲时间、统计公平性。
- **附功能 · 刷题判题**：来自 [lovefrt/bluebridge-judge](https://github.com/lovefrt/bluebridge-judge)，本地题库 + 本地编译运行 + 逐测试点评测，做完直接看分数。

**不联网、不登录、不要授权**：一个进程、一个 SQLite 文件、一个题目目录，双击就能用。

---

## 快速开始

### 方式一：免安装绿色版（推荐，给不装开发环境的电脑用）

到 [Releases](https://github.com/BREEY05/club-info-system/releases/latest) 下载
`club-info-system-v1.1.0-win-x64.zip`（约 32 MB），解压到任意位置（中文路径也行），
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

默认地址：<http://127.0.0.1:3000>（排课表） · <http://127.0.0.1:3000/practice>（题库）

### 环境要求

| 项目 | 要求 |
| --- | --- |
| Node.js | 仅源码运行需要，**22.18+**（用到内置 `node:sqlite` 与类型剥离） |
| pnpm | 仅源码运行需要，`npm i -g pnpm` |
| 判题语言 | 可选：Python（`python`/`python3`/`py`）、C/C++（`gcc`/`g++`，MinGW/MSYS2）、Java（`javac`+`java`） |

> 没装的编译环境不会报错：题库页会显示每种语言的可用状态，未安装的语言在下拉框里自动禁用。

### 自己打包绿色版

```bash
pnpm --filter @cims/web build
node build/portable.mjs        # 产物：dist/portable/ 与 dist/club-info-system-v*-win-x64.zip
node build/portable.mjs --no-zip
```

---

## 功能

### 排课表（主功能）

| 页面 | 作用 |
| --- | --- |
| 排课表 | 按周查看「组织表 / 个人表」，点格子看谁有空、谁被占用 |
| 成员 | 维护社团成员、查看每人的个人表 |
| 时间段 | 时间段模板（两节连排 / 单节 / 半天等），可自定义节次与时间 |
| 推荐 | 多人共同空闲时间、加权评分、备选时段 |
| 统计 | 每人安排数量与公平性分布 |
| 社团 | 社团信息、成员列表 |
| 设置 | 学期、周次、CSV 导入导出、重置数据 |

学期、周次、单双周、跨周课程都按真实日期自动计算（Asia/Shanghai）。

### 刷题（附功能）

- **题库**：列出全部题目、通过情况、最高分、测试点数量；支持搜索题号/标题/标签。
- **做题**：左侧题面（Markdown）、右侧代码编辑器（带行号、Tab 缩进、自动存草稿），提交后轮询评测结果。
- **评测结果**：总分、每个测试点的判定与用时、编译错误信息、WA 的具体差异（例如「第 3 个数据不一致：期望 0，实际 1」）。
- **提交记录**：所有历史提交，点开可回看结果与当时提交的代码。
- **新建题目**：页面内直接录题面 + 测试点，落盘为 `problems/<编号>/`。

支持语言：C++17、C11、Java、Python（`judgeCode` 中按语言补偿解释器启动开销）。

---

## 数据在哪

| 内容 | 位置 |
| --- | --- |
| 排课表、成员、提交记录 | `data/club.db`（SQLite，WAL 模式） |
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
│  │     ├─ routes/      semester / templates / slots / users / schedules /
│  │     │               board / recommend / stats / data / org / judge / session
│  │     ├─ services/    排课领域逻辑（冲突检测、周次展开、推荐算法、公平性）
│  │     ├─ judge/       判题：problems(题库读写) / engine(编译运行排队) /
│  │     │               runner(子进程+工具链探测) / compare(输出比对)
│  │     └─ db/          schema.sql、迁移、默认学期与模板
│  └─ web/               React 18 + Vite + Tailwind 前端
│     └─ src/
│        ├─ pages/       DashboardPage(排课表) / PracticePage / ProblemPage …
│        ├─ components/  布局、排课网格、题库组件（CodeEditor/结果表格）
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
pnpm test           # 后端 97 个测试（排课契约 + 判题引擎）
```

生产/日常使用：

```bash
pnpm build          # 构建 shared + web
node apps/server/src/index.ts   # 单进程同时托管 API 与前端静态文件
```

环境变量：`PORT`（默认 3000）、`HOST`（默认 0.0.0.0）、`PROBLEMS_DIR`（题库目录）、`DATABASE_PATH`。

---

## 与两个原仓库的差异

1. **鉴权全部移除**：删掉了邮箱验证码登录、访问授权白名单、`auth_*` 表与邮件发送依赖；所有请求都以本机管理员身份操作默认社团。
2. **两套技术栈合一**：原判题系统是 Python/Flask + Jinja 模板，已用 TypeScript 重写为 Fastify 路由 + React 页面，评测核心（编译、限时、输出比对、判定优先级）按原逻辑移植。
3. **题目数据格式保持兼容**：仍然是 `problem.json` + `statement.md` + `tests/`，原仓库的题库可直接拷进 `problems/`。
4. **去掉考试/账号体系**：原系统的试卷、考试场次、学生账号、排行榜依赖登录态，合并版只保留「题库 + 做题 + 提交记录」。
5. **补全了示例题题面**：`problems/D2-1` ~ `D2-5` 的输入输出格式已根据测试数据补写，并附样例。

## 已知限制

- 内存限制只在 Java 上通过 `-Xmx` 生效；C/C++/Python 在本地不做强制（Windows 无可靠的单进程内存约束手段），超时与输出上限是强制执行的。
- 判题串行执行（避免并发抢占 CPU 影响计时），一次只跑一份提交。
- 没有多用户/远程访问设计：默认只监听本机，别把它暴露到公网。

## 致谢

- 排课与协作表逻辑：[FreeShift](https://github.com/BREEY05/FreeShift)
- 题库与评测思路：[bluebridge-judge](https://github.com/lovefrt/bluebridge-judge)

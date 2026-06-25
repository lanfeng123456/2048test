# 2048 游戏 (Next.js + PostgreSQL + Better Auth)

一个全栈 2048 网页游戏：支持 **Google OAuth** 和 **邮箱/密码** 登录注册，分数保存到 PostgreSQL，并展示个人历史最高分。

## 技术栈

- **Next.js 15**（App Router）+ TypeScript + React 19
- **PostgreSQL** + **Prisma** ORM
- **Better Auth** —— Google social provider + 邮箱密码（内置安全的密码哈希与会话管理）
- **Vitest** —— 游戏引擎单元测试

## 目录结构

```
src/
├─ app/
│  ├─ page.tsx                  # 受保护首页（未登录跳 /login），渲染游戏
│  ├─ login/ register/          # 登录 / 注册页
│  └─ api/
│     ├─ auth/[...all]/route.ts # Better Auth 所有认证路由
│     └─ scores/route.ts        # 保存 / 读取最高分（需登录）
├─ components/
│  ├─ AuthForm.tsx              # 登录/注册共用表单（邮箱 + Google）
│  └─ Game.tsx                  # 2048 棋盘（键盘 / WASD / 滑动）
├─ lib/
│  ├─ prisma.ts  auth.ts  auth-client.ts
│  └─ game/engine.ts            # 纯函数游戏引擎（+ engine.test.ts）
└─ middleware.ts                # 基于会话 cookie 的路由保护
prisma/schema.prisma            # User/Session/Account/Verification + Score
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写：

```bash
# 云端 PostgreSQL 连接串（Neon / Supabase / Vercel Postgres 等）
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# 用 openssl rand -base64 32 生成
BETTER_AUTH_SECRET="..."
BETTER_AUTH_URL="http://localhost:3000"

# Google OAuth 凭据（见下）
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

### 3. 配置 Google OAuth

1. 打开 [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**。
2. 创建 **OAuth 2.0 Client ID**，类型选 **Web application**。
3. 在 **Authorized redirect URIs** 中加入：
   - `http://localhost:3000/api/auth/callback/google`（开发）
   - 生产环境再加 `https://你的域名/api/auth/callback/google`
4. 把生成的 Client ID / Secret 填入 `.env`。

### 4. 初始化数据库

```bash
npx prisma db push     # 在数据库中创建表
npx prisma generate    # 生成 Prisma Client（postinstall 已自动执行）
```

### 5. 运行

```bash
npm run dev
```

打开 http://localhost:3000 —— 未登录会跳转到 `/login`，可用邮箱注册或 Google 登录。

## 玩法与订阅

- **方向键** 或 **WASD** 移动方块；移动端可 **滑动**。相同数字合并，目标合成 **2048**。
- 游戏结束时分数自动保存，最高分在刷新后保留。
- **免费用户累计可玩 3 局**，用完后出现订阅弹窗；**订阅用户无限畅玩**。

## 集成 Creem 支付（包月 / 包年）

1. 注册 [Creem](https://creem.io)，在后台创建两个**订阅产品**：包月、包年，记下各自的 `product_id`。
2. 在 **Settings > API Keys** 取得 API Key（开发用 test 模式 key）。
3. 在 **Developers > Webhooks** 新建 Webhook：
   - 端点 URL：`<你的公网地址>/api/webhook/creem`（本地开发用 ngrok 等隧道暴露 `localhost:3000`）
   - 复制 **Webhook Secret**。
4. 填写 `.env`：
   ```bash
   CREEM_TEST_MODE="true"            # 上线改为 "false"
   CREEM_API_KEY="creem_test_xxx"
   CREEM_WEBHOOK_SECRET="whsec_xxx"
   CREEM_PRODUCT_ID_MONTHLY="prod_xxx"
   CREEM_PRODUCT_ID_YEARLY="prod_xxx"
   ```
5. 流程：点击订阅 → `POST /api/checkout` 创建 Creem 结账会话并跳转 → 支付完成回跳 `/?checkout=success`；Creem 通过 Webhook 通知 `subscription.paid / canceled / expired`，服务端校验 `creem-signature`（HMAC-SHA256）后更新订阅状态。

> 未配置 Creem 凭据时，订阅按钮会返回友好提示（503），不影响免费游戏与登录。

## 代理网络说明（重要）

若服务器所在网络需要代理才能访问 Google / Creem（如国内环境），本项目已在 [src/instrumentation.ts](src/instrumentation.ts) 中读取 `HTTPS_PROXY` / `HTTP_PROXY` 环境变量，把 Node 的 `fetch`（用于 Google OAuth 令牌交换、Creem API）路由到该代理。设置示例：

```bash
# PowerShell
$env:HTTPS_PROXY="http://127.0.0.1:7890"
```

无代理变量时该逻辑自动跳过，对生产环境无影响。

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建（含类型检查） |
| `npm run test` | 运行游戏引擎单元测试（Vitest） |
| `npm run db:push` | 同步 schema 到数据库 |
| `npm run db:studio` | 打开 Prisma Studio 查看数据 |

## 安全说明

- 密码哈希与会话签名均由 Better Auth 处理，源码中不保存明文密码。
- 所有密钥（`BETTER_AUTH_SECRET`、Google 凭据、`DATABASE_URL`）通过环境变量注入，`.env` 已被 git 忽略。
- `/api/scores` 校验登录会话，并对分数做类型与范围校验。

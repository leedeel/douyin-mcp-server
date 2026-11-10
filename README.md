# 抖音视频上传 Skills

让你的 AI 助手能够自动上传视频到抖音创作者平台。支持 [OpenClaw](https://openclaw.ai)、[Claude Code](https://claude.ai/code) 等 AI 工具。

---

## 目录

- [快速开始](#-快速开始)
- [详细使用流程](#-详细使用流程)
- [Skills 说明](#-skills-说明)
- [命令行使用](#-命令行使用)
- [常见问题](#-常见问题)

---

## 🚀 快速开始

### 前置要求

- **Node.js 18+**：[下载地址](https://nodejs.org/)
- **Chrome 浏览器**：用于自动化操作
- **抖音创作者账号**：[注册地址](https://creator.douyin.com/)

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/leedeel/douyin-mcp-server.git
cd douyin-mcp-server

# 2. 安装依赖并构建
npm install && cd mcp-server && npm install && npm run build && cd ..

# 3. 复制 Skill 到 OpenClaw（或 Claude Code）
# OpenClaw:
mkdir -p ~/.openclaw/workspace/skills/douyin && cp skills/SKILL.md ~/.openclaw/workspace/skills/douyin/

# Claude Code:
mkdir -p ~/.claude/skills/douyin && cp skills/SKILL.md ~/.claude/skills/douyin/
```

### 验证安装

```bash
# 测试脚本是否可用
npx tsx scripts/manage.ts info
```

输出 `No saved cookies found.` 表示安装成功。

---

## 📖 详细使用流程

### 第一步：登录抖音账号

首次使用必须先登录，获取并保存登录凭证。

**在 OpenClaw/Claude Code 中：**
```
帮我登录抖音
```
或
```
/douyin
```

**命令行方式：**
```bash
cd douyin-mcp-server
npx tsx scripts/login.ts
```

**流程说明：**
1. 程序会自动打开 Chrome 浏览器
2. 浏览器显示抖音创作者平台登录页面
3. **你需要手动完成登录**（扫码或账号密码）
4. 登录成功后，程序自动保存 Cookie 并关闭浏览器
5. 终端显示 `✅ Login successful!`

**登录成功输出：**
```
🚀 Starting Douyin login...
   Headless: false
   Timeout: 180000ms

✅ Login successful!
   User: 你的抖音昵称
   Cookies saved: 25
```

> ⚠️ **注意**：Cookie 有效期约 30 天，过期后需重新登录。

> 📱 **重要提示**：登录成功后，**第一次上传视频需要短信验证**。按提示输入验证码即可。完成一次验证后，之后的上传将完全自动化，无需再次验证。

---

### 第二步：上传视频

登录成功后，就可以上传视频了。

**在 OpenClaw/Claude Code 中：**
```
上传视频 /Users/xxx/video.mp4 到抖音，标题是"我的第一个视频"，标签是"日常,生活"
```

**命令行方式：**
```bash
npx tsx scripts/upload.ts \
  --video "/Users/xxx/video.mp4" \
  --title "我的第一个视频" \
  --description "这是视频描述" \
  --tags "日常,生活,记录"
```

**参数说明：**

| 参数 | 必需 | 说明 |
|-----|-----|------|
| `--video` | ✅ | 视频文件的**绝对路径** |
| `--title` | ✅ | 视频标题（建议 10-30 字） |
| `--description` | ❌ | 视频描述 |
| `--tags` | ❌ | 标签，逗号分隔 |
| `--no-publish` | ❌ | 仅保存草稿，不发布 |

**上传成功输出：**
```
🚀 Starting Douyin upload...
   Video: /Users/xxx/video.mp4
   Title: 我的第一个视频
   Tags: 日常, 生活, 记录
   Auto-publish: true

✅ Video upload and publish successful!
   Title: 我的第一个视频
   Status: Published
```

**遇到短信验证：**
```
📱 检测到短信验证页面
✅ 已发送验证码到您的手机

请输入收到的验证码：
验证码: 123456

✅ 验证码已提交
```

---

### 第三步：管理登录状态

定期检查登录状态，避免上传时才发现 Cookie 过期。

**检查登录是否有效：**
```bash
npx tsx scripts/manage.ts check
```

输出：
```
🔍 Checking login status...
✅ Cookies are valid. Can auto-login as: 你的昵称
```

**查看 Cookie 信息：**
```bash
npx tsx scripts/manage.ts info
```

输出：
```
📋 Cookie information:
   Count: 25
   Created: 2024/3/16 22:30:00
```

**清除登录数据（切换账号时使用）：**
```bash
npx tsx scripts/manage.ts clear
```

输出：
```
🗑️  Clearing login data...
✅ Cookies and browser data cleared successfully.
```

---

## 📦 Skills 说明

本项目提供一个统一的 Skill，符合 [Agent Skills](https://agentskills.io) 开放标准。

**Skill 名称**：`douyin`

**触发方式**：`/douyin` 或自然语言如 "登录抖音"、"上传视频到抖音"、"检查抖音登录状态"

**功能**：
- 登录抖音账号并保存凭证
- 上传视频到抖音（支持标题、描述、标签）
- 管理登录状态（检查、查看、清除）

### Skills 目录结构

```
skills/
└── SKILL.md      # 统一的技能定义文件
```

### 安装到不同平台

**OpenClaw：**
```bash
cp skills/SKILL.md ~/.openclaw/workspace/skills/douyin/SKILL.md
# 然后在 OpenClaw 中输入: refresh skills
```

**Claude Code：**
```bash
mkdir -p ~/.claude/skills/douyin && cp skills/SKILL.md ~/.claude/skills/douyin/
```

**其他支持 Agent Skills 的工具：**
按照各工具的 Skills 安装方式，将 `skills/SKILL.md` 复制到相应位置。

---

## 🖥️ 命令行使用

不依赖 AI 工具，直接通过命令行使用。

### 登录

```bash
npx tsx scripts/login.ts [选项]
```

| 选项 | 说明 |
|-----|------|
| `--headless` | 无头模式（登录时不要用） |
| `--timeout <ms>` | 超时时间，默认 180000 |

### 上传

```bash
npx tsx scripts/upload.ts --video <路径> --title <标题> [选项]
```

| 选项 | 说明 |
|-----|------|
| `--video` | 视频文件路径（必需） |
| `--title` | 视频标题（必需） |
| `--description` | 视频描述 |
| `--tags` | 标签，逗号分隔 |
| `--headless` | 无头模式 |
| `--no-publish` | 仅保存草稿 |

### 管理

```bash
npx tsx scripts/manage.ts <命令>
```

| 命令 | 说明 |
|-----|------|
| `check` | 检查登录状态 |
| `info` | 查看 Cookie 信息 |
| `clear` | 清除登录数据 |

---

## ❓ 常见问题

### Q: 浏览器启动失败？

```bash
# 重新安装 Chrome
npx puppeteer browsers install chrome
```

### Q: 提示 "Login expired"？

Cookie 已过期，需要重新登录：

```bash
npx tsx scripts/manage.ts clear
npx tsx scripts/login.ts
```

### Q: 上传卡住不动？

1. 检查网络连接
2. 大文件需要较长时间，请耐心等待
3. 不使用 `--headless`，观察浏览器状态

### Q: 视频上传成功但显示"审核中"？

这是正常情况，抖音会对视频进行审核，通常几分钟到几小时不等。

### Q: 如何切换抖音账号？

```bash
# 1. 清除当前登录
npx tsx scripts/manage.ts clear

# 2. 重新登录新账号
npx tsx scripts/login.ts
```

### Q: 支持哪些视频格式？

- **推荐**：MP4
- **支持**：MOV、AVI
- **分辨率**：1080x1920（竖屏）或 1920x1080（横屏）
- **时长**：15 秒 - 5 分钟
- **大小**：建议不超过 500MB

---

## 📁 项目结构

```
douyin-mcp-server/
├── skills/                     # Agent Skills 定义
│   └── SKILL.md                # 统一的技能定义文件
├── scripts/                    # CLI 脚本
│   ├── login.ts
│   ├── upload.ts
│   └── manage.ts
├── mcp-server/                 # 核心代码
│   ├── douyin-uploader.ts      # 自动化逻辑
│   ├── index.ts                # MCP 服务器入口
│   └── __tests__/              # 单元测试
├── install.sh                  # 一键安装脚本
└── README.md
```

---

## ⚠️ 注意事项

1. **账号安全**：请勿在公共环境使用，保护好 Cookie 文件
2. **使用规范**：遵守抖音平台规则，不要频繁发布或发布违规内容
3. **Cookie 有效期**：约 30 天，定期检查并重新登录

---

## 📄 许可证

MIT License

---

## 🔗 相关链接

- [OpenClaw](https://openclaw.ai) - AI 助手平台
- [Agent Skills 标准](https://agentskills.io) - 开放标准规范
- [抖音创作者平台](https://creator.douyin.com/) - 抖音官方

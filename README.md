# 微信公众号文章阅读器

一个面向微信公众号文章的轻量阅读器，目标是把“链接粘贴 → 解析 → 舒适阅读”做到尽量顺滑。

## 功能亮点

- **文章解析**：输入公众号文章链接，自动提取正文、标题、作者、时间。
- **阅读体验**：主题切换（明亮 / 护眼 / 夜间）、字号和行距可调。
- **阅读辅助**：目录导航、进度记忆、页面内搜索。
- **安全处理**：内容消毒、图片代理、来源域名白名单。
- **本地缓存**：最近阅读文章与进度保存在本地，离线也能打开。

## 项目结构

```
apps/
  api/   # 内容抽取与图片代理服务
  web/   # React 阅读器前端
slides/
```

## 开发环境要求

- Node.js >= 18
- npm

## 快速开始

### 1) 启动 API

```bash
cd apps/api
cp .env.example .env
npm install
npm run dev
```

API 默认运行在 `http://localhost:8787`。

### 2) 启动前端

```bash
cd apps/web
cp .env.example .env
npm install
npm run dev
```

前端默认在 `http://localhost:5173`。开发环境会自动代理 `/api` 到本地 API。

## 配置说明（API）

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | API 端口 | 8787 |
| `ALLOWED_HOSTS` | 允许解析的文章域名 | `mp.weixin.qq.com` |
| `IMAGE_HOSTS` | 允许代理的图片域名 | `mmbiz.qpic.cn,mmbiz.qlogo.cn` |
| `CACHE_TTL_MS` | 缓存 TTL | 1800000 |
| `CACHE_MAX_ENTRIES` | 缓存最大条数 | 100 |

## 常用命令

### API

```bash
npm run dev   # 启动开发模式
npm start     # 生产模式
npm test      # 当前无测试，仅占位
```

### Web

```bash
npm run dev
npm run build
npm run lint
```

## 已知限制

- 目前仅支持 `mp.weixin.qq.com` 的文章解析。
- 未实现账号体系与多端同步（计划功能）。
- 内容解析依赖公开页面结构，若页面结构调整需同步更新解析逻辑。

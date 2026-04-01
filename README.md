# EduMeta

<p align="center">
  <strong>把专注、协作与成长，铸造成可见的数字文明。</strong><br/>
  A cyber-native campus metaverse where your focus becomes compute power, your compute shapes your city, and your fragments become tradable value.
</p>

<p align="center">
  <a href="https://github.com/SUWJTech/EduMeta/stargazers"><img src="https://img.shields.io/github/stars/SUWJTech/EduMeta?style=for-the-badge" alt="stars"/></a>
  <a href="https://github.com/SUWJTech/EduMeta/network/members"><img src="https://img.shields.io/github/forks/SUWJTech/EduMeta?style=for-the-badge" alt="forks"/></a>
  <a href="https://github.com/SUWJTech/EduMeta/issues"><img src="https://img.shields.io/github/issues/SUWJTech/EduMeta?style=for-the-badge" alt="issues"/></a>
  <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js" alt="nextjs"/>
  <img src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20Realtime-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="supabase"/>
  <img src="https://img.shields.io/badge/Three.js-WebGL2-000000?style=for-the-badge&logo=threedotjs" alt="threejs"/>
</p>

---

## Why EduMeta

大多数效率产品只在「计时」。
**EduMeta 在「铸造」**：

- 你的专注不是倒计时，而是驱动星核挖掘的能量。
- 你的算力不是积分，而是可交易、可演化、可视化的核心资产。
- 你的城市建筑不是装饰，而是你长期成长轨迹的空间映射。

EduMeta 目标是把学习和创作过程，变成一个有生命、有经济、有叙事的数字世界。

---

## Feature Highlights

### 1) The Awakening（首次登录唤醒序列）
- 新用户注册后先进入 `/awakening`
- 黑屏终端 + 打字机节点初始化
- 白光爆发 + 星核成型
- 完成后无缝跳转首页并标记 `has_onboarded = true`

### 2) Focus Mining（专注即挖矿）
- 基础收益：`1 compute/min`
- 量子共鸣（联机）收益：`1.2x`
- 提前结束可结算，离开页面自动结束并结算
- 实时 HUD「探测深度」进度反馈
- 结算后概率掉落碎片（单人 5%，联机 25%）

### 3) Fragment Economy（碎片经济系统）
- 资产模型已简化为「算力 + 碎片」
- `metaCoins` 已移除
- 新增 `user_fragments` 与 `fragment_listings`
- 交易所支持挂单、购买、所有权转移
- 购买逻辑通过 Supabase RPC 保证原子性（余额/归属同事务完成）

### 4) Meta Passport（身份牌 2.0）
- 3x3 晶体陈列馆展示最珍贵 9 个碎片
- 碎片材质使用 CSS + Three.js 宝石感渲染
- 稀有三系集齐（Tech/Academic/Engine）解锁全息星环
- 清晰区分「实时算力余额」与「历史总产量」

### 5) Energy Life Core（首页数字生命引擎）
- 首页能量球升级为独立高性能引擎
- 严格按 `1 HTML + 4 JS` 模块化解耦：
  - `public/energy-core/index.html`
  - `public/energy-core/pipeline.js`
  - `public/energy-core/fields.js`
  - `public/energy-core/camera_io.js`
  - `public/energy-core/render.js`
- 支持情绪驱动矢量场、程序化运镜、后期特效链、VJ 控制台
- 支持文字/语音/图像输入驱动能量球多模态生长

---

## Demo Slots（预留效果截图位置）

你可以把截图按下列文件名放入 `docs/screenshots/`，README 就能直接展示。

| 场景 | 预留文件路径 | 建议内容 |
|---|---|---|
| 封面大图 | `docs/screenshots/00-cover-city.png` | 城市总览 + 能量球 UI |
| 唤醒序列 | `docs/screenshots/01-awakening-sequence.png` | 终端打字 + 白光爆发 |
| 首页星核 | `docs/screenshots/02-home-energy-core.png` | 多模态生命体形态 |
| 专注挖掘 HUD | `docs/screenshots/03-focus-mining-hud.png` | 探测深度 + 倒计时 |
| 掉落开箱 | `docs/screenshots/04-focus-loot-drop.png` | 3D 晶体破土而出 |
| 交易所 | `docs/screenshots/05-fragment-exchange.png` | 挂单全息碎片 + 购买弹窗 |
| 身份牌 | `docs/screenshots/06-meta-passport.png` | 3x3 晶体陈列馆 + 星环 |
| 移动端 | `docs/screenshots/07-mobile-view.png` | 首页/专注页移动端视图 |

> 建议先提交占位图，再替换为真实截图；这样仓库从第一天就有完整展示结构。

---

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling & Motion**: Tailwind CSS, Framer Motion
- **3D**: Three.js, React Three Fiber, Drei
- **State**: Zustand
- **Backend**: Supabase (Auth, Postgres, Realtime, RPC)
- **AI Parsing**: Doubao API（可选）+ 本地 fallback 情绪分析

---

## Project Structure

```text
EduMeta/
├─ app/
│  ├─ awakening/          # 首次登录唤醒序列
│  ├─ focus/              # 专注挖掘与结算
│  ├─ market/             # 碎片交易所
│  ├─ login/              # 登录/注册
│  └─ api/sentience/      # 多模态输入情绪解析
├─ components/
│  ├─ home/               # 首页能量球与输入中枢
│  ├─ focus/              # HUD/结算/掉落动画
│  ├─ market/             # 交易 UI 与城市交互
│  └─ MetaPassport.tsx    # 身份牌晶体陈列馆
├─ public/energy-core/    # 独立 WebGL2 能量球引擎（1+4 解耦）
├─ store/                 # 用户资产状态（compute + fragments）
├─ supabase/migrations/   # 经济模型与交易逻辑迁移
└─ docs/screenshots/      # 效果演示截图占位目录
```

---

## Quick Start

### 1. Clone

```bash
git clone https://github.com/SUWJTech/EduMeta.git
cd EduMeta
```

### 2. Install

```bash
npm install
```

### 3. Configure Environment

复制 `.env.example` 为 `.env.local` 并填写你自己的密钥：

```bash
cp .env.example .env.local
```

### 4. Run

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

---

## Database & Migration

项目包含完整 Supabase migration，核心变更包括：

- 移除旧通证字段（`meta_coins` / `tokens` 语义）
- 引入 `user_fragments`（碎片资产）
- 引入 `fragment_listings`（交易挂单）
- `finalize_focus_mining`：专注产出 + 掉落统一结算
- `buy_fragment_listing`：碎片购买原子交易

本地推送迁移：

```bash
npx supabase db push
```

---

## Product Vision

### 当前版本（已落地）
- 唤醒序列与新手接入
- 专注挖掘 + 联机加成 + 掉落结算
- 碎片交易所原子交易
- 身份牌晶体陈列馆
- 多模态能量球生命体

### 下一阶段（Roadmap）
- 城市漫游中的「我的建筑视角锁定」强化
- 交易流实时特效与社会关系可视化
- 碎片合成与高阶稀有度演化
- 联机协作任务与公会级矿脉系统
- 多端同步与数据可视化看板

---

## Contribution

非常欢迎一起把 EduMeta 做成一个真正有生命力的开源宇宙：

1. Fork 仓库
2. 新建分支：`feature/your-feature`
3. 提交改动并发起 PR
4. 在 PR 中附上截图或录屏（可放在 `docs/screenshots/`）

---

## Repo Tips（给 Star 访客）

如果你是第一次来这个仓库，建议按这个顺序体验：

1. `/login` 注册新账号
2. 进入 `/awakening` 完成唤醒
3. 回到首页体验能量球输入联动
4. 进入 `/focus` 完成一次专注并领取结算
5. 进入 `/market` 体验碎片交易与城市建筑反馈

如果你喜欢这个方向，欢迎点个 Star，帮助 EduMeta 被更多创作者看到。

---

## Status

`Active Development` - 核心体验已可运行，正在快速迭代视觉与经济系统。

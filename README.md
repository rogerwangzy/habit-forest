# 习惯森林（Forest Habbit）

一个简单的 Svelte + Tailwind 原型，用于记录习惯打卡并将打卡情况可视化为“森林”中树的生长。

快速开始

```bash
# 在项目目录中
npm install
npm run dev

# 打开浏览器访问 http://localhost:5173
```

说明

- `src/components/HabitForest.svelte`：包含添加习惯、打卡、本地存储（localStorage）以及 SVG 森林可视化。
- 使用 Tailwind CSS 进行样式。

下一步建议

- 如果需要，我可以帮你：
  - 增加后端同步（例如 Firebase 或本地 sqlite）
  - 添加用户登录/跨设备同步
  - 更丰富的森林生长动画与资源系统

PocketBase 集成

- 本项目包含一个基本的 PocketBase 前端集成（`src/lib/pb.js`、`src/components/Auth.svelte`）。
- 要使用：
  1. 下载并运行 PocketBase 服务：

```bash
# 下载并解压 pocketbase（示例）
curl -LO https://github.com/pocketbase/pocketbase/releases/download/v0.13.0/pocketbase_0.13.0_windows_amd64.zip
# 解压并运行
./pocketbase serve
```

  2. 在 `src/lib/pb.js` 中修改 `pb` 的 URL（默认 `http://127.0.0.1:8090`）。
  3. 在 PocketBase 管理界面创建一个 `habits` collection，包含字段：
     - `title` (text)
     - `completions` (text) — 我们把打卡数组以 JSON 字符串存储
  4. 在应用中使用注册/登录界面后，习惯数据会自动同步到 `habits` collection（创建/更新/删除）。

注意：当前实现假设 `habits` collection 的记录所有者是用户（PocketBase `owner` 字段），并且未实现冲突解决。可按需拓展。

额外注意（PocketBase v0.35.0）

- 请在 PocketBase 管理后台的 `Settings -> CORS` 中添加开发服务器地址，例如 `http://localhost:5174` 或 `http://127.0.0.1:5174`，否则浏览器会被阻止访问 API。
- 在 `habits` collection 的权限设置中，推荐：
  - 仅允许已认证用户创建/更新/删除自己的记录（在 "Rules" 中使用 `@request.auth.id` 或 `owner` 过滤）。
  - `completions` 字段可以设置为 `text`，前端以 JSON 字符串方式存储数组。
- 如果你想导入 collection schema，PocketBase 管理界面支持从 JSON 导入 collection 配置（Settings -> Collections -> Import）。

示例：在 PocketBase 管理界面为 `habits` 设置的字段示例

- `title` — type: `text`, required: true
- `completions` — type: `text`, required: false

如果需要，我可以为你生成一个可导入的 collection JSON 配置或 curl 请求来创建字段和权限规则。告诉我你想要的权限策略（例如：每个用户只能查看自己的习惯），我会生成相应的导入文件或命令。

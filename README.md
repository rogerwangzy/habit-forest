# 习惯森林 - Forest Habit 🌲

习惯森林是一个习惯追踪应用,通过森林可视化追踪你的习惯打卡。每一次打卡,你的森林就会成长!

## ✨ 特性

- 🌳 **可视化习惯森林**:每个习惯对应一棵树,连续打卡天数越多,树木越茂盛
- 📱 **移动端优化**:完美适配手机、平板和桌面设备
- 🎨 **自定义习惯**:选择图标和颜色,打造个性化习惯
- 📊 **统计分析**:查看总打卡数、最长连续天数、本月打卡等数据
- 🌙 **深色模式**:支持亮色/暗色主题切换
- 💾 **数据同步**:使用 PocketBase 进行云端数据同步
- 📸 **导出分享**:一键导出森林海报分享你的成就

## 🌟 树木成长阶段

- **阶段 1**:0-6 天连续打卡(小树苗)
- **阶段 2**:7-14 天连续打卡(成长中)
- **阶段 3**:15-29 天连续打卡(茂盛)
- **阶段 4**:30+ 天连续打卡(开花结果)🌸

## 🚀 一键部署到 Vercel

点击下方按钮一键部署到 Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/rogerwangzy/habit-forest)

### 部署步骤

1. 点击上方 "Deploy with Vercel" 按钮
2. 登录或注册 Vercel 账号
3. 授权访问 GitHub 仓库
4. 选择仓库并点击 "Deploy"
5. 等待构建完成(约 1-2 分钟)
6. 访问生成的域名即可使用

### 环境变量配置(可选)

如果需要使用 PocketBase 后端,需要配置以下环境变量:

- `VITE_POCKETBASE_URL`: PocketBase 服务器地址

## 💻 本地开发

### 前置要求

- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

## 🛠️ 技术栈

- **前端框架**:Svelte
- **构建工具**:Vite
- **样式**:Tailwind CSS
- **后端服务**:PocketBase
- **截图导出**:html2canvas

## 📱 移动端优化

应用已针对移动端进行了全面优化:

- ✅ 响应式设计,自适应不同屏幕尺寸
- ✅ 触摸友好的操作界面
- ✅ 移动端侧边栏模态层设计
- ✅ 优化的字体大小和间距
- ✅ 流畅的动画效果
- ✅ PWA 支持(渐进式 Web 应用)

## 📝 使用说明

1. **注册/登录**:首次使用需要注册账号
2. **添加习惯**:点击侧边栏添加新习惯,选择图标和颜色
3. **每日打卡**:在"今日打卡"区域点击习惯进行打卡
4. **查看森林**:在森林可视化区域查看你的习惯成长情况
5. **导出海报**:点击"导出海报"按钮保存你的习惯森林

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

## 📄 许可证

MIT License

## 🔗 相关链接

- [Vercel 部署文档](https://vercel.com/docs)
- [Svelte 文档](https://svelte.dev/)
- [PocketBase 文档](https://pocketbase.io/docs/)

---

Made with ❤️ by rogerwangzy
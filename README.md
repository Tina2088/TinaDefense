# Tina Nova Defense (Tina 新星防御)

这是一个使用 React + Vite + Tailwind CSS 开发的经典导弹防御类塔防游戏。

## 部署到 GitHub & Vercel 指南

### 1. 上传到 GitHub
1. 在 GitHub 上创建一个新的仓库。
2. 在本地终端执行以下命令（假设你已经安装了 git）：
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <你的仓库URL>
   git push -u origin main
   ```

### 2. 部署到 Vercel
1. 登录 [Vercel](https://vercel.com/)。
2. 点击 **"Add New"** -> **"Project"**。
3. 导入你刚刚创建的 GitHub 仓库。
4. **关键步骤：配置环境变量**
   - 在 "Environment Variables" 部分，添加以下变量：
     - `GEMINI_API_KEY`: 你的 Google Gemini API 密钥。
5. 点击 **"Deploy"**。

### 3. 项目结构
- `src/components/Game.tsx`: 核心游戏逻辑和 Canvas 渲染。
- `src/App.tsx`: 应用主入口。
- `vite.config.ts`: Vite 配置文件，处理环境变量注入。
- `vercel.json`: Vercel 路由配置，支持 SPA 模式。

## 游戏玩法
- **点击/触摸**：发射拦截导弹。
- **目标**：在敌方“西瓜火箭”摧毁城市前将其拦截。
- **胜利**：达到 1000 分。
- **失败**：所有炮台被摧毁。

## 技术栈
- **React 19**
- **Vite 6**
- **Tailwind CSS 4**
- **Motion (Framer Motion)**: 用于 UI 动画。
- **Lucide React**: 图标库。
- **Canvas API**: 高性能游戏渲染。

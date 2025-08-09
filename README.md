# Video Splitter

一个基于 Tauri + React + Rust 的专业视频分割工具。

## 功能特性

- 🎬 **多种分割方式**
  - 时间分割：按固定时长或段数分割
  - 场景分割：智能检测场景变化
  - 手动分割：自定义分割点

- 🚀 **高性能处理**
  - 基于 FFmpeg 的快速处理
  - 多线程并行分割
  - 实时进度显示

- 🎨 **现代化界面**
  - 直观的用户界面
  - 拖拽上传支持
  - 实时预览功能

## 技术栈

- **前端**: React 18 + TypeScript + Ant Design
- **后端**: Rust + Tauri + FFmpeg
- **构建工具**: Vite
- **状态管理**: Zustand
- **样式**: CSS-in-JS + 响应式设计

## 安装要求

- Rust 1.82+
- Node.js 16+
- FFmpeg (系统级依赖)

## 快速开始

### 1. 安装依赖

```bash
# 安装前端依赖
npm install

# 安装 Rust 依赖（如果需要）
cargo build
```

### 2. 开发模式

```bash
# 启动开发服务器
npm run tauri dev
```

### 3. 构建应用

```bash
# 构建生产版本
npm run tauri build
```

## 项目结构

```
video-splitter/
├── src/                    # Rust 源代码
│   ├── commands/           # Tauri 命令
│   ├── services/           # 业务逻辑
│   ├── models/             # 数据模型
│   └── utils/              # 工具函数
├── src/                    # React 源代码
│   ├── components/         # React 组件
│   ├── hooks/              # 自定义 Hooks
│   ├── services/           # API 服务
│   ├── types/              # TypeScript 类型
│   └── utils/              # 工具函数
└── 配置文件
```

## 使用说明

1. **选择视频文件**
   - 点击上传区域或拖拽视频文件
   - 支持常见视频格式（MP4, AVI, MOV, MKV等）

2. **查看视频信息**
   - 自动显示视频时长、分辨率、帧率等信息
   - 支持多种视频格式解析

3. **选择分割方式**
   - 时间分割：设置每段时长或分割段数
   - 场景分割：自动检测场景变化
   - 手动分割：自定义分割时间点

4. **开始分割**
   - 点击"开始分割"按钮
   - 实时查看分割进度
   - 分割完成后可下载结果

## 开发命令

```bash
# 前端开发
npm run dev

# Tauri 开发
npm run tauri dev

# 构建应用
npm run tauri build

# 类型检查
npm run type-check

# 代码格式化
npm run format
```

## 路线图

- [ ] 音频分割（基于静音检测）
- [ ] AI 分割（基于内容理解）
- [ ] 批量处理
- [ ] 视频合并
- [ ] 自定义输出格式
- [ ] 预设配置
- [ ] 插件系统

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
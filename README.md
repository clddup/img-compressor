# 智能图片压缩工具

基于 Vite + React + TypeScript 的浏览器端图片压缩工具。支持指定单张目标大小，并自动调整 JPEG 质量和尺寸。

## 功能

- 单张或多张图片压缩。
- 文件夹上传，导出时保留相对目录结构。
- ZIP 上传，自动读取其中图片。
- 多图批量导出为 ZIP，单图直接导出 JPG。
- Canvas 本地压缩，不上传图片到服务器。
- 霓虹科技感界面、粒子背景和鼠标光晕。

## 开发

```bash
pnpm install
pnpm dev
```

## 构建

```bash
pnpm build
pnpm preview
```

## 技术栈

- Vite
- React
- TypeScript
- JSZip
- Canvas API

## 说明

浏览器会把所有输出统一转换为 JPEG。透明 PNG 会被绘制到 Canvas 后按 JPEG 导出，因此透明区域不再保留。
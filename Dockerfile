# 阶段一：构建前端 UI
FROM node:22-alpine AS builder
WORKDIR /app

# 安装 pnpm 并禁用运行前依赖校验
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm config set verify-deps-before-run false

# 复制依赖描述文件
COPY package.json ./
COPY frontend/package.json ./frontend/

# 安装后端依赖和前端依赖
RUN npm install
RUN cd frontend && pnpm install

# 复制全部源码
COPY . .

# 构建 UI 并嵌入后端模板
ENV CI=true
RUN npm run build:ui

# 阶段二：运行镜像
FROM node:22-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/danmu_api ./danmu_api
COPY --from=builder /app/config ./config_example

EXPOSE 9321
CMD ["node", "danmu_api/server.js"]

# Go helper is compiled for the target image architecture, not the build host.
FROM --platform=$BUILDPLATFORM golang:1.27-alpine AS outbound-builder
ARG TARGETOS
ARG TARGETARCH
WORKDIR /src
COPY outbound/go.mod outbound/go.sum ./
RUN go mod download
COPY outbound/*.go ./
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o /danmu-outbound .

# 使用官方 Node.js 22 轻量版镜像作为基础镜像
FROM node:22-alpine

# 设置工作目录为项目根目录
WORKDIR /app
RUN apk add --no-cache ca-certificates

# 复制 package.json 和 package-lock.json（如果存在）
COPY package*.json ./

# 安装项目依赖
RUN npm install

# 复制所有源代码
COPY danmu_api/ ./danmu_api/
COPY --from=outbound-builder /danmu-outbound /app/outbound/bin/danmu-outbound
COPY config/ ./config_example/

# 暴露端口
EXPOSE 9321

# 启动命令
CMD ["node", "danmu_api/server.js"]

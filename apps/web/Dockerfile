# ============================================================================
# HAOYAO 前端 Web Dockerfile（Next.js 15 多阶段构建）
# 依据：方案 §3 / 《开发技术文档》§8；M8 容器化落地参考。
# 阶段：
#   deps  —— 安装依赖（利用层缓存）
#   builder —— 构建 Next.js 生产产物
#   runner —— 精简运行时镜像（standalone 输出）
# 用法：docker build -t haoyao-web -f apps/web/Dockerfile .（在仓库根构建）
# ============================================================================

# ---------- 1. 依赖层 ----------
FROM node:22-alpine AS deps
WORKDIR /srv/app
# 仅复制清单文件以最大化层缓存命中
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci

# ---------- 2. 构建层 ----------
FROM node:22-alpine AS builder
WORKDIR /srv/app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /srv/app/node_modules ./node_modules
COPY apps/web ./
# 构建：Next 15 输出到 apps/web/.next
RUN npm run build

# ---------- 3. 运行时层（standalone） ----------
FROM node:22-alpine AS runner
WORKDIR /srv/app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# 非 root 用户运行（安全）
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# 复制 standalone 输出（Next 15 standalone 模式仅包含运行时所需）
COPY --from=builder --chown=nextjs:nodejs /srv/app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /srv/app/.next/static ./.next/static
# 复制 public 资源（图标/静态文件）
COPY --from=builder --chown=nextjs:nodejs /srv/app/public ./public

USER nextjs
EXPOSE 3000

# 启动：Next standalone 默认在 0.0.0.0:3000 监听
CMD ["node", "server.js"]

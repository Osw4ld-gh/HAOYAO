# ============================================================================
# HAOYAO 后端 API Dockerfile
# 依据：方案 §3 工程基线 / 《开发技术文档》§8 部署；M8 容器化落地参考。
# 用法：docker build -t haoyao-api -f apps/api/Dockerfile .（在仓库根构建）
# ============================================================================

FROM python:3.12-slim AS runtime

# 容器内时区（仅展示用，业务存储仍为 UTC）
ENV APP_TIMEZONE=Asia/Shanghai \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# 应用目录
WORKDIR /srv/app

# 先复制依赖清单（利用层缓存：依赖变化频率低于代码）
COPY apps/api/pyproject.toml ./pyproject.toml

# 安装运行时依赖（与 pyproject.toml dependencies 保持一致；保持显式以便层缓存生效）
RUN pip install --upgrade pip \
    && pip install \
        "fastapi[standard]" \
        sqlalchemy \
        pydantic \
        pydantic-settings \
        pyjwt \
        bcrypt \
        python-multipart

# 复制应用代码与 SQL 脚本（scripts/sql 是 DDL 唯一权威源，方案 P4）
COPY apps/api/app ./app
COPY scripts/sql ./scripts/sql

# 默认端口（与 docker-compose 中端口映射保持一致；最终以部署环境为准）
EXPOSE 8000

# 启动命令：uvicorn 绑定 0.0.0.0 接收容器外流量
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

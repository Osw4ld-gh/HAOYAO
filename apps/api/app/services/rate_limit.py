# ============================================================================
# HAOYAO 后端：登录限流服务（内存实现）
# 功能：连续失败 5 次锁定 15 分钟（按用户名），登录接口调用。
# 依据：《HAOYAO_官网_开发技术文档.md》§5.3 登录限流：
#   - 单实例内存实现（V1 可接受）；未来多实例部署切换 Redis，接口签名不变
# ============================================================================

from __future__ import annotations

import threading
import time

from ..core.config import settings


class LoginRateLimiter:
    """登录失败限流器。

    状态存储：
      _store[username] = {"failures": 连续失败次数, "locked_until": 解锁时间戳}
    线程安全：使用 threading.Lock 保护共享字典（FastAPI 多线程处理请求）。
    """

    # 连续失败次数阈值（默认 5）
    MAX_FAILURES = settings.LOGIN_MAX_FAILURES
    # 锁定分钟数（默认 15）
    LOCK_MINUTES = settings.LOGIN_LOCK_MINUTES

    def __init__(self) -> None:
        # 状态字典：username -> {"failures": int, "locked_until": float}
        self._store: dict[str, dict[str, float | int]] = {}
        self._lock = threading.Lock()

    def is_locked(self, username: str) -> bool:
        """判断账号当前是否处于锁定状态。"""
        with self._lock:
            record = self._store.get(username)
            if not record:
                return False
            locked_until = record.get("locked_until", 0)
            # 锁定已过期则清除状态（视为未锁定）
            if locked_until and time.time() < float(locked_until):
                return True
            if locked_until:
                self._store.pop(username, None)
            return False

    def remaining_failures(self, username: str) -> int:
        """返回解锁前剩余的失败尝试次数。"""
        with self._lock:
            record = self._store.get(username) or {}
            return max(0, self.MAX_FAILURES - int(record.get("failures", 0)))

    def locked_until(self, username: str) -> float | None:
        """返回锁定截止时间戳（未锁定返回 None）。"""
        with self._lock:
            record = self._store.get(username) or {}
            locked_until = record.get("locked_until", 0)
            if locked_until and time.time() < float(locked_until):
                return float(locked_until)
            return None

    def record_failure(self, username: str) -> int:
        """记录一次失败，达到阈值时进入锁定；返回剩余失败次数。

        返回 0 表示已触发锁定（剩余 0 次尝试机会）。
        """
        with self._lock:
            record = self._store.setdefault(username, {"failures": 0, "locked_until": 0})
            failures = int(record["failures"]) + 1
            record["failures"] = failures
            if failures >= self.MAX_FAILURES:
                # 触发锁定：记录解锁时间戳
                record["locked_until"] = time.time() + self.LOCK_MINUTES * 60
            return max(0, self.MAX_FAILURES - failures)

    def reset(self, username: str) -> None:
        """登录成功后清除失败计数与锁定状态。"""
        with self._lock:
            self._store.pop(username, None)


# 模块级单例：全应用共享同一限流状态
rate_limiter = LoginRateLimiter()

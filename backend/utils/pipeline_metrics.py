"""Simple pipeline metrics collection for observability."""

import time
import logging
from collections import defaultdict
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


class PipelineMetrics:
    """Collects timing and count metrics for a single pipeline run."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.start_time = time.monotonic()
        self.stage_times: dict[str, list[float]] = defaultdict(list)
        self.success_count = 0
        self.fail_count = 0
        self.skip_count = 0
        self.timeout_count = 0

    @asynccontextmanager
    async def measure(self, stage: str):
        """Context manager to measure a stage's duration."""
        t0 = time.monotonic()
        try:
            yield
        finally:
            elapsed = time.monotonic() - t0
            self.stage_times[stage].append(elapsed)

    def record_success(self):
        self.success_count += 1

    def record_failure(self):
        self.fail_count += 1

    def record_skip(self):
        self.skip_count += 1

    def record_timeout(self):
        self.timeout_count += 1

    def summary(self) -> dict:
        total_elapsed = time.monotonic() - self.start_time
        stage_summary = {}
        for stage, times in self.stage_times.items():
            stage_summary[stage] = {
                'count': len(times),
                'total_s': round(sum(times), 2),
                'avg_s': round(sum(times) / len(times), 2) if times else 0,
            }
        return {
            'session_id': self.session_id,
            'total_elapsed_s': round(total_elapsed, 2),
            'urls_success': self.success_count,
            'urls_failed': self.fail_count,
            'urls_skipped': self.skip_count,
            'urls_timed_out': self.timeout_count,
            'stages': stage_summary,
        }

    def log_summary(self):
        s = self.summary()
        logger.info(
            f"Pipeline metrics [{self.session_id}]: "
            f"{s['total_elapsed_s']}s total, "
            f"{s['urls_success']} ok / {s['urls_failed']} fail / "
            f"{s['urls_skipped']} skip / {s['urls_timed_out']} timeout"
        )
        for stage, data in s['stages'].items():
            logger.debug(
                f"  Stage [{stage}]: {data['count']}x, "
                f"total={data['total_s']}s, avg={data['avg_s']}s"
            )

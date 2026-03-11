import asyncio
import logging
from ws_module.manager import manager, ScraperState

logger = logging.getLogger(__name__)

async def handle_cancel(session_id: str, state: ScraperState):
    """Cancel the current scraping task and clear queued queries."""
    if not state.is_running and state.query_queue.empty() and (not state.task or state.task.done()):
        logger.warning(f"No scraper running or queries queued to cancel for session {session_id}")
        await manager.send_message(session_id, {
            'status': 'error',
            'url': None,
            'reason': 'No scraper running or queries queued'
        })
        return
    
    logger.info(f"Cancelling scraper and queries for {session_id}")
    state.cancelled = True
    if state.task and not state.task.done():
        state.task.cancel()
        try:
            await state.task
        except Exception:
            pass
    while not state.urls_queue.empty():
        try:
            await state.urls_queue.get()
            state.urls_queue.task_done()
        except Exception:
            pass
    while not state.query_queue.empty():
        try:
            await state.query_queue.get()
            state.query_queue.task_done()
        except Exception:
            pass
    try:
        await manager.send_message(session_id, {
            'status': 'stopped',
            'message': 'Scraper and queued queries stopped'
        })
        logger.info(f"Sent stopped message for {session_id}")
    except Exception as e:
        logger.error(f"Failed to send stopped message for {session_id}: {e}")
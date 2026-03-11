from uvicorn.workers import UvicornWorker

class MyUvicornWorker(UvicornWorker):
    CONFIG_KWARGS = {"ws": "wsproto", "loop": "asyncio", "http": "h11","lifespan": "auto", "log_level": "info" }

       
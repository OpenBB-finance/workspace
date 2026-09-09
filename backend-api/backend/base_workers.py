# Wildcard imports allow us to not have to restart the job on each run, do NOT delete


from api.worker_tasks import *  # noqa
from utilities.config import *  # type: ignore # noqa

# Import cluster-compatible classes if cluster mode or RQ hash tags are enabled
if settings.REDIS_CLUSTER_MODE or settings.REDIS_RQ_HASH_TAGS:  # noqa: F405
    settings.set_is_worker(True)  # noqa: F405
    from utilities.rq_cluster import (
        ClusterQueue as Queue,
        ClusterWorker as Worker,
        init_module_cluster_compatibility,
    )

    init_module_cluster_compatibility()
else:
    from rq import Queue, Worker  # noqa

listen = ["payments_queue"]

redis_conn = settings.get_redis_session("bot")  # noqa: F405

if __name__ == "__main__":
    settings.set_is_worker(True)  # noqa: F405
    settings.setup_logging()  # noqa: F405
    queue = Queue(name=listen, connection=redis_conn)
    worker = Worker(listen, connection=redis_conn)
    worker.work(with_scheduler=True)

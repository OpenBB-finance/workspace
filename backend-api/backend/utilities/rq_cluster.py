"""
Redis Cluster compatible RQ classes.

All keys use hash tag {rq} to ensure they land in the same slot.
This allows RQ to work with Redis Cluster by ensuring all multi-key
transactions (MULTI/EXEC) and WATCH operations touch keys in the same hash slot.

Usage:
    from utilities.rq_cluster import ClusterQueue, ClusterWorker

    queue = ClusterQueue(name="my_queue", connection=redis_cluster_conn)
    worker = ClusterWorker([queue], connection=redis_cluster_conn)
"""

import logging
import sys
import time
from typing import Any, cast

from redis import Redis, RedisCluster, WatchError
from redis.cluster import ClusterPipeline
from redis.exceptions import RedisClusterException
from rq import Queue, Worker
from rq.exceptions import NoSuchJobError
from rq.job import Job
from rq.logutils import (
    DEFAULT_LOGGING_DATE_FORMAT,
    DEFAULT_LOGGING_FORMAT,
    setup_loghandlers,
)
from rq.registry import ScheduledJobRegistry, StartedJobRegistry
from rq.scheduler import RQScheduler
from rq.serializers import resolve_serializer
from rq.timeouts import BaseDeathPenalty
from rq.utils import (
    as_text,
    backend_class,
    current_timestamp,
    get_version,
    parse_names,
    utcnow,
)

from utilities.config import settings


def cast_cluster_pipeline(connection: RedisCluster, **kwargs) -> ClusterPipeline:
    """Casts a Redis connection's pipeline to ClusterPipeline.

    Args:
        connection (RedisCluster): The Redis Cluster connection.

    Returns:
        ClusterPipeline: The ClusterPipeline instance.
    """
    return cast(ClusterPipeline, connection.pipeline(**kwargs))


class ClusterJob(Job):
    """Job class with hash tag support for Redis Cluster.

    All job keys will be prefixed with 'rq:{rq}:job:' instead of 'rq:job:'
    to ensure they hash to the same slot.
    """

    redis_job_namespace_prefix = "rq:{rq}:job:"


class ClusterQueue(Queue):
    """Queue class with hash tag support for Redis Cluster.

    All queue keys will be prefixed with 'rq:{rq}:' to ensure they hash
    to the same slot as job keys.
    """

    redis_queue_namespace_prefix = "rq:{rq}:queue:"
    redis_queues_keys = "rq:{rq}:queues"
    job_class = ClusterJob

    @property
    def scheduler_pid(self) -> int:
        pid = self.connection.get(ClusterRQScheduler.get_locking_key(self.name))
        return int(pid.decode()) if pid is not None else None

    @property
    def registry_cleaning_key(self):
        """Redis key used to indicate this queue has been cleaned."""
        return f"rq:{{rq}}:clean_registries:{self.name}"

    @classmethod
    def dequeue_any(  # noqa: PLR0913, PLR0917
        cls,
        queues: list["Queue"],
        timeout: int | None,
        connection: RedisCluster,
        job_class: type["Job"] | None = None,
        serializer: Any = None,
        death_penalty_class: type[BaseDeathPenalty] | None = None,
    ) -> tuple["Job", "Queue"] | tuple[None, None]:
        """Class method returning the job_class instance at the front of the given
        set of Queues, where the order of the queues is important.

        When all of the Queues are empty, depending on the `timeout` argument,
        either blocks execution of this function for the duration of the
        timeout or until new messages arrive on any of the queues, or returns
        None.

        See the documentation of cls.lpop for the interpretation of timeout.

        Args:
            queues (List[Queue]): List of queue objects
            timeout (Optional[int]): Timeout for the LPOP
            connection (Optional[Redis], optional): Redis Connection. Defaults to None.
            job_class (Optional[Type[Job]], optional): The job class. Defaults to None.
            serializer (Any, optional): Serializer to use. Defaults to None.
            death_penalty_class (Optional[Type[BaseDeathPenalty]], optional): The death penalty class. Defaults to None.

        Raises:
            e: Any exception

        Returns:
            job, queue (Tuple[Job, Queue]): A tuple of Job, Queue
        """
        job_cls: type[Job] = backend_class(cls, "job_class", override=job_class)  # type: ignore

        while True:
            queue_keys = [q.key for q in queues]
            if len(queue_keys) == 1 and get_version(connection) >= (6, 2, 0):
                try:
                    result = cls.lmove(connection, queue_keys[0], timeout)
                    # If you using redis Cluster you can only use lpop
                except RedisClusterException:
                    result = cls.lpop(queue_keys, timeout, connection=connection)
            else:
                result = cls.lpop(queue_keys, timeout, connection=connection)
            if result is None:
                return None
            queue_key, job_id = map(as_text, result)
            queue = cls.from_queue_key(
                queue_key,
                connection=connection,
                job_class=job_cls,
                serializer=serializer,
                death_penalty_class=death_penalty_class,
            )
            try:
                job = job_cls.fetch(
                    job_id, connection=connection, serializer=serializer
                )
            except NoSuchJobError:
                # Silently pass on jobs that don't exist (anymore),
                # and continue in the look
                continue
            except Exception as e:
                # Attach queue information on the exception for improved error
                # reporting
                e.job_id = job_id
                e.queue = queue
                raise e
            return job, queue
        return None, None


class ClusterRQScheduler(RQScheduler):
    """RQScheduler class that uses ClusterQueue and ClusterJob to ensure
    all operations are cluster-compatible.
    """

    cluster_connection: RedisCluster

    def __init__(  # noqa
        self,
        queues,
        connection: RedisCluster,
        interval=1,
        logging_level=logging.INFO,
        date_format=DEFAULT_LOGGING_DATE_FORMAT,
        log_format=DEFAULT_LOGGING_FORMAT,
        serializer=None,
    ):
        self._queue_names = set(parse_names(queues))
        self._acquired_locks: set[str] = set()
        self._scheduled_job_registries: list[ScheduledJobRegistry] = []
        self.lock_acquisition_time = None
        self.serializer = resolve_serializer(serializer)

        self._connection = None
        self.cluster_connection = connection
        self.interval = interval
        self._stop_requested = False
        self._status = self.Status.STOPPED
        self._process = None
        self.log = logging.getLogger(__name__)
        setup_loghandlers(
            level=logging_level,
            name=__name__,
            log_format=log_format,
            date_format=date_format,
        )

    @property
    def connection(self):
        if self._connection:
            return self._connection

        return self.cluster_connection

    @classmethod
    def get_locking_key(cls, name: str):
        """Returns scheduler key for a given queue name"""
        return f"rq:{{rq}}:scheduler-lock:{name}"

    def enqueue_scheduled_jobs(self):
        """Enqueue jobs whose timestamp is in the past"""
        self._status = self.Status.WORKING

        if not self._scheduled_job_registries and self._acquired_locks:
            self.prepare_registries()

        for registry in self._scheduled_job_registries:
            timestamp = current_timestamp()

            # TODO: try to use Lua script to make get_jobs_to_schedule()
            # and remove_jobs() atomic
            job_ids = registry.get_jobs_to_schedule(timestamp)

            if not job_ids:
                continue

            queue = ClusterQueue(
                registry.name, connection=self.connection, serializer=self.serializer
            )

            with self.connection.pipeline() as pipeline:
                jobs = ClusterJob.fetch_many(
                    job_ids, connection=self.connection, serializer=self.serializer
                )
                for job in jobs:
                    if job is not None:
                        queue._enqueue_job(
                            job, pipeline=pipeline, at_front=bool(job.enqueue_at_front)
                        )
                        registry.remove(job, pipeline=pipeline)
                pipeline.execute()
        self._status = self.Status.STARTED


class ClusterWorker(Worker):
    """Worker class with hash tag support for Redis Cluster.

    Uses ClusterQueue and ClusterJob to ensure all operations are
    cluster-compatible.
    """

    queue_class = ClusterQueue
    job_class = ClusterJob
    connection: RedisCluster
    redis_workers_keys = "rq:{rq}:workers"
    redis_worker_namespace_prefix = "rq:{rq}:worker:"

    @property
    def pubsub_channel_name(self):
        """Returns the worker's Redis hash key."""
        return f"rq:{{rq}}:pubsub:{self.name}"

    def _start_scheduler(
        self,
        burst: bool = False,
        logging_level: str = "INFO",
        date_format: str = DEFAULT_LOGGING_DATE_FORMAT,
        log_format: str = DEFAULT_LOGGING_FORMAT,
    ):
        """Starts the scheduler process.
        This is specifically designed to be run by the worker when running the `work()` method.
        Instanciates the RQScheduler and tries to acquire a lock.
        If the lock is acquired, start scheduler.
        If worker is on burst mode just enqueues scheduled jobs and quits,
        otherwise, starts the scheduler in a separate process.

        Args:
            burst (bool, optional): Whether to work on burst mode. Defaults to False.
            logging_level (str, optional): Logging level to use. Defaults to "INFO".
            date_format (str, optional): Date Format. Defaults to DEFAULT_LOGGING_DATE_FORMAT.
            log_format (str, optional): Log Format. Defaults to DEFAULT_LOGGING_FORMAT.
        """
        self.scheduler = ClusterRQScheduler(
            self.queues,
            connection=self.connection,
            logging_level=logging_level,
            date_format=date_format,
            log_format=log_format,
            serializer=self.serializer,
        )

        self.scheduler.acquire_locks()
        if self.scheduler.acquired_locks:
            if burst:
                self.scheduler.enqueue_scheduled_jobs()
                self.scheduler.release_locks()
            else:
                self.scheduler.start()

    def _set_connection(self, connection: RedisCluster) -> RedisCluster:
        """Configures the Redis connection to have a socket timeout.
        This should timouet the connection in case any specific command hangs at any given time (eg. BLPOP).
        If the connection provided already has a `socket_timeout` defined, skips.

        Args:
            connection (Optional[Redis]): The Redis Connection.
        """
        try:
            current_socket_timeout = connection.connection_pool.connection_kwargs.get(
                "socket_timeout"
            )
            if current_socket_timeout is None:
                timeout_config = {"socket_timeout": self.connection_timeout}
                connection.connection_pool.connection_kwargs.update(timeout_config)
            return connection
        # If you are using RedisCluster you needs to pars all cluster nodes.
        except AttributeError:
            manager = connection.nodes_manager
            current_socket_timeout = manager.connection_kwargs.get("socket_timeout")
            if current_socket_timeout is None:
                timeout_config = {"socket_timeout": self.connection_timeout}
                manager.connection_kwargs.update(timeout_config)

            for node in connection.get_nodes():
                redis_connection = node.redis_connection
                if redis_connection is None:
                    continue

                current_socket_timeout = (
                    redis_connection.connection_pool.connection_kwargs.get(
                        "socket_timeout"
                    )
                )
                if current_socket_timeout is None:
                    timeout_config = {"socket_timeout": self.connection_timeout}
                    node.redis_connection.connection_pool.connection_kwargs.update(
                        timeout_config
                    )
            return connection

    def prepare_job_execution(
        self, job: "Job", remove_from_intermediate_queue: bool = False
    ):
        """Performs misc bookkeeping like updating states prior to
        job execution.
        """
        self.log.debug("Preparing for execution of Job ID %s", job.id)
        with cast_cluster_pipeline(self.connection) as pipeline:
            self.set_current_job_id(job.id, pipeline=pipeline)
            self.set_current_job_working_time(0, pipeline=pipeline)

            heartbeat_ttl = self.get_heartbeat_ttl(job)
            self.heartbeat(heartbeat_ttl, pipeline=pipeline)
            job.heartbeat(utcnow(), heartbeat_ttl, pipeline=pipeline)

            job.prepare_for_execution(self.name, pipeline=pipeline)
            if remove_from_intermediate_queue:
                queue = ClusterQueue(job.origin, connection=self.connection)
                pipeline.lrem(queue.intermediate_queue_key, 1, job.id)
            pipeline.execute()
            self.log.debug("Job preparation finished.")

        msg = "Processing {0} from {1} since {2}"
        self.procline(msg.format(job.func_name, job.origin, time.time()))

    def handle_job_success(
        self, job: "Job", queue: "Queue", started_job_registry: StartedJobRegistry
    ):
        """Handles the successful execution of certain job.
        It will remove the job from the `StartedJobRegistry`, adding it to the `SuccessfulJobRegistry`,
        and run a few maintenance tasks including:
            - Resting the current job ID
            - Enqueue dependents
            - Incrementing the job count and working time
            - Handling of the job successful execution

        Runs within a loop with the `watch` method so that protects interactions
        with dependents keys.

        Args:
            job (Job): The job that was successful.
            queue (Queue): The queue
            started_job_registry (StartedJobRegistry): The started registry
        """
        self.log.debug("Handling successful execution of job %s", job.id)

        while True:
            pipe = cast_cluster_pipeline(self.connection, transaction=True)
            try:
                # if dependencies are inserted after enqueue_dependents
                # a WatchError is thrown by execute()
                pipe.watch(job.dependents_key)
                # enqueue_dependents might call multi() on the pipeline
                queue.enqueue_dependents(job, pipeline=pipe)
                pipe.execute()

                pipeline = cast_cluster_pipeline(self.connection)
                # if not pipeline.explicit_transaction:
                #     # enqueue_dependents didn't call multi after all!
                #     # We have to do it ourselves to make sure everything runs in a transaction
                #     pipeline.multi()

                self.log.info(
                    f"Pipeline: {pipeline} for handling successful job {job.id}"
                )

                self.set_current_job_id(None, pipeline=pipeline)
                self.increment_successful_job_count(pipeline=pipeline)
                self.increment_total_working_time(job.ended_at - job.started_at, pipeline)  # type: ignore

                result_ttl = job.get_result_ttl(self.default_result_ttl)
                if result_ttl != 0:
                    self.log.debug(
                        "Saving job %s's successful execution result", job.id
                    )
                    job._handle_success(result_ttl, pipeline=pipeline)

                job.cleanup(result_ttl, pipeline=pipeline, remove_from_queue=False)
                self.log.debug("Removing job %s from StartedJobRegistry", job.id)
                started_job_registry.remove(job, pipeline=pipeline)

                pipeline.execute()
                self.log.debug(
                    "Finished handling successful execution of job %s", job.id
                )
                break
            except WatchError:
                continue


def get_key(job_id):
    return f"{{rq}}:results:{job_id}"


def base_registry_init(  # noqa
    self,
    name: str = "default",
    connection: type["Redis"] | None = None,
    job_class: type["Job"] | None = None,
    queue: type["Queue"] | None = None,
    serializer: Any = None,
    death_penalty_class: type[BaseDeathPenalty] | None = None,
):
    if queue:
        self.name = queue.name
        self.connection = queue.connection
        self.serializer = queue.serializer
    else:
        self.name = name
        self.connection = connection
        self.serializer = resolve_serializer(serializer)

    self.key_template = self.key_template.replace(":{0}", "")

    self.key = f"{self.key_template}:{self.name}"
    self.job_class = backend_class(self, "job_class", override=job_class)
    self.death_penalty_class = backend_class(
        self, "death_penalty_class", override=death_penalty_class
    )


def init_module_cluster_compatibility():
    """Modifies RQ module classes to be Redis Cluster compatible by
    updating key templates and relevant methods.
    """
    import rq.results  # noqa

    sys.modules["rq.registry"].__dict__["REDIS_WORKER_KEYS"] = "rq:{rq}:workers"  # type: ignore
    sys.modules["rq.registry"].__dict__["WORKERS_BY_QUEUE_KEY"] = "rq:{rq}:workers:%s"  # type: ignore
    sys.modules["rq.suspension"].__dict__["WORKERS_SUSPENDED"] = "rq:{rq}:suspended"  # type: ignore
    sys.modules["rq.results"].__dict__["get_key"] = get_key  # type: ignore

    for call_name in [
        "BaseRegistry",
        "StartedJobRegistry",
        "FinishedJobRegistry",
        "FailedJobRegistry",
        "DeferredJobRegistry",
        "ScheduledJobRegistry",
        "CanceledJobRegistry",
    ]:
        cls = sys.modules["rq.registry"].__dict__[call_name]
        cls.key_template = cls.key_template.replace("rq:", "rq:{rq}:")
        cls.__init__ = base_registry_init  # type: ignore
        sys.modules["rq.registry"].__dict__[call_name] = cls


if (
    settings.REDIS_CLUSTER_MODE or settings.REDIS_RQ_HASH_TAGS
) and not settings.IS_WORKER_CONTAINER:
    init_module_cluster_compatibility()

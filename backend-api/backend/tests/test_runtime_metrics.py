from utilities.runtime_metrics import _pool_stats


class _FakePool:
    def __init__(self, checked_out, checked_in, size, overflow):
        self._co, self._ci, self._sz, self._of = checked_out, checked_in, size, overflow

    def checkedout(self):
        return self._co

    def checkedin(self):
        return self._ci

    def size(self):
        return self._sz

    def overflow(self):
        return self._of


class _FakeEngine:
    def __init__(self, pool):
        self.pool = pool


def test_pool_stats_reads_all_counters():
    engines = {"async_write": _FakeEngine(_FakePool(3, 7, 10, 2))}
    assert _pool_stats(engines) == {
        "async_write": {
            "checked_out": 3.0,
            "checked_in": 7.0,
            "size": 10.0,
            "overflow": 2.0,
        }
    }


def test_pool_stats_skips_engine_without_pool():
    class NoPool:
        pool = None

    assert _pool_stats({"x": NoPool()}) == {}


def test_pool_stats_is_defensive_when_a_counter_raises():
    class BadPool:
        def checkedout(self):
            raise RuntimeError("driver detached")

        def checkedin(self):
            return 1

        def size(self):
            return 5

        def overflow(self):
            return 0

    stats = _pool_stats({"e": _FakeEngine(BadPool())})
    assert "checked_out" not in stats["e"]
    assert stats["e"] == {"checked_in": 1.0, "size": 5.0, "overflow": 0.0}

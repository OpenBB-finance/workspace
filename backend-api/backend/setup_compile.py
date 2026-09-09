"""Compile selected packages to Cython extensions for the lite distribution.

Produces a .so per .py in the compiled packages. The Dockerfile then deletes
the original .py sources before assembling the production image.

What stays as .py (and why):
    - __init__.py        — re-exports / dynamic imports break under Cython
    - alembic/versions/* — schema source-of-truth, must be readable
    - scripts/*          — meant to be invoked as scripts; compiling adds friction
    - main.py            — entry point; trivial, no IP to hide

linetrace + binding directives keep tracebacks usable: per-statement line
numbers stay in compiled frames, so a customer-reported error pointing at
``api/storage/local.py:87`` maps cleanly back to the original source for
internal debugging (even though the customer has no .py file there).
"""

from pathlib import Path

from Cython.Build import cythonize
from setuptools import Extension, setup

COMPILE_PACKAGES = ["api", "routers", "utilities"]

# Files that must stay as .py — Pydantic v2's metaclass reads __annotations__
# from the class namespace during class construction, and Cython mangles that
# enough that field discovery fails. Affected files are mostly schema/model
# definitions (low IP) plus a few routers that mix handlers with Pydantic
# response models. Splitting those routers would let the handlers compile;
# parked as a follow-up.
EXCLUDE_FILES = {
    "api/models/tauri_models.py",
    "routers/routers_helpers.py",
    "routers/metrics.py",
}


def collect_sources() -> list[str]:
    sources: list[str] = []
    for pkg in COMPILE_PACKAGES:
        for path in Path(pkg).rglob("*.py"):
            posix = path.as_posix()
            if path.name == "__init__.py":
                continue
            if posix in EXCLUDE_FILES:
                continue
            sources.append(posix)
    return sources


def build_extensions() -> list[Extension]:
    extensions: list[Extension] = []
    for src in collect_sources():
        module = src[:-3].replace("/", ".")
        extensions.append(
            Extension(
                module,
                sources=[src],
                define_macros=[
                    ("CYTHON_TRACE", "1"),
                    ("CYTHON_TRACE_NOGIL", "1"),
                ],
            )
        )
    return extensions


setup(
    name="openbb_backend_compiled",
    ext_modules=cythonize(
        build_extensions(),
        compiler_directives={
            "language_level": "3",
            "linetrace": True,
            "binding": True,
            "embedsignature": True,
            # Treat Python annotations as informational only — without this,
            # Cython enforces them as runtime type checks, which breaks
            # FastAPI's `def handler(x: str = Depends(...))` pattern because
            # Depends() doesn't return a str.
            "annotation_typing": False,
        },
    ),
)

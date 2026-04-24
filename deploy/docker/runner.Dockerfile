FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/server \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Tectonic — self-contained LaTeX engine used by doc-generation + cover-letter.
# Pinned release (static musl binary, ~5 MB) instead of apt's TeX Live (~3 GB).
# Packages download on demand into ~/.cache/Tectonic, which is mounted as a
# persistent volume in docker-compose.yml so the first compilation in a session
# primes the cache for the rest.
#
# Bump via `docker compose build --build-arg TECTONIC_VERSION=0.17.0 runner`
# when upstream cuts a new release. Release list:
#   https://github.com/tectonic-typesetting/tectonic/releases
ARG TARGETARCH
ARG TECTONIC_VERSION=0.16.9
RUN set -eux; \
    case "${TARGETARCH:-amd64}" in \
        amd64) arch="x86_64-unknown-linux-musl" ;; \
        arm64) arch="aarch64-unknown-linux-musl" ;; \
        *) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic@${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-${arch}.tar.gz" \
        | tar -xz -C /usr/local/bin tectonic; \
    tectonic --version

WORKDIR /app

COPY server/requirements.txt /app/server/requirements.txt
RUN pip install -r /app/server/requirements.txt \
    && pip install "fastapi==0.115.6" "uvicorn[standard]==0.34.0"

COPY server /app/server
COPY deploy/docker/preload.tex /app/deploy/docker/preload.tex

# Prime the Tectonic package cache at build time with common preamble packages
# used by docs/examples/master_resume.tex (article class, geometry, hyperref,
# titlesec, etc.). First run at runtime without this step would stall while
# TeX Live packages download. `|| true` keeps the build resilient if the
# package mirror is temporarily unavailable — runtime can still download.
RUN tectonic --chatter minimal /app/deploy/docker/preload.tex || true

WORKDIR /app/server

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/healthz').read()" || exit 1

CMD ["uvicorn", "runner.app:app", "--host", "0.0.0.0", "--port", "8080"]

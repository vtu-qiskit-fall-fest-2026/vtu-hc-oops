# QAOA service image. Built by Hugging Face Spaces (sdk: docker, see README.md), or locally:
#   docker build -t loadsetu-quantum quantum && docker run -p 7860:7860 loadsetu-quantum
FROM python:3.12-slim

# Spaces run the container as uid 1000; match it so pip's user installs are on PATH.
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH" PYTHONUNBUFFERED=1
WORKDIR /home/user/app

COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

COPY --chown=user qlogistics ./qlogistics
RUN mkdir -p results

# Spaces route traffic to 7860; other hosts (Railway, Render) inject PORT.
EXPOSE 7860
CMD ["sh", "-c", "uvicorn qlogistics.service:app --host 0.0.0.0 --port ${PORT:-7860}"]

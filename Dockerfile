FROM oven/bun

ADD . /app
WORKDIR /app
RUN bun install

CMD ["bun", "--production", "run", "src/index.ts"]
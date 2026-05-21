FROM node:22.14.0

RUN mkdir -p /app
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn && yarn cache clean
ADD ./ /app

# Copy template .hbs after build — don't fail if none
RUN mkdir -p dist/modules/templates && \
    (cp -r src/modules/templates/* dist/modules/templates/ 2>/dev/null || true)

CMD ["yarn","start"]

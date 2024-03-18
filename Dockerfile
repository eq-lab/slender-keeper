FROM node:20-slim as build
WORKDIR /build
COPY . .
RUN yarn install --frozen-lockfile
RUN yarn build

FROM node:20-slim
WORKDIR /app
COPY --from=build ["/build/node_modules", "node_modules/"]
COPY --from=build ["/build/dist", "dist/"]
COPY --from=build ["/build/package.json", "./"]
CMD ["yarn", "start"]

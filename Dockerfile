FROM node:18-slim as nodemodules

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 100000

FROM node:18-slim as build

WORKDIR /app

COPY --from=nodemodules /app/node_modules /app/node_modules
COPY . ./

RUN yarn build
RUN yarn build example_provider

FROM node:18-slim as runtime

WORKDIR /app

COPY --from=nodemodules /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist

COPY . .

CMD ["bash"]


# Heroku uses this configuration.

# This includes Yarn 1.3.2
FROM node:8.9.4
# docker-node overrides npm's loglevel setting to info. This reverts that.
# https://github.com/nodejs/docker-node/tree/d3ca6d89aefc1cd354819d85d9e1a91f773e7839#dockerfile
ENV NPM_CONFIG_LOGLEVEL notice
ADD . /app
WORKDIR /app
RUN yarn
# Run the app. CMD is required to run on Heroku.
CMD npm run --silent start

FROM alpine:3.17

WORKDIR /asset

ARG HANDLER
ARG HANDLER_ENVIRONMENT=$HANDLER_ENVIRONMENT


COPY .deploy-config/jooycar-file-reader/${HANDLER}/"${HANDLER_ENVIRONMENT}" ./config/
COPY package.json ./
COPY index.js ./
COPY package.json ./
COPY src/handlers/"${HANDLER}"/ ./src/handlers/"${HANDLER}"/
COPY src/utilities/ ./src/utilities/

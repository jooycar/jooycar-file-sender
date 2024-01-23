FROM alpine:3.17

WORKDIR /asset

ARG HANDLER

COPY deploy-config/jooycar-file-reader/${HANDLER}/ ./config/
COPY package.json ./
COPY index.js ./
COPY package.json ./
COPY src/handlers/"${HANDLER}"/ ./src/handlers/"${HANDLER}"/
COPY src/utilities/ ./src/utilities/
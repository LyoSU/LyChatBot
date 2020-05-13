FROM node:alpine

ENV NODE_WORKDIR /home/node/app

WORKDIR $NODE_WORKDIR
ADD . $NODE_WORKDIR
COPY ./helpers/tdlib/data/libtdjson /home/node/app/helpers/tdlib/data/

RUN npm install

CMD ["node", "index.js"]

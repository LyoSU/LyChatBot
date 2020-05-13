FROM node:alpine

ENV NODE_WORKDIR /home/node/app

WORKDIR $NODE_WORKDIR
ADD . $NODE_WORKDIR

RUN npm i --production

CMD ["node", "index.js"]

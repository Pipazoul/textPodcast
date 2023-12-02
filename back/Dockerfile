FROM node:lts-alpine as dev

WORKDIR /app/
COPY . .
RUN npm install

ENTRYPOINT [ "npm", "run", "dev" ]

FROM node:lts-alpine as prod

WORKDIR /app/
COPY . .
RUN npm install

RUN npm run build

RUN npm install pm2@latest -g

CMD [ "pm2", "start", "dist/index.js", "--no-daemon" ]

FROM node:22-slim

WORKDIR /usr/src/app

RUN apt-get update -y && apt-get install -y openssl

COPY package*.json ./

RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 5000

CMD ["npm", "start"]

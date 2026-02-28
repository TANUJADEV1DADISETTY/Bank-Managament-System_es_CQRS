FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE ${API_PORT}

CMD ["node", "src/server.js"]
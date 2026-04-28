FROM node:20-alpine

WORKDIR /app

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./

RUN npm install -g serve

EXPOSE 5173

CMD ["sh", "-c", "npm run build && serve -s dist -l 5173"]

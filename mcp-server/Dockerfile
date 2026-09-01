FROM mcr.microsoft.com/playwright:v1.62.1-noble
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY cloud-server.mjs ./
ENV PORT=8080
EXPOSE 8080
CMD ["node", "cloud-server.mjs"]

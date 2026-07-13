FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY gateway.js .
USER node
EXPOSE 20080
CMD ["node", "gateway.js"]

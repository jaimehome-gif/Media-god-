FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund
COPY server.mjs socialOAuth.mjs support.mjs socialOAuth.test.mjs deviceLogin.test.mjs ./
# Fail release build if provider OAuth, device pairing or anti-takeover checks regress.
RUN npm run check && node --test socialOAuth.test.mjs deviceLogin.test.mjs
EXPOSE 4000
CMD ["node", "server.mjs"]

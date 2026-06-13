FROM ghcr.io/puppeteer/puppeteer:23.0.0

# রুট ইউজার হিসেবে ডকার কনফিগার করা যাতে পারমিশন এরর না আসে
USER root

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# স্যান্ডবক্স ডিজেবল করে ক্রোমিয়াম রান করার কমান্ড
CMD ["node", "server.js"]

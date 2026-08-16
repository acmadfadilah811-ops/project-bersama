FROM alpine:3.20

RUN apk add --no-cache postgresql16-client rclone bash gzip tzdata dcron

WORKDIR /app
COPY backup.sh /app/backup.sh
COPY crontab /etc/crontabs/root
RUN chmod +x /app/backup.sh

CMD ["crond", "-f", "-d", "8"]

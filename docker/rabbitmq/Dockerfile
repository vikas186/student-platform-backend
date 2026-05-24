# Enroll platform — RabbitMQ for university scraping queues
FROM rabbitmq:3.13-management-alpine

LABEL org.opencontainers.image.title="enroll-rabbitmq"
LABEL org.opencontainers.image.description="RabbitMQ with management UI for university_scraping_queue"

# management + prometheus plugins are available; management is enabled in this base image
RUN rabbitmq-plugins enable --offline rabbitmq_management

COPY rabbitmq.conf /etc/rabbitmq/rabbitmq.conf

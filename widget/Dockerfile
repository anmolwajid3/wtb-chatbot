# Static visitor chat — deploy from the widget/ folder:
#   cd widget && fly launch --copy-config --name opas-widget
#   fly deploy
#
# Before deploy, set your live API host in config.js (see DEPLOY.md).

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html opas.png config.js /usr/share/nginx/html/
EXPOSE 8080

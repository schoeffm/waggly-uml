FROM node:wheezy
MAINTAINER Stefan Schoefmann, <stefan.schoeffmann@posteo.de>

ENV LAST_UPDATED 2015-05-17

RUN apt-get update && apt-get install -y librsvg2-bin graphviz fonts-tlwg-purisa vim git
RUN npm install wuml -g

ENTRYPOINT ["wuml"]
CMD ["-w", "-p" "--fontFamily", "Purisa"]

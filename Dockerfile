FROM node:9
MAINTAINER Stefan Schoefmann, <stefan.schoeffmann@posteo.de>

ENV LAST_UPDATED 2019-08-02

RUN apt-get update && apt-get install -y librsvg2-bin graphviz fonts-tlwg-purisa plotutils vim git

WORKDIR /wuml
ADD . /wuml

RUN npm install

ENTRYPOINT ["bin/wuml"]
FROM node:wheezy
MAINTAINER Stefan Schoefmann, <stefan.schoeffmann@posteo.de>

RUN apt-get update && apt-get install -y librsvg2-bin graphviz fonts-tlwg-purisa
RUN npm install wuml -g

ENTRYPOINT ["wuml"]
CMD ["-w", "-p" "--fontFamily", "Purisa"]

#!/usr/bin/env bash

docker build -t de.schoeffm/wuml .
docker run --rm -ti -v $(pwd):/data schoeffm/wuml
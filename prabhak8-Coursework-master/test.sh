#!/usr/bin/env bash

node index.js&
npm run test
kill %1

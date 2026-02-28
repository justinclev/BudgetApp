#!/bin/bash
set -e

(cd apps/dashboard && npm run build)
(cd apps/budget && npm run build)
(cd apps/list && npm run build)

mkdir -p dist/budget dist/list
cp -r apps/dashboard/dist/dashboard/browser/. dist/
cp -r apps/budget/dist/budget/browser/. dist/budget/
cp -r apps/list/dist/list/browser/. dist/list/

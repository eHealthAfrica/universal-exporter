#!/usr/bin/env bash
set -e

SILENT='--output /dev/null --silent '

[ -z "$COUCH_HOST" ] && COUCH_HOST="http://127.0.0.1:5984"
[ -z "$ES_HOST" ] && ES_HOST="http://127.0.0.1:9200"

echo "Populating elasticsearch..."
curl $SILENT -XPUT $ES_HOST/shakespeare -d @test/fixtures/shakespeare-index.json
curl $SILENT -XPUT $ES_HOST/_bulk --data-binary @test/fixtures/shakespeare.json

echo "Populating couchdb..."

curl $SILENT -H 'Content-Type: application/json' -X PUT $COUCH_HOST/test
curl $SILENT -H 'Content-Type: application/json' -X POST $COUCH_HOST/test/_bulk_docs -d @test/fixtures/shakespeare-couch.json
curl $SILENT -H 'Content-Type: application/json' -X PUT $COUCH_HOST/test/_design/test -d @test/fixtures/shakespeare-view.json

echo "Ready."
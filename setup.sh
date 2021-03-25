#!/usr/bin/env bash

# Clean up any old certs
if [ -d "./backend/certs" ]; then
  rm -rf ./backend/certs
fi

echo > ./backend/.env

CLUSTER_API_URL=`oc get infrastructure cluster -o jsonpath={.status.apiServerURL}`
echo CLUSTER_API_URL=$CLUSTER_API_URL >> ./backend/.env

OAUTH2_CLIENT_ID=multicloudingress
echo OAUTH2_CLIENT_ID=$OAUTH2_CLIENT_ID >> ./backend/.env

OAUTH2_CLIENT_SECRET=multicloudingresssecret
echo OAUTH2_CLIENT_SECRET=$OAUTH2_CLIENT_SECRET >> ./backend/.env

OAUTH2_REDIRECT_URL=http://localhost:4000/login/callback
echo OAUTH2_REDIRECT_URL=$OAUTH2_REDIRECT_URL >> ./backend/.env

BACKEND_URL=http://localhost:4000
echo BACKEND_URL=$BACKEND_URL >> ./backend/.env

FRONTEND_URL=http://localhost:3000
echo FRONTEND_URL=$FRONTEND_URL >> ./backend/.env

REDIRECT_URIS=$(oc get OAuthClient $OAUTH2_CLIENT_ID -o json | jq -c "[.redirectURIs[], \"$OAUTH2_REDIRECT_URL\"] | unique")
oc patch OAuthClient multicloudingress --type json -p "[{\"op\": \"add\", \"path\": \"/redirectURIs\", \"value\": ${REDIRECT_URIS}}]"

# Create route to the search-api service on the target cluster.
oc create route passthrough search-api --service=search-search-api --insecure-policy=Redirect -n open-cluster-management
SEARCH_API_URL=https://$(oc get route search-api -n open-cluster-management |grep search-api | awk '{print $2}')
echo SEARCH_API_URL=$SEARCH_API_URL >> ./backend/.env

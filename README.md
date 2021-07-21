[comment]: # ( Copyright Contributors to the Open Cluster Management project )

# @open-cluster-management/console

[![License](https://img.shields.io/:license-apache-blue.svg)](http://www.apache.org/licenses/LICENSE-2.0.html)
[![Build](https://img.shields.io/badge/build-Prow-informational)](https://prow.ci.openshift.org/?repo=open-cluster-management%2Fconsole)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=open-cluster-management_console&metric=coverage&token=678092fc6e15fad203b8883681417cca4c477c6b)](https://sonarcloud.io/dashboard?id=open-cluster-management_console)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=open-cluster-management_console&metric=sqale_rating&token=678092fc6e15fad203b8883681417cca4c477c6b)](https://sonarcloud.io/dashboard?id=open-cluster-management_console)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=open-cluster-management_console&metric=security_rating&token=678092fc6e15fad203b8883681417cca4c477c6b)](https://sonarcloud.io/dashboard?id=open-cluster-management_console)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=open-cluster-management_console&metric=vulnerabilities&token=678092fc6e15fad203b8883681417cca4c477c6b)](https://sonarcloud.io/dashboard?id=open-cluster-management_console)


## What is console?

The console provides a user interface for cluster related items such as:
- Credentials management (For example, Cloud Providers)
- Cluster management
  - Creating
  - Importing
  - Upgrading
  - Detaching
  - Destroying

Go to the [Contributing guide](CONTRIBUTING.md) to learn how to get involved.

## Prerequisites

- Node.js v14.x

## Running

1. Clone repository

2. Install dependencies

   ```
   npm ci
   ```

3. Setup environment

   You need:
   - to be connected to a OpenShift 4.x.x cluster
   - to have Advanced Cluster Management installed on the cluster

   ```
   npm run setup
   ```

   This will create a `.env` file in the backend directory containing the environment variables.

4. Start the development services

   ```
   npm start
   ```

   This will start the frontend and the backend in parallel.  (It may take up to 30 seconds for the UI to appear)

   The frontend will proxy requests to the backend using react scripts.

   The backend will proxy requests to the kubernetes cluster specified by CLUSTER_API_URL in backend/.env.

## Backend

| Method | Path     | Description                                      |
| -----: | -------- | ------------------------------------------------ |
|    ALL | /api     | Proxy request to cluster /api                    |
|    ALL | /apis    | Proxy request to cluster /apis                   |
|    GET | /watch   | Server side event stream of kubernetes resources |
|   POST | /upgrade | Upgrade a cluster                                |

### Proxy Routes

The backend proxies api calls to the kubernetes cluster api.
Proxy calls will use the clients api token stored in `openshift-session-token` cookie.
This enforces user RBAC for proxy calls.

### Watch Route

The backend `/watch` route streams resource changes using [server side events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).

## Frontend

The frontend is using react scripts to simplify dependencies.
The react scripts internally handle all the webpacking of the frontend.
The goal here is fewer dependencies of the frontend.

### Chrome

To develop with self signed certificates goto `chrome://flags/`and enable

- Allow invalid certificates for resources loaded from localhost.
- Insecure origins treated as secure.
  - http://localhost

### Authentication

Frontend has a cookie `openshift-session-token` that contains the user's token.

If the backend responds with a `401 Unauthorized` the frontend starts an OAuth flow to authorize with the cluster.

1. Frontend redirects to the backend `/login` endpoint.
2. Backend redirects to the cluster `/authorize` endpoint.
3. Cluster OAuth redirects back to the backend `/login/callback` endpoint.
4. Backend redirects to the frontend and sets the `openshift-session-token`.

## Optional Features

In some cases there are development preview (Dev Preview) features or technical preview (Tech Preview) features that can optionally be enabled and used in the product.  These features are enabled using a FeatureGate CR.  The following features are available:

### Single node OpenShift

Enabling this feature will allow the user to create a cluster that only contains a single master node.  This option is only available for providers AWS, Azure, GCP, OpenStack and VMware when the OpenShift release image is version 4.8 or higher.

To enable this feature, `oc apply -f features/single-node-openshift.yaml`.  

## References
`console` is part of the open-cluster-management community. For more information, visit: [open-cluster-management.io](https://open-cluster-management.io)

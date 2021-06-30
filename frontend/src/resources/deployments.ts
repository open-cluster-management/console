/* Copyright Contributors to the Open Cluster Management project */

import { V1ObjectMeta } from '@kubernetes/client-node/dist/gen/model/v1ObjectMeta'
import { IResourceDefinition } from './resource'

export const DeploymentApiVersion = 'apps/v1'
export type DeploymentApiVersionType = 'apps/v1'

export const DeploymentKind = 'Deployment'
export type DeploymentKindType = 'Deployment'

export const DeploymentDefinition: IResourceDefinition = {
    apiVersion: DeploymentApiVersion,
    kind: DeploymentKind,
}

export interface Deployment {
    apiVersion: DeploymentApiVersionType
    kind: DeploymentKindType
    metadata: V1ObjectMeta

}
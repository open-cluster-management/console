/* Copyright Contributors to the Open Cluster Management project */

import { V1ObjectMeta } from '@kubernetes/client-node/dist/gen/model/v1ObjectMeta'
import { V1Secret } from '@kubernetes/client-node/dist/gen/model/v1Secret'
import { keyBy } from 'lodash'
import { createResource, deleteResource, getResource, IRequestResult, listResources } from '../lib/resource-request'
import { createProject } from '../resources/project'
import { IResourceDefinition } from './resource'
import { SecretApiVersionType, SecretKindType } from './secret'

export const BareMetalAssetApiVersion = 'inventory.open-cluster-management.io/v1alpha1'
export type BareMetalAssetApiVersionType = 'inventory.open-cluster-management.io/v1alpha1'

export const BareMetalAssetKind = 'BareMetalAsset'
export type BareMetalAssetKindType = 'BareMetalAsset'

export const BareMetalAssetDefinition: IResourceDefinition = {
    apiVersion: BareMetalAssetApiVersion,
    kind: BareMetalAssetKind,
}

export interface BareMetalAsset {
    apiVersion: BareMetalAssetApiVersionType
    kind: BareMetalAssetKindType
    metadata: V1ObjectMeta
    spec?: {
        bmc: {
            address: string
            credentialsName: string
        }
        bootMACAddress: string
        role?: string
    }
    status?: {
        conditions: Array<{
            lastTransitionTime: Date
            message: string
            reason: string
            status: string
            type: string
        }>
    }
}

export interface BMASecret extends V1Secret {
    apiVersion: SecretApiVersionType
    kind: SecretKindType
    metadata: V1ObjectMeta
    stringData: {
        password: string
        username: string
    }
}
export interface ImportedBareMetalAsset {
    name: string
    namespace: string
    bootMACAddress: string
    role: string
    uid: string
    bmc: {
        address: string
        username: string
        password: string
    }
}

export enum BareMetalAssetConditionReasons {
    SecretNotFound = 'SecretNotFound',
    SecretFound = 'SecretFound',
    NoneSpecified = 'NoneSpecified',
    ClusterDeploymentNotFound = 'ClusterDeploymentNotFound',
    ClusterDeploymentFound = 'ClusterDeploymentFound',
    SyncSetCreationFailed = 'SyncSetCreationFailed',
    SyncSetCreated = 'SyncSetCreated',
    SyncSetGetFailed = 'SyncSetGetFailed',
    SyncSetUpdateFailed = 'SyncSetUpdateFailed',
    SyncSetUpdated = 'SyncSetUpdated',
    SyncStatusNotFound = 'SyncStatusNotFound',
    SyncSetNotApplied = 'SyncSetNotApplied',
    SyncSetAppliedSuccessful = 'SyncSetAppliedSuccessful',
    SyncSetAppliedFailed = 'SyncSetAppliedFailed',
    UnexpectedResourceCount = 'UnexpectedResourceCount',
}

export enum BareMetalAssetConditionTypes {
    ConditionCredentialsFound = 'CredentialsFound',
    ConditionAssetSyncStarted = 'AssetSyncStarted',
    ConditionClusterDeploymentFound = 'ClusterDeploymentFound',
    ConditionAssetSyncCompleted = 'AssetSyncCompleted',
}

export function getBareMetalAsset(metadata: Object) {
    return getResource<BareMetalAsset>({
        kind: BareMetalAssetKind,
        apiVersion: BareMetalAssetApiVersion,
        metadata,
    })
}

export function listBareMetalAssets() {
    const result = listResources<BareMetalAsset>({
        apiVersion: BareMetalAssetApiVersion,
        kind: BareMetalAssetKind,
    })
    return {
        promise: result.promise.then((bareMetalAssets) => {
            return bareMetalAssets
        }),
        abort: result.abort,
    }
}

export function createBareMetalAssetNamespaces(assets: ImportedBareMetalAsset[]) {
    const namespaces = Object.keys(keyBy(assets, 'namespace'))
    const results = namespaces.map((namespace) => createProject(namespace))
    return Promise.allSettled(results.map((result) => result.promise))
}

export function importBareMetalAsset(asset: ImportedBareMetalAsset): IRequestResult {
    return {
        promise: new Promise(async (resolve, reject) => {
            try {
                await createBareMetalAssetSecret(asset).promise
            } catch (err) {
                reject(err)
                return
            }
            try {
                await createBareMetalAssetResource(asset).promise
                resolve({})
            } catch (err) {
                const { name, namespace } = asset
                deleteResource({
                    apiVersion: 'v1',
                    kind: 'Secret',
                    metadata: {
                        name: `${name}-bmc-secret`,
                        namespace,
                    },
                })
                reject(err)
            }
        }),
        abort: () => {},
    }
}

export function createBareMetalAssetResource(asset: {
    name: string
    namespace: string
    bootMACAddress: string
    role: string
    bmc: { address: string }
}) {
    const {
        name,
        namespace,
        bootMACAddress,
        role,
        bmc: { address },
    } = asset
    const credentialsName = `${name}-bmc-secret`
    return createResource<BareMetalAsset>({
        apiVersion: BareMetalAssetApiVersion,
        kind: BareMetalAssetKind,
        metadata: {
            name,
            namespace,
        },
        spec: {
            bmc: {
                address,
                credentialsName: credentialsName,
            },
            bootMACAddress,
            role,
        },
    })
}

export function createBareMetalAssetSecret(asset: {
    name: string
    namespace: string
    bmc: { username: string; password: string }
}) {
    const {
        name,
        namespace,
        bmc: { username, password },
    } = asset
    const credentialsName = `${name}-bmc-secret`
    const resolved: IRequestResult = {
        promise: Promise.resolve(),
        abort: () => {},
    }
    return !username
        ? resolved
        : createResource<BMASecret>({
              apiVersion: 'v1',
              kind: 'Secret',
              metadata: {
                  name: credentialsName,
                  namespace,
              },
              stringData: {
                  password,
                  username,
              },
          })
}

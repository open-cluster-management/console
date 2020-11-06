import { V1ObjectMeta } from '@kubernetes/client-node'
import { IResource } from '../library/resources/resource'
import { resourceMethods } from '../library/utils/resource-methods'
import { ClusterLabels } from './ManagedCluster'

export const KlusterletAddonConfigApiVersion = 'agent.open-cluster-management.io/v1'
export type KlusterletAddonConfigApiVersionType = 'agent.open-cluster-management.io/v1'

export const KlusterletAddonConfigKind = 'KlusterletAddonConfig'
export type KlusterletAddonConfigKindType = 'KlusterletAddonConfig'

export interface KlusterletAddonConfig extends IResource {
    apiVersion: KlusterletAddonConfigApiVersionType
    kind: KlusterletAddonConfigKindType
    metadata: V1ObjectMeta
    spec: {
        clusterName: string
        clusterNamespace: string
        clusterLabels: ClusterLabels
        applicationManager: { enabled: boolean }
        policyController: { enabled: boolean }
        searchCollector: { enabled: boolean }
        certPolicyController: { enabled: boolean }
        iamPolicyController: { enabled: boolean }
        version: string
    }
}

export const klusterletAddonConfigMethodss = resourceMethods<KlusterletAddonConfig>({
    apiVersion: KlusterletAddonConfigApiVersion,
    kind: KlusterletAddonConfigKind,
})

export const createKlusterletAddonConfig = (data: {
    clusterName: string | undefined
    clusterLabels: ClusterLabels
}) => {
    if (!data.clusterName) throw new Error('Cluster name not set')
    return klusterletAddonConfigMethodss.create({
        apiVersion: KlusterletAddonConfigApiVersion,
        kind: KlusterletAddonConfigKind,
        metadata: { name: data.clusterName, namespace: data.clusterName },
        spec: {
            clusterName: data.clusterName,
            clusterNamespace: data.clusterName,
            clusterLabels: { ...data.clusterLabels },
            applicationManager: { enabled: true },
            policyController: { enabled: true },
            searchCollector: { enabled: true },
            certPolicyController: { enabled: true },
            iamPolicyController: { enabled: true },
            version: '2.1.0',
        },
    })
}

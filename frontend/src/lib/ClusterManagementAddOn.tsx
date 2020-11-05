import { V1ObjectMeta } from '@kubernetes/client-node'
import { IResource, ResourceList, resourceMethods, QueryWrapper } from './Resource'

export interface ClusterManagementAddOn extends IResource {
    apiVersion: string
    kind: 'ClusterManagementAddOn'
    metadata: V1ObjectMeta
    spec: {
        addOnMeta: {
            displayName: string
            description: string
        }
        addOnConfiguration: {
            crdName: string
            crName: string
        }
    }
}

export const clusterManagementAddOnMethods = resourceMethods<ClusterManagementAddOn>({
    path: '/apis/addon.open-cluster-management.io/v1alpha1',
    plural: 'clustermanagementaddons',
})

export function QueryClusterManagementAddons() {
    return QueryWrapper<ResourceList<ClusterManagementAddOn>>(clusterManagementAddOnMethods.listCluster)
}

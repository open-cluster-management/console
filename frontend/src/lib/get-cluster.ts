import { V1CustomResourceDefinitionCondition } from '@kubernetes/client-node'
import { getClusterDeployment, listClusterDeployments, ClusterDeployment } from '../resources/cluster-deployment'
import {
    getManagedClusterInfo,
    listMCIs,
    ManagedClusterInfo,
    NodeInfo,
    OpenShiftDistributionInfo,
} from '../resources/managed-cluster-info'
import { ManagedCluster, listManagedClusters, getManagedCluster } from '../resources/managed-cluster'
import {
    listCertificateSigningRequests,
    CertificateSigningRequest,
    CSR_CLUSTER_LABEL,
} from '../resources/certificate-signing-requests'
import { IRequestResult } from './resource-request'
import { getLatest } from './utils'
import { Provider } from '@open-cluster-management/ui-components'

export enum ClusterStatus {
    'pending' = 'pending',
    'destroying' = 'destroying',
    'creating' = 'creating',
    'failed' = 'failed',
    'detached' = 'detached',
    'detaching' = 'detaching',
    'notaccepted' = 'notaccepted',
    'needsapproval' = 'needsapproval',
    'pendingimport' = 'pendingimport',
    'ready' = 'ready',
    'offline' = 'offline',
}

export type Cluster = {
    name: string | undefined
    namespace: string | undefined
    status: ClusterStatus
    provider: Provider | undefined
    distribution: DistributionInfo | undefined
    labels: Record<string, string> | undefined
    nodes: Nodes | undefined
    kubeApiServer: string | undefined
    consoleURL: string | undefined
    hiveSecrets: HiveSecrets | undefined
    isHive: boolean
    isManaged: boolean
}

export type DistributionInfo = {
    k8sVersion: string | undefined
    ocp: OpenShiftDistributionInfo | undefined
    displayVersion: string | undefined
}

export type HiveSecrets = {
    kubeconfig: string | undefined
    kubeadmin: string | undefined
    installConfig: string | undefined
}

export type Nodes = {
    active: number
    inactive: number
    nodeList: NodeInfo[]
}

export function getSingleCluster(
    namespace: string,
    name: string
): IRequestResult<
    PromiseSettledResult<ClusterDeployment | ManagedClusterInfo | CertificateSigningRequest[] | ManagedCluster>[]
> {
    const results = [
        getClusterDeployment(namespace, name),
        getManagedClusterInfo(namespace, name),
        listCertificateSigningRequests(name),
        getManagedCluster(name),
    ]

    return {
        promise: Promise.allSettled(results.map((result) => result.promise)),
        abort: () => results.forEach((result) => result.abort()),
    }
}

export function getAllClusters(): IRequestResult<Cluster[]> {
    const results = [listClusterDeployments(), listMCIs(), listCertificateSigningRequests(), listManagedClusters()]
    return {
        promise: Promise.allSettled(results.map((result) => result.promise)).then((results) => {
            const items = results.map((d, i) => {
                if (d.status === 'fulfilled') {
                    return d.value
                } else {
                    if (d.reason instanceof Error) {
                        throw d.reason
                    }
                    return []
                }
            })
            return mapClusters(
                items[0] as ClusterDeployment[],
                items[1] as ManagedClusterInfo[],
                items[2] as CertificateSigningRequest[],
                items[3] as ManagedCluster[]
            )
        }),
        abort: () => results.forEach((result) => result.abort()),
    }
}

export function mapClusters(
    clusterDeployments: ClusterDeployment[] = [],
    managedClusterInfos: ManagedClusterInfo[] = [],
    certificateSigningRequests: CertificateSigningRequest[] = [],
    managedClusters: ManagedCluster[] = []
) {
    const uniqueClusterNames = Array.from(
        new Set([
            ...clusterDeployments.map((cd) => cd.metadata.name),
            ...managedClusterInfos.map((mc) => mc.metadata.name),
            ...managedClusters.filter((mc) => mc.metadata.name),
        ])
    )
    return uniqueClusterNames.map((cluster) => {
        const clusterDeployment = clusterDeployments?.find((cd) => cd.metadata?.name === cluster)
        const managedClusterInfo = managedClusterInfos?.find((mc) => mc.metadata?.name === cluster)
        const managedCluster = managedClusters?.find((mc) => mc.metadata?.name === cluster)
        return getCluster(managedClusterInfo, clusterDeployment, certificateSigningRequests, managedCluster)
    })
}

export function getCluster(
    managedClusterInfo: ManagedClusterInfo | undefined,
    clusterDeployment: ClusterDeployment | undefined,
    certificateSigningRequests: CertificateSigningRequest[] | undefined,
    managedCluster: ManagedCluster | undefined
): Cluster {
    return {
        name: clusterDeployment?.metadata.name ?? managedCluster?.metadata.name ?? managedClusterInfo?.metadata.name,
        namespace: clusterDeployment?.metadata.namespace ?? managedClusterInfo?.metadata.namespace,
        status: getClusterStatus(clusterDeployment, managedClusterInfo, certificateSigningRequests, managedCluster),
        provider: getProvider(managedClusterInfo, managedCluster, clusterDeployment),
        distribution: getDistributionInfo(managedClusterInfo, managedCluster),
        labels: managedCluster?.metadata.labels ?? managedClusterInfo?.metadata.labels,
        nodes: getNodes(managedClusterInfo),
        kubeApiServer: getKubeApiServer(clusterDeployment, managedClusterInfo),
        consoleURL: getConsoleUrl(clusterDeployment, managedClusterInfo, managedCluster),
        hiveSecrets: getHiveSecrets(clusterDeployment),
        isHive: !!clusterDeployment,
        isManaged: !!managedCluster || !!managedClusterInfo,
    }
}

export function getProvider(
    managedClusterInfo?: ManagedClusterInfo,
    managedCluster?: ManagedCluster,
    clusterDeployment?: ClusterDeployment
) {
    const cloudLabel = managedClusterInfo?.metadata?.labels?.['cloud']
    const platformClusterClaim = managedCluster?.status?.clusterClaims?.find(
        (claim) => claim.name === 'platform.open-cluster-management.io'
    )
    const hivePlatformLabel = clusterDeployment?.metadata?.labels?.['hive.openshift.io/cluster-platform']

    if (!cloudLabel && !platformClusterClaim && !hivePlatformLabel) {
        return undefined
    }

    let providerLabel =
        hivePlatformLabel && hivePlatformLabel !== 'unknown'
            ? hivePlatformLabel
            : platformClusterClaim?.value ?? cloudLabel

    let provider: Provider | undefined
    switch (providerLabel) {
        case 'Amazon':
        case 'AWS':
        case 'aws':
            provider = Provider.aws
            break
        case 'Google':
        case 'GCP':
        case 'GCE':
        case 'gcp':
            provider = Provider.gcp
            break
        case 'Azure':
        case 'azure':
            provider = Provider.azure
            break
        case 'IBM':
            provider = Provider.ibm
            break
        case 'baremetal':
            provider = Provider.baremetal
            break
        case 'vsphere':
            provider = Provider.vmware
            break
        case 'auto-detect':
            provider = undefined
            break
        case 'other':
        default:
            provider = Provider.other
    }
    return provider
}

export function getDistributionInfo(
    managedClusterInfo: ManagedClusterInfo | undefined,
    managedCluster: ManagedCluster | undefined
) {
    let k8sVersion: string | undefined
    let ocp: OpenShiftDistributionInfo | undefined
    let displayVersion: string | undefined

    if (managedCluster) {
        let k8sVersionClaim = managedCluster.status?.clusterClaims?.find(
            (cc) => cc.name === 'kubeversion.open-cluster-management.io'
        )
        if (k8sVersionClaim) k8sVersion = k8sVersionClaim.value
        let versionClaim = managedCluster.status?.clusterClaims?.find((cc) => cc.name === 'version.openshift.io')
        if (versionClaim) displayVersion = `OpenShift ${versionClaim.value}`
    }

    if (managedClusterInfo) {
        k8sVersion = managedClusterInfo.status?.version
        ocp = managedClusterInfo.status?.distributionInfo?.ocp
        if (displayVersion === undefined) {
            displayVersion = ocp?.version ? `OpenShift ${ocp.version}` : k8sVersion
        }
    }

    if (k8sVersion && ocp && displayVersion) {
        return { k8sVersion, ocp, displayVersion }
    }

    return undefined
}

export function getKubeApiServer(
    clusterDeployment: ClusterDeployment | undefined,
    managedClusterInfo: ManagedClusterInfo | undefined
) {
    return clusterDeployment?.status?.apiURL ?? managedClusterInfo?.spec?.masterEndpoint
}

export function getConsoleUrl(
    clusterDeployment: ClusterDeployment | undefined,
    managedClusterInfo: ManagedClusterInfo | undefined,
    managedCluster: ManagedCluster | undefined
) {
    let consoleUrlClaim = managedCluster?.status?.clusterClaims?.find(
        (cc) => cc.name === 'consoleurl.cluster.open-cluster-management.io'
    )
    if (consoleUrlClaim) return consoleUrlClaim.value
    return clusterDeployment?.status?.webConsoleURL ?? managedClusterInfo?.status?.consoleURL
}

export function getNodes(managedClusterInfo: ManagedClusterInfo | undefined) {
    if (!managedClusterInfo) return undefined

    const nodeList: NodeInfo[] = managedClusterInfo.status?.nodeList ?? []
    let active = 0
    let inactive = 0

    nodeList.forEach((node: NodeInfo) => {
        const readyCondition = node.conditions?.find((condition) => condition.type === 'Ready')
        readyCondition?.status === 'True' ? active++ : inactive++
    })
    return { nodeList, active, inactive }
}

export function getHiveSecrets(clusterDeployment: ClusterDeployment | undefined) {
    if (!clusterDeployment) return undefined
    return {
        kubeconfig: clusterDeployment.spec?.clusterMetadata?.adminKubeconfigSecretRef.name,
        kubeadmin: clusterDeployment.spec?.clusterMetadata?.adminPasswordSecretRef.name,
        installConfig: clusterDeployment.spec?.provisioning.installConfigSecretRef.name,
    }
}

export function getClusterStatus(
    clusterDeployment: ClusterDeployment | undefined,
    managedClusterInfo: ManagedClusterInfo | undefined,
    certificateSigningRequests: CertificateSigningRequest[] | undefined,
    managedCluster: ManagedCluster | undefined
) {
    const checkForCondition = (condition: string, conditions: V1CustomResourceDefinitionCondition[]) =>
        conditions.find((c) => c.type === condition)?.status === 'True'

    // ClusterDeployment status
    let cdStatus = ClusterStatus.pending
    if (clusterDeployment) {
        const cdConditions: V1CustomResourceDefinitionCondition[] = clusterDeployment?.status?.conditions ?? []
        const provisionFailed = checkForCondition('ProvisionFailed', cdConditions)
        const provisionLaunchError = checkForCondition('InstallLaunchError', cdConditions)
        const deprovisionLaunchError = checkForCondition('DeprovisionLaunchError', cdConditions)

        // deprovisioning
        if (clusterDeployment.metadata.deletionTimestamp) {
            cdStatus = ClusterStatus.destroying

            // provision/deprovision failure
        } else if (provisionLaunchError || deprovisionLaunchError) {
            cdStatus = ClusterStatus.failed

            // provision success
        } else if (clusterDeployment.spec?.installed) {
            cdStatus = ClusterStatus.detached

            // provisioning - default
        } else if (!clusterDeployment.spec?.installed) {
            if (provisionFailed) {
                const provisionFailedCondition = cdConditions.find((c) => c.type === 'ProvisionFailed')
                const currentProvisionRef = clusterDeployment.status?.provisionRef?.name ?? ''
                if (provisionFailedCondition?.message?.includes(currentProvisionRef)) {
                    cdStatus = ClusterStatus.failed
                } else {
                    cdStatus = ClusterStatus.creating
                }
            } else {
                cdStatus = ClusterStatus.creating
            }
        }
    }

    // if mc doesn't exist, default to cd status
    if (!managedClusterInfo && !managedCluster) {
        return cdStatus
    }

    let mc = managedCluster ?? managedClusterInfo!

    // ManagedCluster status
    let mcStatus = ClusterStatus.pending
    const mcConditions: V1CustomResourceDefinitionCondition[] = mc.status?.conditions ?? []
    const clusterAccepted = checkForCondition('HubAcceptedManagedCluster', mcConditions)
    const clusterJoined = checkForCondition('ManagedClusterJoined', mcConditions)
    const clusterAvailable = checkForCondition('ManagedClusterConditionAvailable', mcConditions)

    // detaching
    if (mc.metadata.deletionTimestamp) {
        mcStatus = ClusterStatus.detaching

        // not accepted
    } else if (!clusterAccepted) {
        mcStatus = ClusterStatus.notaccepted

        // not joined
    } else if (!clusterJoined) {
        mcStatus = ClusterStatus.pendingimport

        // check for respective csrs awaiting approval
        if (certificateSigningRequests && certificateSigningRequests.length) {
            const clusterCsrs =
                certificateSigningRequests?.filter((csr) => {
                    return csr.metadata.labels?.[CSR_CLUSTER_LABEL] === mc.metadata.name
                }) ?? []
            const activeCsr = getLatest<CertificateSigningRequest>(clusterCsrs, 'metadata.creationTimestamp')
            mcStatus =
                activeCsr && !activeCsr?.status?.certificate ? ClusterStatus.needsapproval : ClusterStatus.pendingimport
        }
    } else {
        mcStatus = clusterAvailable ? ClusterStatus.ready : ClusterStatus.offline
    }

    // if ManagedCluster has not joined or is detaching, show ClusterDeployment status
    // as long as it is not 'detached' (which is the ready state when there is no attached ManagedCluster,
    // so this is the case is the cluster is being detached but not destroyed)
    if ((mcStatus === 'detaching' || !clusterJoined) && clusterDeployment && cdStatus !== 'detached') {
        return cdStatus
    } else {
        return mcStatus
    }
}

/* Copyright Contributors to the Open Cluster Management project */

import { V1CustomResourceDefinitionCondition } from '@kubernetes/client-node/dist/gen/model/v1CustomResourceDefinitionCondition'
import { Provider } from '@open-cluster-management/ui-components'
import { CertificateSigningRequest, CSR_CLUSTER_LABEL } from '../resources/certificate-signing-requests'
import { ClusterClaim } from '../resources/cluster-claim'
import { ClusterCurator } from '../resources/cluster-curator'
import { ClusterDeployment } from '../resources/cluster-deployment'
import { ManagedCluster } from '../resources/managed-cluster'
import { ManagedClusterAddOn } from '../resources/managed-cluster-add-on'
import { ManagedClusterInfo, NodeInfo, OpenShiftDistributionInfo } from '../resources/managed-cluster-info'
import { managedClusterSetLabel } from '../resources/managed-cluster-set'
import { AddonStatus } from './get-addons'
import { getLatest } from './utils'

export enum ClusterStatus {
    'pending' = 'pending',
    'destroying' = 'destroying',
    'creating' = 'creating',
    'provisionfailed' = 'provisionfailed',
    'deprovisionfailed' = 'deprovisionfailed',
    'failed' = 'failed',
    'detached' = 'detached',
    'detaching' = 'detaching',
    'notaccepted' = 'notaccepted',
    'needsapproval' = 'needsapproval',
    'pendingimport' = 'pendingimport',
    'importing' = 'importing',
    'ready' = 'ready',
    'offline' = 'offline',
    'hibernating' = 'hibernating',
    'stopping' = 'stopping',
    'resuming' = 'resuming',
    'degraded' = 'degraded',
    'unknown' = 'unknown',
    'prehookjob' = 'prehookjob',
    'prehookfailed' = 'prehookfailed',
    'posthookjob' = 'posthookjob',
    'posthookfailed' = 'posthookfailed',
    'importfailed' = 'importfailed',
}

export const clusterDangerStatuses = [
    ClusterStatus.provisionfailed,
    ClusterStatus.deprovisionfailed,
    ClusterStatus.failed,
    ClusterStatus.offline,
    ClusterStatus.degraded,
    ClusterStatus.notaccepted,
    ClusterStatus.prehookfailed,
    ClusterStatus.posthookfailed,
    ClusterStatus.importfailed,
]

export type Cluster = {
    name?: string
    displayName?: string
    namespace?: string
    status: ClusterStatus
    statusMessage?: string
    provider?: Provider
    distribution?: DistributionInfo
    labels?: Record<string, string>
    nodes?: Nodes
    kubeApiServer?: string
    consoleURL?: string
    hive: {
        clusterPool?: string
        clusterPoolNamespace?: string
        isHibernatable: boolean
        secrets?: HiveSecrets
        clusterClaimName?: string
        lifetime?: string
    }
    isHive: boolean
    isManaged: boolean
    isCurator: boolean
    clusterSet?: string
    owner: {
        createdBy?: string
        claimedBy?: string
    }
}

export type DistributionInfo = {
    k8sVersion?: string
    ocp?: OpenShiftDistributionInfo
    displayVersion?: string
    isManagedOpenShift: boolean
    upgradeInfo?: UpgradeInfo
}

export type HiveSecrets = {
    kubeconfig?: string
    kubeadmin?: string
    installConfig?: string
}

export type Nodes = {
    ready: number
    unhealthy: number
    unknown: number
    nodeList: NodeInfo[]
}

export type UpgradeInfo = {
    isUpgrading: boolean
    isReadyUpdates: boolean
    upgradePercentage: string
    upgradeFailed: boolean
    hooksInProgress: boolean
    hookFailed: boolean
    latestJob: {
        conditionMessage: string
        step: CuratorCondition | undefined
    }
    currentVersion?: string
    desiredVersion?: string
    availableUpdates: string[]
    isReadySelectChannels: boolean
    isSelectingChannel: boolean
    isUpgradeCuration: boolean
    currentChannel?: string
    desiredChannel?: string
    availableChannels: string[]
    prehooks: {
        hasHooks: boolean
        inProgress: boolean
        success: boolean
        failed: boolean
    }
    posthooks: {
        hasHooks: boolean
        inProgress: boolean
        success: boolean
        failed: boolean
    }
}

export function mapClusters(
    clusterDeployments: ClusterDeployment[] = [],
    managedClusterInfos: ManagedClusterInfo[] = [],
    certificateSigningRequests: CertificateSigningRequest[] = [],
    managedClusters: ManagedCluster[] = [],
    managedClusterAddOns: ManagedClusterAddOn[] = [],
    clusterClaims: ClusterClaim[] = [],
    clusterCurators: ClusterCurator[] = []
) {
    const mcs = managedClusters.filter((mc) => mc.metadata?.name) ?? []
    const uniqueClusterNames = Array.from(
        new Set([
            ...clusterDeployments.map((cd) => cd.metadata.name),
            ...managedClusterInfos.map((mc) => mc.metadata.name),
            ...mcs.map((mc) => mc.metadata.name),
        ])
    )
    return uniqueClusterNames.map((cluster) => {
        const clusterDeployment = clusterDeployments?.find((cd) => cd.metadata?.name === cluster)
        const managedClusterInfo = managedClusterInfos?.find((mc) => mc.metadata?.name === cluster)
        const managedCluster = managedClusters?.find((mc) => mc.metadata?.name === cluster)
        const addons = managedClusterAddOns.filter((mca) => mca.metadata.namespace === cluster)
        const clusterClaim = clusterClaims.find((clusterClaim) => clusterClaim.spec?.namespace === cluster)
        const clusterCurator = clusterCurators.find((cc) => cc.metadata.namespace === cluster)
        return getCluster(
            managedClusterInfo,
            clusterDeployment,
            certificateSigningRequests,
            managedCluster,
            addons,
            clusterClaim,
            clusterCurator
        )
    })
}

export function getCluster(
    managedClusterInfo: ManagedClusterInfo | undefined,
    clusterDeployment: ClusterDeployment | undefined,
    certificateSigningRequests: CertificateSigningRequest[] | undefined,
    managedCluster: ManagedCluster | undefined,
    managedClusterAddOns: ManagedClusterAddOn[],
    clusterClaim: ClusterClaim | undefined,
    clusterCurator: ClusterCurator | undefined
): Cluster {
    const { status, statusMessage } = getClusterStatus(
        clusterDeployment,
        managedClusterInfo,
        certificateSigningRequests,
        managedCluster,
        managedClusterAddOns,
        clusterCurator
    )
    return {
        name: clusterDeployment?.metadata.name ?? managedCluster?.metadata.name ?? managedClusterInfo?.metadata.name,
        displayName:
            // clusterDeployment?.spec?.clusterPoolRef?.claimName ??
            clusterDeployment?.metadata.name ?? managedCluster?.metadata.name ?? managedClusterInfo?.metadata.name,
        namespace:
            managedCluster?.metadata.name ??
            clusterDeployment?.metadata.namespace ??
            managedClusterInfo?.metadata.namespace,
        status,
        statusMessage,
        provider: getProvider(managedClusterInfo, managedCluster, clusterDeployment),
        distribution: getDistributionInfo(managedClusterInfo, managedCluster, clusterDeployment, clusterCurator),
        labels: managedCluster?.metadata.labels ?? managedClusterInfo?.metadata.labels,
        nodes: getNodes(managedClusterInfo),
        kubeApiServer: getKubeApiServer(clusterDeployment, managedClusterInfo),
        consoleURL: getConsoleUrl(clusterDeployment, managedClusterInfo, managedCluster),
        isHive: !!clusterDeployment,
        isManaged: !!managedCluster || !!managedClusterInfo,
        isCurator: !!clusterCurator,
        hive: getHiveConfig(clusterDeployment, clusterClaim),
        clusterSet:
            managedCluster?.metadata?.labels?.[managedClusterSetLabel] ||
            managedClusterInfo?.metadata?.labels?.[managedClusterSetLabel] ||
            clusterDeployment?.metadata?.labels?.[managedClusterSetLabel],
        owner: getOwner(clusterDeployment, clusterClaim),
    }
}

const checkForCondition = (condition: string, conditions: V1CustomResourceDefinitionCondition[], status?: string) =>
    conditions?.find((c) => c.type === condition)?.status === (status ?? 'True')

export const checkCuratorLatestOperation = (condition: string, conditions: V1CustomResourceDefinitionCondition[]) => {
    const cond = conditions?.find((c) => c.message?.includes(condition))
    return cond?.status === 'False' && cond.reason === 'Job_has_finished'
}

export const checkCuratorLatestFailedOperation = (
    condition: string,
    conditions: V1CustomResourceDefinitionCondition[]
) => {
    const cond = conditions?.find((c) => c.message?.includes(condition))
    return cond?.status === 'True' && cond.reason === 'Job_failed'
}

export const checkCuratorConditionInProgress = (
    condition: string,
    conditions: V1CustomResourceDefinitionCondition[]
) => {
    const cond = conditions?.find((c) => c.type === condition)
    return cond?.status === 'False' && cond?.reason === 'Job_has_finished'
}
export const getCuratorConditionMessage = (condition: string, conditions: V1CustomResourceDefinitionCondition[]) => {
    const cond = conditions?.find((c) => c.type === condition)
    return cond?.message
}

export const checkCuratorConditionFailed = (condition: string, conditions: V1CustomResourceDefinitionCondition[]) => {
    const cond = conditions?.find((c) => c.type === condition)
    return cond?.status === 'True' && cond?.reason === 'Job_failed'
}

export const checkCuratorConditionDone = (condition: string, conditions: V1CustomResourceDefinitionCondition[]) => {
    const cond = conditions?.find((c) => c.type === condition)
    return cond?.status === 'True' && cond?.reason === 'Job_has_finished'
}

export const getConditionStatusMessage = (condition: string, conditions: V1CustomResourceDefinitionCondition[]) => {
    const cond = conditions?.find((c) => c.type === condition)
    return cond?.message
}

export function getOwner(clusterDeployment?: ClusterDeployment, clusterClaim?: ClusterClaim) {
    const userIdentity = 'open-cluster-management.io/user-identity'
    const cdUserIdentity = clusterDeployment?.metadata.annotations?.[userIdentity]
    const ccUserIdentity = clusterClaim?.metadata.annotations?.[userIdentity]

    const decode = (value?: string) => {
        if (!value) return undefined
        const buff = new Buffer(value, 'base64')
        return buff.toString('ascii')
    }

    return {
        createdBy: decode(cdUserIdentity),
        claimedBy: decode(ccUserIdentity),
    }
}

export function getHiveConfig(clusterDeployment?: ClusterDeployment, clusterClaim?: ClusterClaim) {
    const isInstalled = clusterDeployment?.spec?.installed
    const hibernatingCondition = clusterDeployment?.status?.conditions?.find((c) => c.type === 'Hibernating')
    const supportsHibernation =
        hibernatingCondition?.status === 'False' && hibernatingCondition?.reason !== 'Unsupported'
    const isHibernatable = !!isInstalled && !!supportsHibernation

    return {
        isHibernatable,
        clusterPool: clusterDeployment?.spec?.clusterPoolRef?.poolName,
        clusterPoolNamespace: clusterDeployment?.spec?.clusterPoolRef?.namespace,
        clusterClaimName: clusterDeployment?.spec?.clusterPoolRef?.claimName,
        secrets: {
            kubeconfig: clusterDeployment?.spec?.clusterMetadata?.adminKubeconfigSecretRef.name,
            kubeadmin: clusterDeployment?.spec?.clusterMetadata?.adminPasswordSecretRef.name,
            installConfig: clusterDeployment?.spec?.provisioning?.installConfigSecretRef?.name,
        },
        lifetime: clusterClaim?.spec?.lifetime,
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
            : platformClusterClaim?.value ?? cloudLabel ?? ''
    providerLabel = providerLabel.toUpperCase()

    let provider: Provider | undefined
    switch (providerLabel) {
        case 'OPENSTACK':
            provider = Provider.openstack
            break
        case 'AMAZON':
        case 'AWS':
        case 'EKS':
            provider = Provider.aws
            break
        case 'GOOGLE':
        case 'GKE':
        case 'GCP':
        case 'GCE':
            provider = Provider.gcp
            break
        case 'AZURE':
        case 'AKS':
            provider = Provider.azure
            break
        case 'IBM':
        case 'IKS':
            provider = Provider.ibm
            break
        case 'IBMPOWERPLATFORM':
            provider = Provider.ibmpower
            break
        case 'IBMZPLATFORM':
            provider = Provider.ibmz
            break
        case 'BAREMETAL':
            provider = Provider.baremetal
            break
        case 'VSPHERE':
            provider = Provider.vmware
            break
        case 'AUTO-DETECT':
            provider = undefined
            break
        case 'OTHER':
        default:
            provider = Provider.other
    }
    return provider
}

export enum CuratorCondition {
    curatorjob = 'clustercurator-job',
    prehook = 'prehook-ansiblejob',
    monitor = 'activate-and-monitor',
    provision = 'hive-provisioning-job',
    import = 'monitor-import',
    posthook = 'posthook-ansiblejob',
    install = 'DesiredCuration: install',
    upgrade = 'DesiredCuration: upgrade',
}

export function getDistributionInfo(
    managedClusterInfo?: ManagedClusterInfo,
    managedCluster?: ManagedCluster,
    clusterDeployment?: ClusterDeployment,
    clusterCurator?: ClusterCurator
) {
    let k8sVersion: string | undefined
    let ocp: OpenShiftDistributionInfo | undefined
    let displayVersion: string | undefined

    if (managedCluster) {
        const k8sVersionClaim = managedCluster.status?.clusterClaims?.find(
            (cc) => cc.name === 'kubeversion.open-cluster-management.io'
        )
        if (k8sVersionClaim) k8sVersion = k8sVersionClaim.value
        const versionClaim = managedCluster.status?.clusterClaims?.find((cc) => cc.name === 'version.openshift.io')
        if (versionClaim) displayVersion = `OpenShift ${versionClaim.value}`
    }

    if (managedClusterInfo) {
        k8sVersion = managedClusterInfo.status?.version
        ocp = managedClusterInfo.status?.distributionInfo?.ocp
        if (displayVersion === undefined) {
            displayVersion = ocp?.version ? `OpenShift ${ocp.version}` : k8sVersion
        }
    }

    if (clusterDeployment) {
        if (displayVersion === undefined) {
            const cdVersion = clusterDeployment.metadata.labels?.['hive.openshift.io/version-major-minor-patch']
            displayVersion = cdVersion ? `OpenShift ${cdVersion}` : undefined
        }
    }

    const upgradeInfo: UpgradeInfo = {
        isUpgrading: false,
        isReadyUpdates: false,
        upgradePercentage: '',
        upgradeFailed: false,
        hooksInProgress: false,
        hookFailed: false,
        latestJob: {
            conditionMessage: '',
            step: undefined,
        },
        currentVersion: undefined,
        desiredVersion: undefined,
        isReadySelectChannels: false,
        isSelectingChannel: false,
        isUpgradeCuration: false,
        currentChannel: undefined,
        desiredChannel: undefined,
        availableUpdates: [],
        availableChannels: [],
        prehooks: {
            hasHooks: false,
            inProgress: false,
            success: false,
            failed: false,
        },
        posthooks: {
            hasHooks: false,
            inProgress: false,
            success: false,
            failed: false,
        },
    }
    const productClaim: string | undefined = managedCluster?.status?.clusterClaims?.find(
        (cc) => cc.name === 'product.open-cluster-management.io'
    )?.value

    let isManagedOpenShift = false // OSD (and ARO, ROKS once supported)
    switch (productClaim) {
        case 'OpenShiftDedicated':
            isManagedOpenShift = true
            break
    }

    if (clusterCurator || managedClusterInfo) {
        const curatorConditions = clusterCurator?.status?.conditions ?? []
        const isUpgradeCuration =
            clusterCurator?.spec?.desiredCuration === 'upgrade' ||
            checkCuratorLatestOperation(CuratorCondition.upgrade, curatorConditions) ||
            checkCuratorLatestFailedOperation(CuratorCondition.upgrade, curatorConditions)
        upgradeInfo.isUpgradeCuration = isUpgradeCuration
        upgradeInfo.hookFailed = checkCuratorLatestFailedOperation(CuratorCondition.upgrade, curatorConditions)
        upgradeInfo.latestJob.conditionMessage =
            getConditionStatusMessage(CuratorCondition.curatorjob, curatorConditions) || ''
        upgradeInfo.latestJob.step =
            isUpgradeCuration && checkCuratorLatestOperation(CuratorCondition.posthook, curatorConditions)
                ? CuratorCondition.posthook
                : CuratorCondition.prehook
        const curatorIsIdle = !checkCuratorConditionInProgress('clustercurator-job', curatorConditions)
        upgradeInfo.hooksInProgress =
            checkCuratorConditionInProgress(CuratorCondition.prehook, curatorConditions) ||
            checkCuratorConditionInProgress(CuratorCondition.posthook, curatorConditions)
        const curatorIsUpgrading =
            isUpgradeCuration &&
            clusterCurator?.spec?.upgrade?.desiredUpdate &&
            clusterCurator?.spec?.upgrade?.desiredUpdate !==
                managedClusterInfo?.status?.distributionInfo?.ocp?.version &&
            !curatorIsIdle

        const isSelectingChannel =
            isUpgradeCuration &&
            clusterCurator?.spec?.upgrade?.channel &&
            clusterCurator?.spec?.upgrade?.channel !== managedClusterInfo?.status?.distributionInfo?.ocp.channel &&
            !curatorIsIdle

        const upgradeDetailedMessage = getCuratorConditionMessage('monitor-upgrade', curatorConditions) || ''
        const percentageMatch = upgradeDetailedMessage.match(/\d+%/) || []
        upgradeInfo.upgradePercentage = percentageMatch.length > 0 ? percentageMatch[0] : ''
        const desiredVersion =
            managedClusterInfo?.status?.distributionInfo?.ocp?.desired?.version ||
            managedClusterInfo?.status?.distributionInfo?.ocp.desiredVersion || // backward compatibility
            ''
        upgradeInfo.isSelectingChannel = !!isSelectingChannel
        upgradeInfo.isUpgrading =
            curatorIsUpgrading ||
            (!!desiredVersion && desiredVersion !== managedClusterInfo?.status?.distributionInfo?.ocp?.version)

        upgradeInfo.upgradeFailed =
            (!!desiredVersion &&
                desiredVersion !== managedClusterInfo?.status?.distributionInfo?.ocp?.version &&
                managedClusterInfo?.status?.distributionInfo?.ocp?.upgradeFailed) ??
            false

        upgradeInfo.availableUpdates =
            managedClusterInfo?.status?.distributionInfo?.ocp?.versionAvailableUpdates
                ?.map((versionRelease) => {
                    return versionRelease.version || ''
                })
                .filter((version) => {
                    return !!version
                }) || []

        const isReadyUpdates =
            upgradeInfo.availableUpdates &&
            upgradeInfo.availableUpdates.length > 0 &&
            !upgradeInfo.upgradeFailed &&
            !isManagedOpenShift &&
            !upgradeInfo.isUpgrading &&
            curatorIsIdle
        upgradeInfo.isReadyUpdates = !!isReadyUpdates

        upgradeInfo.availableChannels = managedClusterInfo?.status?.distributionInfo?.ocp.desired?.channels || []
        const isReadySelectChannels =
            upgradeInfo.availableChannels &&
            upgradeInfo.availableChannels.length > 0 &&
            !isManagedOpenShift &&
            !upgradeInfo.isSelectingChannel &&
            curatorIsIdle
        upgradeInfo.isReadySelectChannels = !!isReadySelectChannels

        upgradeInfo.prehooks = {
            hasHooks: (clusterCurator?.spec?.upgrade?.prehook ?? []).length > 0,
            inProgress: isUpgradeCuration && checkCuratorConditionInProgress('prehook-ansiblejob', curatorConditions),
            success: isUpgradeCuration && checkCuratorConditionDone('prehook-ansiblejob', curatorConditions),
            failed: isUpgradeCuration && checkCuratorConditionFailed('prehook-ansiblejob', curatorConditions),
        }
        upgradeInfo.posthooks = {
            hasHooks: (clusterCurator?.spec?.upgrade?.posthook ?? []).length > 0,
            inProgress: isUpgradeCuration && checkCuratorConditionInProgress('posthook-ansiblejob', curatorConditions),
            success: isUpgradeCuration && checkCuratorConditionDone('posthook-ansiblejob', curatorConditions),
            failed: isUpgradeCuration && checkCuratorConditionFailed('posthook-ansiblejob', curatorConditions),
        }
        upgradeInfo.currentVersion = managedClusterInfo?.status?.distributionInfo?.ocp?.version
        upgradeInfo.desiredVersion = curatorIsUpgrading ? clusterCurator?.spec?.upgrade?.desiredUpdate : desiredVersion
        upgradeInfo.currentChannel = managedClusterInfo?.status?.distributionInfo?.ocp?.channel
        upgradeInfo.desiredChannel = isSelectingChannel
            ? clusterCurator?.spec?.upgrade?.channel
            : upgradeInfo.currentChannel
    }

    if (displayVersion) {
        return { k8sVersion, ocp, displayVersion, isManagedOpenShift, upgradeInfo }
    }

    return undefined
}

export function getKubeApiServer(clusterDeployment?: ClusterDeployment, managedClusterInfo?: ManagedClusterInfo) {
    return clusterDeployment?.status?.apiURL ?? managedClusterInfo?.spec?.masterEndpoint
}

export function getConsoleUrl(
    clusterDeployment?: ClusterDeployment,
    managedClusterInfo?: ManagedClusterInfo,
    managedCluster?: ManagedCluster
) {
    const consoleUrlClaim = managedCluster?.status?.clusterClaims?.find(
        (cc) => cc.name === 'consoleurl.cluster.open-cluster-management.io'
    )
    if (consoleUrlClaim) return consoleUrlClaim.value
    return clusterDeployment?.status?.webConsoleURL ?? managedClusterInfo?.status?.consoleURL
}

export function getNodes(managedClusterInfo?: ManagedClusterInfo) {
    const nodeList: NodeInfo[] = managedClusterInfo?.status?.nodeList ?? []
    let ready = 0
    let unhealthy = 0
    let unknown = 0

    nodeList.forEach((node: NodeInfo) => {
        const readyCondition = node.conditions?.find((condition) => condition.type === 'Ready')
        switch (readyCondition?.status) {
            case 'True':
                ready++
                break
            case 'False':
                unhealthy++
                break
            case 'Unknown':
            default:
                unknown++
        }
    })
    return { nodeList, ready, unhealthy, unknown }
}

export function getClusterStatus(
    clusterDeployment: ClusterDeployment | undefined,
    managedClusterInfo: ManagedClusterInfo | undefined,
    certificateSigningRequests: CertificateSigningRequest[] | undefined,
    managedCluster: ManagedCluster | undefined,
    managedClusterAddOns: ManagedClusterAddOn[],
    clusterCurator: ClusterCurator | undefined
) {
    let statusMessage: string | undefined

    // ClusterCurator status
    let ccStatus: ClusterStatus = ClusterStatus.pending
    if (clusterCurator) {
        const ccConditions: V1CustomResourceDefinitionCondition[] = clusterCurator.status?.conditions ?? []
        // ClusterCurator has not completed so loop through statuses
        if (
            clusterCurator?.spec?.desiredCuration === 'install' &&
            (!checkCuratorConditionDone(CuratorCondition.curatorjob, ccConditions) ||
                checkCuratorConditionFailed(CuratorCondition.curatorjob, ccConditions))
        ) {
            if (
                !checkCuratorConditionDone(CuratorCondition.prehook, ccConditions) &&
                (clusterCurator.spec?.install?.prehook?.length ?? 0) > 0
            ) {
                // Check if pre-hook is in progress or failed
                if (checkCuratorConditionFailed(CuratorCondition.prehook, ccConditions)) {
                    ccStatus = ClusterStatus.prehookfailed
                    statusMessage = getConditionStatusMessage(CuratorCondition.prehook, ccConditions)
                } else {
                    ccStatus = ClusterStatus.prehookjob
                }
            } else if (!checkCuratorConditionDone(CuratorCondition.monitor, ccConditions)) {
                ccStatus = checkCuratorConditionFailed(CuratorCondition.monitor, ccConditions)
                    ? ClusterStatus.provisionfailed
                    : checkCuratorConditionFailed(CuratorCondition.provision, ccConditions)
                    ? ClusterStatus.provisionfailed
                    : ClusterStatus.creating
            } else if (!checkCuratorConditionDone(CuratorCondition.import, ccConditions)) {
                // check if import is in progress or failed
                if (checkCuratorConditionFailed(CuratorCondition.import, ccConditions)) {
                    ccStatus = ClusterStatus.importfailed
                    statusMessage = getConditionStatusMessage(CuratorCondition.import, ccConditions)
                } else {
                    ccStatus = ClusterStatus.importing
                }
            } else if (
                !checkCuratorConditionDone(CuratorCondition.posthook, ccConditions) &&
                (clusterCurator.spec?.install?.posthook?.length ?? 0) > 0
            ) {
                // check if post-hook is in progress or failed
                if (checkCuratorConditionFailed(CuratorCondition.posthook, ccConditions)) {
                    ccStatus = ClusterStatus.posthookfailed
                    statusMessage = getConditionStatusMessage(CuratorCondition.posthook, ccConditions)
                } else {
                    ccStatus = ClusterStatus.posthookjob
                }
            }

            return { status: ccStatus, statusMessage }
        } else if (clusterDeployment) {
            // when curator is no longer installing, catch the prehook/posthook failure here

            if (
                checkCuratorConditionFailed(CuratorCondition.curatorjob, ccConditions) &&
                checkCuratorLatestFailedOperation(CuratorCondition.install, ccConditions)
            ) {
                if (!clusterDeployment.spec?.installed) {
                    ccStatus = ClusterStatus.prehookfailed
                } else {
                    ccStatus = ClusterStatus.posthookfailed
                }
                statusMessage = clusterCurator.status?.conditions[0].message
                return { status: ccStatus, statusMessage }
            }
        }
    }

    // ClusterDeployment status
    let cdStatus = ClusterStatus.pending
    if (clusterDeployment) {
        const cdConditions: V1CustomResourceDefinitionCondition[] = clusterDeployment?.status?.conditions ?? []
        const hasInvalidImageSet = checkForCondition('ClusterImageSetNotFound', cdConditions)
        const provisionFailed = checkForCondition('ProvisionFailed', cdConditions)
        const provisionLaunchError = checkForCondition('InstallLaunchError', cdConditions)
        const deprovisionLaunchError = checkForCondition('DeprovisionLaunchError', cdConditions)

        // deprovision failure
        if (deprovisionLaunchError) {
            cdStatus = ClusterStatus.deprovisionfailed

            // destroying
        } else if (clusterDeployment.metadata.deletionTimestamp) {
            cdStatus = ClusterStatus.destroying

            // provision failure
        } else if (provisionLaunchError) {
            cdStatus = ClusterStatus.provisionfailed

            // provision success
        } else if (clusterDeployment.spec?.installed) {
            cdStatus = ClusterStatus.detached

            const hibernatingCondition = clusterDeployment?.status?.conditions?.find((c) => c.type === 'Hibernating')
            // covers reason = Running or Unsupported
            if (hibernatingCondition?.status === 'False') {
                cdStatus = ClusterStatus.detached
            } else {
                switch (hibernatingCondition?.reason) {
                    case 'Resuming':
                        cdStatus = ClusterStatus.resuming
                        break
                    case 'Stopping':
                        cdStatus = ClusterStatus.stopping
                        break
                    case 'Hibernating':
                        cdStatus = ClusterStatus.hibernating
                        break
                }
            }

            // provisioning - default
        } else if (!clusterDeployment.spec?.installed) {
            if (hasInvalidImageSet) {
                const invalidImageSetCondition = cdConditions.find((c) => c.type === 'ClusterImageSetNotFound')
                cdStatus = ClusterStatus.provisionfailed
                statusMessage = invalidImageSetCondition?.message
            } else if (provisionFailed) {
                const provisionFailedCondition = cdConditions.find((c) => c.type === 'ProvisionFailed')
                const currentProvisionRef = clusterDeployment.status?.provisionRef?.name ?? ''
                if (provisionFailedCondition?.message?.includes(currentProvisionRef)) {
                    cdStatus = ClusterStatus.provisionfailed
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
        return { status: cdStatus, statusMessage }

        // return the cd status when a hibernation state is detected
    } else if ([ClusterStatus.hibernating, ClusterStatus.resuming, ClusterStatus.stopping].includes(cdStatus)) {
        return { status: cdStatus, statusMessage }
    }

    const mc = managedCluster ?? managedClusterInfo!

    // ManagedCluster status
    let mcStatus = ClusterStatus.pending
    const mcConditions: V1CustomResourceDefinitionCondition[] = mc.status?.conditions ?? []
    const clusterAccepted = checkForCondition('HubAcceptedManagedCluster', mcConditions)
    const clusterJoined = checkForCondition('ManagedClusterJoined', mcConditions)
    const clusterAvailable = checkForCondition('ManagedClusterConditionAvailable', mcConditions)

    // detaching
    if (mc?.metadata.deletionTimestamp) {
        mcStatus = ClusterStatus.detaching

        // registration controller may not report status when in failed state
    } else if (mcConditions.length === 0) {
        mcStatus = ClusterStatus.failed

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
        if (clusterAvailable) {
            const hasDegradedAddons = !!managedClusterAddOns?.some((mca) =>
                checkForCondition(AddonStatus.Degraded, mca.status?.conditions!)
            )
            mcStatus = hasDegradedAddons ? ClusterStatus.degraded : ClusterStatus.ready
        } else {
            const clusterUnavailable = checkForCondition('ManagedClusterConditionAvailable', mcConditions, 'False')
            const managedClusterAvailableConditionMessage = mcConditions.find(
                (c) => c.type === 'ManagedClusterConditionAvailable'
            )
            mcStatus = clusterUnavailable ? ClusterStatus.offline : ClusterStatus.unknown
            statusMessage = managedClusterAvailableConditionMessage?.message
        }
    }

    // if the ManagedCluster is in failed state because the registration controller is unavailable
    if (mcStatus === ClusterStatus.failed) {
        return clusterDeployment && cdStatus !== ClusterStatus.detached
            ? { status: cdStatus, statusMessage } // show the ClusterDeployment status, as long as it exists and is not 'detached' (which is the ready state when there is no attached ManagedCluster)
            : { status: mcStatus, statusMessage }

        // if ManagedCluster has not joined or is detaching, show ClusterDeployment status
        // as long as it is not 'detached' (which is the ready state when there is no attached ManagedCluster,
        // so this is the case is the cluster is being detached but not destroyed)
    } else if (
        (mcStatus === ClusterStatus.detaching || !clusterJoined) &&
        clusterDeployment &&
        cdStatus !== ClusterStatus.detached
    ) {
        return { status: cdStatus, statusMessage }
    } else {
        return { status: mcStatus, statusMessage }
    }
}

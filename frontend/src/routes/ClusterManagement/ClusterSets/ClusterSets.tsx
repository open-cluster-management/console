/* Copyright Contributors to the Open Cluster Management project */

import {
    AcmAlertContext,
    AcmEmptyState,
    AcmInlineStatusGroup,
    AcmLaunchLink,
    AcmPageContent,
    AcmTable,
} from '@open-cluster-management/ui-components'
import { PageSection } from '@patternfly/react-core'
import { TableGridBreakpoint } from '@patternfly/react-table'
import { Fragment, useContext, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useRecoilValue, waitForAll } from 'recoil'
import {
    managedClusterSetsState,
    certificateSigningRequestsState,
    clusterDeploymentsState,
    managedClusterInfosState,
    managedClustersState,
    clusterManagementAddonsState,
    managedClusterAddonsState,
} from '../../../atoms'
import { mapAddons } from '../../../lib/get-addons'
import { Cluster, mapClusters, ClusterStatus } from '../../../lib/get-cluster'
// import { canUser } from '../../../lib/rbac-util'
// import { ResourceErrorCode } from '../../../lib/resource-request'
import { NavigationPath } from '../../../NavigationPath'
import {
    ManagedClusterSet,
    // ManagedClusterSetDefinition,
    managedClusterSetLabel,
} from '../../../resources/managed-cluster-set'
import { usePageContext } from '../ClusterManagement'

export default function ClusterSetsPage() {
    const alertContext = useContext(AcmAlertContext)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => alertContext.clearAlerts, [])

    const [
        managedClusterSets,
        managedClusters,
        clusterDeployments,
        managedClusterInfos,
        certificateSigningRequests,
        managedClusterAddons,
    ] = useRecoilValue(
        waitForAll([
            managedClusterSetsState,
            managedClustersState,
            clusterDeploymentsState,
            managedClusterInfosState,
            certificateSigningRequestsState,
            managedClusterAddonsState,
        ])
    )

    let clusters = mapClusters(
        clusterDeployments,
        managedClusterInfos,
        certificateSigningRequests,
        managedClusters,
        managedClusterAddons
    )
    clusters = clusters.filter((cluster) => cluster.labels?.[managedClusterSetLabel])

    usePageContext(clusters.length > 0, PageActions)
    return (
        <AcmPageContent id="clusters">
            <PageSection variant="light" isFilled={true}>
                <ClusterSetsTable clusters={clusters} managedClusterSets={managedClusterSets} />
            </PageSection>
        </AcmPageContent>
    )
}

const PageActions = () => {
    const [clusterManagementAddons] = useRecoilValue(waitForAll([clusterManagementAddonsState]))
    const addons = mapAddons(clusterManagementAddons)

    return (
        <AcmLaunchLink
            links={addons
                ?.filter((addon) => addon.launchLink)
                ?.map((addon) => ({
                    id: addon.launchLink?.displayText ?? '',
                    text: addon.launchLink?.displayText ?? '',
                    href: addon.launchLink?.href ?? '',
                }))}
        />
    )
}

export function ClusterSetsTable(props: { clusters?: Cluster[]; managedClusterSets?: ManagedClusterSet[] }) {
    const { t } = useTranslation(['cluster'])
    // const history = useHistory()
    // const [canCreateClusterSet, setCanCreateClusterSet] = useState<boolean>(false)
    // useEffect(() => {
    //     const canCreateManagedClusterSet = canUser('create', ManagedClusterSetDefinition)
    //     canCreateManagedClusterSet.promise
    //         .then((result) => setCanCreateClusterSet(result.status?.allowed!))
    //         .catch((err) => console.error(err))
    //     return () => canCreateManagedClusterSet.abort()
    // }, [])

    function mckeyFn(managedClusterSet: ManagedClusterSet) {
        return managedClusterSet.metadata.name!
    }

    return (
        <Fragment>
            <AcmTable<ManagedClusterSet>
                gridBreakPoint={TableGridBreakpoint.none}
                plural="clusterSets"
                items={props.managedClusterSets}
                columns={[
                    {
                        header: t('table.name'),
                        sort: 'name',
                        search: 'name',
                        cell: (managedClusterSet) => {
                            const clusters =
                                props.clusters?.filter(
                                    (cluster) =>
                                        cluster.labels?.[managedClusterSetLabel] === managedClusterSet.metadata.name
                                ) ?? []
                            return (
                                <span style={{ whiteSpace: 'nowrap' }}>
                                    {clusters.length > 0 ? (
                                        <Link
                                            to={NavigationPath.clusterSetDetails.replace(
                                                ':id',
                                                managedClusterSet.metadata.name as string
                                            )}
                                        >
                                            {managedClusterSet.metadata.name}
                                        </Link>
                                    ) : (
                                        managedClusterSet.metadata.name
                                    )}
                                </span>
                            )
                        },
                    },
                    {
                        header: t('table.clusters'),
                        cell: (managedClusterSet) => {
                            const clusters =
                                props.clusters?.filter(
                                    (cluster) =>
                                        cluster.labels?.[managedClusterSetLabel] === managedClusterSet.metadata.name
                                ) ?? []
                            let healthy = 0
                            let warning = 0
                            let progress = 0
                            let danger = 0
                            let unknown = 0

                            clusters.forEach((cluster) => {
                                switch (cluster.status) {
                                    case ClusterStatus.ready:
                                        healthy++
                                        break
                                    case ClusterStatus.needsapproval:
                                        warning++
                                        break
                                    case ClusterStatus.creating:
                                    case ClusterStatus.destroying:
                                    case ClusterStatus.detaching:
                                    case ClusterStatus.stopping:
                                    case ClusterStatus.resuming:
                                        progress++
                                        break
                                    case ClusterStatus.failed:
                                    case ClusterStatus.provisionfailed:
                                    case ClusterStatus.deprovisionfailed:
                                    case ClusterStatus.notaccepted:
                                    case ClusterStatus.offline:
                                    case ClusterStatus.degraded:
                                        danger++
                                        break
                                    // temporary
                                    case ClusterStatus.hibernating:
                                    case ClusterStatus.pending:
                                    case ClusterStatus.pendingimport:
                                        unknown++
                                        break
                                    // detached clusters don't have a ManagedCluster
                                    case ClusterStatus.detached:
                                        break
                                }
                            })

                            return clusters.length === 0 ? (
                                0
                            ) : (
                                <AcmInlineStatusGroup
                                    healthy={healthy}
                                    warning={warning}
                                    progress={progress}
                                    danger={danger}
                                    unknown={unknown}
                                />
                            )
                        },
                    },
                    {
                        header: t('table.nodes'),
                        cell: (managedClusterSet) => {
                            const clusters =
                                props.clusters?.filter(
                                    (cluster) =>
                                        cluster.labels?.[managedClusterSetLabel] === managedClusterSet.metadata.name
                                ) ?? []

                            let healthy = 0
                            let danger = 0
                            let unknown = 0

                            clusters.forEach((cluster) => {
                                healthy += cluster.nodes!.ready
                                danger += cluster.nodes!.unhealthy
                                unknown += cluster.nodes!.unknown
                            })

                            return healthy + danger + unknown > 0 ? (
                                <AcmInlineStatusGroup healthy={healthy} danger={danger} unknown={unknown} />
                            ) : (
                                '-'
                            )
                        },
                    },
                    // {
                    //     header: '',
                    //     cell: (managedClusterSet) => {
                    //         return <ClusterActionDropdown cluster={cluster} isKebab={true} />
                    //     },
                    //     cellTransforms: [fitContent],
                    // },
                ]}
                keyFn={mckeyFn}
                key="clusterSetsTable"
                // tableActions={[
                //     {
                //         id: 'createClusterSet',
                //         title: t('managed.createClusterSet'),
                //         click: () => history.push(NavigationPath.createClusterSet),
                //         isDisabled: !canCreateClusterSet,
                //         tooltip: t('common:rbac.unauthorized'),
                //     },
                // ]}
                rowActions={[]}
                emptyState={
                    <AcmEmptyState
                        key="mcEmptyState"
                        title={t('managed.clusterSets.emptyStateHeader')}
                        message={t('managed.clusterSetsemptyStateMsg')}
                        // action={<AddCluster type="button" buttonSpacing />}
                    />
                }
            />
        </Fragment>
    )
}

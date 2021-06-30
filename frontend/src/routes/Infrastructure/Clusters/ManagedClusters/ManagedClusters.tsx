/* Copyright Contributors to the Open Cluster Management project */

import {
    AcmAlertContext,
    AcmEmptyState,
    AcmInlineProvider,
    AcmInlineStatusGroup,
    AcmLabels,
    AcmLaunchLink,
    AcmPageContent,
    AcmTable,
    IAcmTableAction,
} from '@open-cluster-management/ui-components'
import { ButtonVariant, PageSection, Stack, StackItem, TextContent, Text, TextVariants } from '@patternfly/react-core'
import { fitContent } from '@patternfly/react-table'
import React, { Fragment, useContext, useEffect, useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { clusterCuratorsState, clusterManagementAddonsState } from '../../../../atoms'
import { BulkActionModel, errorIsNot, IBulkActionModelProps } from '../../../../components/BulkActionModel'
import { deleteCluster, detachCluster } from '../../../../lib/delete-cluster'
import { addonPathKey, addonTextKey } from '../../../../lib/get-addons'
import { Cluster } from '../../../../lib/get-cluster'
import { canUser } from '../../../../lib/rbac-util'
import { patchResource, ResourceErrorCode } from '../../../../lib/resource-request'
import { NavigationPath } from '../../../../NavigationPath'
import { ClusterDeployment, ClusterDeploymentDefinition } from '../../../../resources/cluster-deployment'
import { ManagedClusterDefinition } from '../../../../resources/managed-cluster'
import { usePageContext } from '../Clusters'
import { AddCluster } from './components/AddCluster'
import { BatchUpgradeModal } from './components/BatchUpgradeModal'
import { ClusterActionDropdown } from './components/ClusterActionDropdown'
import { DistributionField } from './components/DistributionField'
import { StatusField } from './components/StatusField'
import { useAllClusters } from './components/useAllClusters'
import { DiscoveryBanner } from '../DiscoveredClusters/DiscoveryComponents/Banner'
import { BatchChannelSelectModal } from './components/BatchChannelSelectModal'

export default function ClustersPage() {
    const { t } = useTranslation(['cluster', 'discovery'])
    const alertContext = useContext(AcmAlertContext)
    const [isDiscoveryBannerDismissed] = useState<string>(localStorage.getItem('DiscoveryBannerDismissed') || '')
    let clusters = useAllClusters()
    clusters = clusters.filter((cluster) => {
        // don't show clusters in cluster pools in table
        if (cluster.hive.clusterPool) {
            return cluster.hive.clusterClaimName !== undefined
        } else {
            return true
        }
    })

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => alertContext.clearAlerts, [])

    usePageContext(clusters.length > 0, PageActions)

    const history = useHistory()
    const [canCreateCluster, setCanCreateCluster] = useState<boolean>(false)
    useEffect(() => {
        const canCreateManagedCluster = canUser('create', ManagedClusterDefinition)
        canCreateManagedCluster.promise
            .then((result) => setCanCreateCluster(result.status?.allowed!))
            .catch((err) => console.error(err))
        return () => canCreateManagedCluster.abort()
    }, [])

    return (
        <AcmPageContent id="clusters">
            <PageSection>
                <Stack hasGutter={true}>
                    {isDiscoveryBannerDismissed === 'true' ? null : (
                        <StackItem>
                            <DiscoveryBanner />
                        </StackItem>
                    )}
                    <StackItem>
                        <ClustersTable
                            clusters={clusters}
                            tableActions={[
                                {
                                    id: 'createCluster',
                                    title: t('managed.createCluster'),
                                    click: () => history.push(NavigationPath.createCluster),
                                    isDisabled: !canCreateCluster,
                                    tooltip: t('common:rbac.unauthorized'),
                                },
                                {
                                    id: 'importCluster',
                                    title: t('managed.importCluster'),
                                    click: () => history.push(NavigationPath.importCluster),
                                    isDisabled: !canCreateCluster,
                                    tooltip: t('common:rbac.unauthorized'),
                                    variant: ButtonVariant.secondary,
                                },
                            ]}
                            emptyState={
                                <AcmEmptyState
                                    key="mcEmptyState"
                                    title={t('managed.emptyStateHeader')}
                                    message={
                                        <Trans
                                            i18nKey={'cluster:managed.emptyStateMsg'}
                                            components={{ bold: <strong /> }}
                                        />
                                    }
                                    action={<AddCluster type="button" />}
                                />
                            }
                        />
                    </StackItem>
                </Stack>
            </PageSection>
        </AcmPageContent>
    )
}

const PageActions = () => {
    const [clusterManagementAddons] = useRecoilState(clusterManagementAddonsState)
    const addons = clusterManagementAddons.filter(
        (cma) => cma.metadata.annotations?.[addonTextKey] && cma.metadata.annotations?.[addonPathKey]
    )

    return (
        <AcmLaunchLink
            links={addons?.map((cma) => ({
                id: cma.metadata.annotations?.[addonTextKey]!,
                text: cma.metadata.annotations?.[addonTextKey]!,
                href: cma.metadata.annotations?.[addonPathKey]!,
            }))}
        />
    )
}

export function ClustersTable(props: {
    clusters?: Cluster[]
    tableActions?: IAcmTableAction[]
    emptyState?: React.ReactNode
}) {
    sessionStorage.removeItem('DiscoveredClusterDisplayName')
    sessionStorage.removeItem('DiscoveredClusterConsoleURL')
    sessionStorage.removeItem('DiscoveredClusterApiURL')

    const [clusterCurators] = useRecoilState(clusterCuratorsState)

    const { t } = useTranslation(['cluster'])
    const [upgradeClusters, setUpgradeClusters] = useState<Array<Cluster> | undefined>()
    const [selectChannels, setSelectChannels] = useState<Array<Cluster> | undefined>()
    const [modalProps, setModalProps] = useState<IBulkActionModelProps<Cluster> | { open: false }>({
        open: false,
    })

    function mckeyFn(cluster: Cluster) {
        return cluster.name!
    }

    const modalColumns = useMemo(
        () => [
            {
                header: t('table.name'),
                sort: 'displayName',
                cell: (cluster: Cluster) => (
                    <>
                        <span style={{ whiteSpace: 'nowrap' }}>{cluster.displayName}</span>
                        {cluster.hive.clusterClaimName && (
                            <TextContent>
                                <Text component={TextVariants.small}>{cluster.hive.clusterClaimName}</Text>
                            </TextContent>
                        )}
                    </>
                ),
            },
            {
                header: t('table.status'),
                sort: 'status',
                cell: (cluster: Cluster) => (
                    <span style={{ whiteSpace: 'nowrap' }}>
                        <StatusField cluster={cluster} />
                    </span>
                ),
            },
            {
                header: t('table.provider'),
                sort: 'provider',
                cell: (cluster: Cluster) =>
                    cluster?.provider ? <AcmInlineProvider provider={cluster?.provider} /> : '-',
            },
        ],
        [t]
    )

    return (
        <Fragment>
            <BulkActionModel<Cluster> {...modalProps} />
            <BatchUpgradeModal
                clusters={upgradeClusters}
                open={!!upgradeClusters}
                close={() => {
                    setUpgradeClusters(undefined)
                }}
            />
            <BatchChannelSelectModal
                clusters={selectChannels}
                open={!!selectChannels}
                close={() => {
                    setSelectChannels(undefined)
                }}
            />
            <AcmTable<Cluster>
                plural="clusters"
                items={props.clusters}
                columns={[
                    {
                        header: t('table.name'),
                        tooltip: t('table.name.helperText.noBold'),
                        sort: 'displayName',
                        search: (cluster) => [cluster.displayName as string, cluster.hive.clusterClaimName as string],
                        cell: (cluster) => (
                            <>
                                <span style={{ whiteSpace: 'nowrap' }}>
                                    <Link to={NavigationPath.clusterDetails.replace(':id', cluster.name as string)}>
                                        {cluster.displayName}
                                    </Link>
                                </span>
                                {cluster.hive.clusterClaimName && (
                                    <TextContent>
                                        <Text component={TextVariants.small}>{cluster.hive.clusterClaimName}</Text>
                                    </TextContent>
                                )}
                            </>
                        ),
                    },
                    {
                        header: t('table.status'),
                        sort: 'status',
                        search: 'status',
                        cell: (cluster) => (
                            <span style={{ whiteSpace: 'nowrap' }}>
                                <StatusField cluster={cluster} />
                            </span>
                        ),
                    },
                    {
                        header: t('table.provider'),
                        sort: 'provider',
                        search: 'provider',
                        cell: (cluster) =>
                            cluster?.provider ? <AcmInlineProvider provider={cluster?.provider} /> : '-',
                    },
                    {
                        header: t('table.distribution'),
                        sort: 'distribution.displayVersion',
                        search: 'distribution.displayVersion',
                        cell: (cluster) => (
                            <DistributionField
                                cluster={cluster}
                                clusterCurator={clusterCurators.find(
                                    (curator) => curator.metadata.name === cluster.name
                                )}
                            />
                        ),
                    },
                    {
                        header: t('table.labels'),
                        search: (cluster) =>
                            cluster.labels
                                ? Object.keys(cluster.labels).map((key) => `${key}=${cluster.labels![key]}`)
                                : '',
                        cell: (cluster) => {
                            if (cluster.labels) {
                                const labelKeys = Object.keys(cluster.labels)
                                const collapse =
                                    [
                                        'cloud',
                                        'clusterID',
                                        'installer.name',
                                        'installer.namespace',
                                        'name',
                                        'vendor',
                                        'managed-by',
                                        'local-cluster',
                                    ].filter((label) => labelKeys.includes(label)) ?? []
                                return (
                                    <AcmLabels
                                        labels={cluster.labels}
                                        style={{ maxWidth: '600px' }}
                                        expandedText={t('common:show.less')}
                                        collapsedText={t('common:show.more', { number: collapse.length })}
                                        collapse={collapse}
                                    />
                                )
                            } else {
                                return '-'
                            }
                        },
                    },
                    {
                        header: t('table.nodes'),
                        cell: (cluster) => {
                            return cluster.nodes!.nodeList!.length > 0 ? (
                                <AcmInlineStatusGroup
                                    healthy={cluster.nodes!.ready}
                                    danger={cluster.nodes!.unhealthy}
                                    unknown={cluster.nodes!.unknown}
                                />
                            ) : (
                                '-'
                            )
                        },
                    },
                    {
                        header: '',
                        cell: (cluster: Cluster) => {
                            return <ClusterActionDropdown cluster={cluster} isKebab={true} />
                        },
                        cellTransforms: [fitContent],
                    },
                ]}
                keyFn={mckeyFn}
                key="managedClustersTable"
                tableActions={props.tableActions}
                bulkActions={[
                    {
                        id: 'upgradeClusters',
                        title: t('managed.upgrade.plural'),
                        click: (managedClusters: Array<Cluster>) => {
                            if (!managedClusters) return
                            setUpgradeClusters(managedClusters)
                        },
                    },
                    {
                        id: 'selectChannels',
                        title: t('managed.selectChannel.plural'),
                        click: (managedClusters: Array<Cluster>) => {
                            if (!managedClusters) return
                            setSelectChannels(managedClusters)
                        },
                    },
                    {
                        id: 'hibernate-cluster',
                        title: t('managed.hibernate.plural'),
                        click: (clusters) => {
                            setModalProps({
                                open: true,
                                title: t('bulk.title.hibernate'),
                                action: t('hibernate'),
                                processing: t('hibernating'),
                                resources: clusters,
                                description: t('bulk.message.hibernate'),
                                columns: modalColumns,
                                keyFn: (cluster) => cluster.name as string,
                                actionFn: (cluster) => {
                                    return patchResource(
                                        {
                                            apiVersion: ClusterDeploymentDefinition.apiVersion,
                                            kind: ClusterDeploymentDefinition.kind,
                                            metadata: {
                                                name: cluster.name!,
                                                namespace: cluster.namespace!,
                                            },
                                        } as ClusterDeployment,
                                        [{ op: 'replace', path: '/spec/powerState', value: 'Hibernating' }]
                                    )
                                },
                                close: () => {
                                    setModalProps({ open: false })
                                },
                                isValidError: errorIsNot([ResourceErrorCode.NotFound]),
                            })
                        },
                    },
                    {
                        id: 'resume-cluster',
                        title: t('managed.resume.plural'),
                        click: (clusters) => {
                            setModalProps({
                                open: true,
                                title: t('bulk.title.resume'),
                                action: t('resume'),
                                processing: t('resuming'),
                                resources: clusters,
                                description: t('bulk.message.resume'),
                                columns: modalColumns,
                                keyFn: (cluster) => cluster.name as string,
                                actionFn: (cluster) => {
                                    return patchResource(
                                        {
                                            apiVersion: ClusterDeploymentDefinition.apiVersion,
                                            kind: ClusterDeploymentDefinition.kind,
                                            metadata: {
                                                name: cluster.name!,
                                                namespace: cluster.namespace!,
                                            },
                                        } as ClusterDeployment,
                                        [{ op: 'replace', path: '/spec/powerState', value: 'Running' }]
                                    )
                                },
                                close: () => {
                                    setModalProps({ open: false })
                                },
                                isValidError: errorIsNot([ResourceErrorCode.NotFound]),
                            })
                        },
                    },
                    {
                        id: 'detachCluster',
                        title: t('managed.detach.plural'),
                        click: (clusters) => {
                            setModalProps({
                                open: true,
                                title: t('bulk.title.detach'),
                                action: t('detach'),
                                processing: t('detaching'),
                                resources: clusters,
                                description: t('bulk.message.detach'),
                                columns: modalColumns,
                                keyFn: (cluster) => cluster.name as string,
                                actionFn: (cluster) => detachCluster(cluster.name!),
                                close: () => setModalProps({ open: false }),
                                isDanger: true,
                                icon: 'warning',
                                confirmText: t('confirm').toLowerCase(),
                                isValidError: errorIsNot([ResourceErrorCode.NotFound]),
                            })
                        },
                    },
                    {
                        id: 'destroyCluster',
                        title: t('managed.destroy.plural'),
                        click: (clusters) => {
                            setModalProps({
                                open: true,
                                title: t('bulk.title.destroy'),
                                action: t('destroy'),
                                processing: t('destroying'),
                                resources: clusters,
                                description: t('bulk.message.destroy'),
                                columns: modalColumns,
                                keyFn: (cluster) => cluster.name as string,
                                actionFn: (cluster) => deleteCluster(cluster, true),
                                close: () => setModalProps({ open: false }),
                                isDanger: true,
                                icon: 'warning',
                                confirmText: t('confirm').toLowerCase(),
                                isValidError: errorIsNot([ResourceErrorCode.NotFound]),
                            })
                        },
                    },
                ]}
                rowActions={[]}
                emptyState={props.emptyState}
            />
        </Fragment>
    )
}

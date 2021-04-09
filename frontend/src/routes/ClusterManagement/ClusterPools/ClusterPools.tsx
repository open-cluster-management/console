/* Copyright Contributors to the Open Cluster Management project */

import { Fragment, useContext, useEffect, useState, useMemo } from 'react'
import {
    AcmAlertContext,
    AcmEmptyState,
    AcmPageContent,
    AcmTable,
    AcmInlineProvider,
    Provider,
} from '@open-cluster-management/ui-components'
import { PageSection } from '@patternfly/react-core'
import { fitContent, TableGridBreakpoint } from '@patternfly/react-table'
import { useTranslation, Trans } from 'react-i18next'
// import { useHistory } from 'react-router-dom'
import { useRecoilValue, waitForAll } from 'recoil'
import { clusterPoolsState, clusterClaimsState } from '../../../atoms'
import { BulkActionModel, errorIsNot, IBulkActionModelProps } from '../../../components/BulkActionModel'
import { RbacDropdown } from '../../../components/Rbac'
import { /*canUser, */ rbacDelete, rbacCreate } from '../../../lib/rbac-util'
// import { ResourceErrorCode } from '../../../lib/resource-request'
import { ClusterPool /*, ClusterPoolDefinition */ } from '../../../resources/cluster-pool'
import { ClusterClaimDefinition } from '../../../resources/cluster-claim'
import { Cluster, ClusterStatus } from '../../../lib/get-cluster'
import { deleteResource, ResourceErrorCode } from '../../../lib/resource-request'
import { useAllClusters } from '../Clusters/components/useAllClusters'
import { StatusField } from '../Clusters/components/StatusField'
import { ClusterClaimModal, ClusterClaimModalProps } from './components/ClusterClaimModal'
import { ClusterStatuses } from '../ClusterSets/components/ClusterStatuses'

export default function ClusterPoolsPage() {
    const alertContext = useContext(AcmAlertContext)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => alertContext.clearAlerts, [])

    return (
        <AcmPageContent id="clusters">
            <PageSection variant="light" isFilled={true}>
                <ClusterPoolsTable />
            </PageSection>
        </AcmPageContent>
    )
}

function ClusterPoolProvider(props: { clusterPool: ClusterPool }) {
    let provider: Provider | undefined
    if (props.clusterPool.spec?.platform?.aws) provider = Provider.aws
    if (props.clusterPool.spec?.platform?.gcp) provider = Provider.gcp
    if (props.clusterPool.spec?.platform?.azure) provider = Provider.azure

    if (!provider) return <>-</>

    return <AcmInlineProvider provider={provider} />
}

export function ClusterPoolsTable() {
    const [clusterPools] = useRecoilValue(waitForAll([clusterPoolsState, clusterClaimsState]))
    const { t } = useTranslation(['cluster'])
    const [modalProps, setModalProps] = useState<IBulkActionModelProps<ClusterPool> | { open: false }>({
        open: false,
    })
    const [clusterClaimModalProps, setClusterClaimModalProps] = useState<ClusterClaimModalProps | undefined>()

    const clusters = useAllClusters()

    // const history = useHistory()
    // const [canCreateClusterPool, setCanCreateClusterPool] = useState<boolean>(false)
    // useEffect(() => {
    //     const canCreateClusterPool = canUser('create', ClusterPoolDefinition)
    //     canCreateClusterPool.promise
    //         .then((result) => setCanCreateClusterPool(result.status?.allowed!))
    //         .catch((err) => console.error(err))
    //     return () => canCreateClusterPool.abort()
    // }, [])

    const modalColumns = useMemo(
        () => [
            {
                header: t('table.name'),
                cell: (clusterPool: ClusterPool) => (
                    <span style={{ whiteSpace: 'nowrap' }}>{clusterPool.metadata.name}</span>
                ),
                sort: 'metadata.name',
            },
            {
                header: t('table.namespace'),
                sort: 'metadata.namespace',
                search: 'metadata.namespace',
                cell: (clusterPool: ClusterPool) => {
                    return clusterPool.metadata.namespace
                },
            },
            {
                header: t('table.provider'),
                cell: (clusterPool: ClusterPool) => {
                    return <ClusterPoolProvider clusterPool={clusterPool} />
                },
            },
        ],
        [t]
    )

    function mckeyFn(clusterPool: ClusterPool) {
        return clusterPool.metadata.uid!
    }

    return (
        <Fragment>
            <BulkActionModel<ClusterPool> {...modalProps} />
            <ClusterClaimModal {...clusterClaimModalProps} />
            <AcmTable<ClusterPool>
                gridBreakPoint={TableGridBreakpoint.none}
                plural="clusterPools"
                items={clusterPools}
                addSubRows={(clusterPool: ClusterPool) => {
                    const clusterPoolClusters = clusters.filter(
                        (cluster) => cluster.hive.clusterPool === clusterPool.metadata.name
                    )
                    if (clusterPoolClusters.length === 0) {
                        return undefined
                    } else {
                        return [
                            {
                                cells: [
                                    {
                                        title: (
                                            <AcmTable<Cluster>
                                                gridBreakPoint={TableGridBreakpoint.none}
                                                keyFn={(cluster: Cluster) => cluster.name!}
                                                key="clusterPoolClustersTable"
                                                autoHidePagination
                                                showToolbar={false}
                                                plural="clusters"
                                                items={clusterPoolClusters}
                                                columns={[
                                                    {
                                                        header: t('table.clusterName'),
                                                        sort: 'name',
                                                        search: 'name',
                                                        cell: (cluster: Cluster) => (
                                                            <span style={{ whiteSpace: 'nowrap' }}>{cluster.name}</span>
                                                        ),
                                                    },
                                                    {
                                                        header: t('table.status'),
                                                        sort: 'status',
                                                        search: 'status',
                                                        cell: (cluster: Cluster) => (
                                                            <span style={{ whiteSpace: 'nowrap' }}>
                                                                <StatusField cluster={cluster} />
                                                            </span>
                                                        ),
                                                    },
                                                    {
                                                        header: t('table.availableToClaim'),
                                                        sort: 'hive',
                                                        search: 'status',
                                                        cell: (cluster: Cluster) => {
                                                            const availableStatuses = [
                                                                ClusterStatus.ready,
                                                                ClusterStatus.detached,
                                                                ClusterStatus.hibernating,
                                                                ClusterStatus.resuming,
                                                                ClusterStatus.stopping,
                                                            ]
                                                            const isAvailable =
                                                                !cluster.hive.clusterClaimName &&
                                                                availableStatuses.includes(cluster.status)
                                                            return (
                                                                <span style={{ whiteSpace: 'nowrap' }}>
                                                                    {t(`${isAvailable ? 'common:yes' : 'common:no'}`)}
                                                                </span>
                                                            )
                                                        },
                                                    },
                                                    {
                                                        header: t('table.claimName'),
                                                        sort: 'hive',
                                                        search: 'status',
                                                        cell: (cluster: Cluster) => (
                                                            <span style={{ whiteSpace: 'nowrap' }}>
                                                                {cluster.hive.clusterClaimName ?? '-'}
                                                            </span>
                                                        ),
                                                    },
                                                    {
                                                        header: t('table.lifetime'),
                                                        sort: 'hive.lifetime',
                                                        search: 'hive.lifetime',
                                                        cell: (cluster: Cluster) => {
                                                            if (!cluster.hive.clusterClaimName) {
                                                                return '-'
                                                            }
                                                            return (
                                                                <span style={{ whiteSpace: 'nowrap' }}>
                                                                    <div>{cluster.hive.lifetime ?? '-'}</div>
                                                                </span>
                                                            )
                                                        },
                                                    },
                                                ]}
                                            />
                                        ),
                                    },
                                ],
                            },
                        ]
                    }
                }}
                columns={[
                    {
                        header: t('table.name'),
                        sort: 'metadata.name',
                        search: 'metadata.name',
                        cell: (clusterPool: ClusterPool) => {
                            return clusterPool.metadata.name
                        },
                    },
                    {
                        header: t('table.namespace'),
                        sort: 'metadata.namespace',
                        search: 'metadata.namespace',
                        cell: (clusterPool: ClusterPool) => {
                            return clusterPool.metadata.namespace
                        },
                    },
                    {
                        header: t('table.clusters'),
                        cell: (clusterPool: ClusterPool) => {
                            return <ClusterStatuses clusterPool={clusterPool} />
                        },
                    },
                    {
                        header: t('table.provider'),
                        cell: (clusterPool: ClusterPool) => {
                            return <ClusterPoolProvider clusterPool={clusterPool} />
                        },
                    },
                    {
                        header: t('table.available'),
                        cell: (clusterPool: ClusterPool) => {
                            return `${clusterPool?.status?.ready}/${clusterPool.spec!.size}`
                        },
                    },
                    {
                        header: '',
                        cell: (clusterPool: ClusterPool) => {
                            let actions = [
                                {
                                    id: 'claimCluster',
                                    text: t('clusterPool.claim'),
                                    isDisabled: true,
                                    click: (clusterPool: ClusterPool) => {
                                        setClusterClaimModalProps({
                                            clusterPool,
                                            onClose: () => setClusterClaimModalProps(undefined),
                                        })
                                    },
                                    rbac: [rbacCreate(ClusterClaimDefinition, clusterPool.metadata.namespace)],
                                },
                                {
                                    id: 'destroy',
                                    text: t('clusterPool.destroy'),
                                    isDisabled: true,
                                    click: (clusterPool: ClusterPool) => {
                                        setModalProps({
                                            open: true,
                                            title: t('bulk.title.destroyClusterPool'),
                                            action: t('common:destroy'),
                                            processing: t('common:destroying'),
                                            resources: [clusterPool],
                                            description: t('bulk.message.destroyClusterPool'),
                                            columns: modalColumns,
                                            keyFn: mckeyFn,
                                            actionFn: deleteResource,
                                            confirmText: clusterPool.metadata.name!,
                                            close: () => setModalProps({ open: false }),
                                            isDanger: true,
                                        })
                                    },
                                    rbac: [rbacDelete(clusterPool)],
                                },
                            ]

                            if (clusterPool.status?.ready === 0) {
                                actions = actions.filter((action) => action.id !== 'claimCluster')
                            }

                            return (
                                <RbacDropdown<ClusterPool>
                                    id={`${clusterPool.metadata.name}-actions`}
                                    item={clusterPool}
                                    isKebab={true}
                                    text={`${clusterPool.metadata.name}-actions`}
                                    actions={actions}
                                />
                            )
                        },
                        cellTransforms: [fitContent],
                    },
                ]}
                keyFn={mckeyFn}
                key="clusterPoolsTable"
                bulkActions={[
                    {
                        id: 'destroyClusterPools',
                        title: t('bulk.destroy.clusterPools'),
                        click: (clusterPools: ClusterPool[]) => {
                            setModalProps({
                                open: true,
                                title: t('bulk.destroy.clusterPools'),
                                action: t('common:destroy'),
                                processing: t('common:destroying'),
                                resources: clusterPools,
                                description: t('bulk.message.destroyClusterPool'),
                                columns: modalColumns,
                                keyFn: mckeyFn,
                                actionFn: deleteResource,
                                close: () => setModalProps({ open: false }),
                                isDanger: true,
                                confirmText: t('confirm').toLowerCase(),
                                isValidError: errorIsNot([ResourceErrorCode.NotFound]),
                            })
                        },
                    },
                ]}
                tableActions={[]}
                rowActions={[]}
                emptyState={
                    <AcmEmptyState
                        key="mcEmptyState"
                        title={t('managed.clusterPools.emptyStateHeader')}
                        message={
                            <Trans
                                i18nKey={'cluster:managed.clusterPools.emptyStateMsg'}
                                components={{ bold: <strong />, p: <p /> }}
                            />
                        }
                        // action={
                        //     <AcmButton
                        //         role="link"
                        //         onClick={() => history.push(NavigationPath.clusterPools)}
                        //         disabled={!canCreateClusterPool}
                        //         tooltip={t('common:rbac.unauthorized')}
                        //     >
                        //         {t('managed.createClusterPool')}
                        //     </AcmButton>
                        // }
                    />
                }
            />
        </Fragment>
    )
}

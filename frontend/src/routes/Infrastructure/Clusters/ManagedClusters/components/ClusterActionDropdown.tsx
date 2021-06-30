/* Copyright Contributors to the Open Cluster Management project */

import { AcmInlineProvider } from '@open-cluster-management/ui-components'
import { TextContent, Text, TextVariants } from '@patternfly/react-core'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BulkActionModel, errorIsNot, IBulkActionModelProps } from '../../../../../components/BulkActionModel'
import { RbacDropdown } from '../../../../../components/Rbac'
import { deleteCluster, detachCluster } from '../../../../../lib/delete-cluster'
import { Cluster, ClusterStatus } from '../../../../../lib/get-cluster'
import { rbacCreate, rbacDelete, rbacPatch } from '../../../../../lib/rbac-util'
import { patchResource, ResourceErrorCode } from '../../../../../lib/resource-request'
import { ClusterDeployment, ClusterDeploymentDefinition } from '../../../../../resources/cluster-deployment'
import { ManagedClusterDefinition } from '../../../../../resources/managed-cluster'
import { BatchUpgradeModal } from './BatchUpgradeModal'
import { BatchChannelSelectModal } from './BatchChannelSelectModal'
import { EditLabels } from './EditLabels'
import { StatusField } from './StatusField'
import { createImportResources } from '../../../../../lib/import-cluster'
import { ClusterCuratorDefinition } from '../../../../../resources/cluster-curator'

export function ClusterActionDropdown(props: { cluster: Cluster; isKebab: boolean }) {
    const { t } = useTranslation(['cluster'])

    const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false)
    const [showChannelSelectModal, setShowChannelSelectModal] = useState<boolean>(false)
    const [modalProps, setModalProps] = useState<IBulkActionModelProps<Cluster> | { open: false }>({
        open: false,
    })
    const [showEditLabels, setShowEditLabels] = useState<boolean>(false)

    const { cluster } = props

    const modalColumns = useMemo(
        () => [
            {
                header: t('table.name'),
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
                sort: 'displayName',
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

    let actions = [
        {
            id: 'edit-labels',
            text: t('managed.editLabels'),
            click: () => setShowEditLabels(true),
            isDisabled: true,
            rbac: [rbacPatch(ManagedClusterDefinition, undefined, cluster.name)],
        },
        {
            id: 'upgrade-cluster',
            text: t('managed.upgrade'),
            click: (_cluster: Cluster) => setShowUpgradeModal(true),
            isDisabled: true,
            rbac: [
                rbacPatch(ClusterCuratorDefinition, cluster.namespace),
                rbacCreate(ClusterCuratorDefinition, cluster.namespace),
            ],
        },
        {
            id: 'select-channel',
            text: t('managed.selectChannel'),
            click: (_cluster: Cluster) => setShowChannelSelectModal(true),
            isDisabled: true,
            rbac: [
                rbacPatch(ClusterCuratorDefinition, cluster.namespace),
                rbacCreate(ClusterCuratorDefinition, cluster.namespace),
            ],
        },
        {
            id: 'search-cluster',
            text: t('managed.search'),
            click: (cluster: Cluster) =>
                window.location.assign(`/search?filters={"textsearch":"cluster%3A${cluster?.name}"}`),
        },
        {
            id: 'import-cluster',
            text: t('managed.import'),
            click: (cluster: Cluster) => {
                setModalProps({
                    open: true,
                    title: t('bulk.title.import'),
                    action: t('common:import'),
                    processing: t('common:importing'),
                    resources: [cluster],
                    close: () => {
                        setModalProps({ open: false })
                    },
                    description: t('bulk.message.import'),
                    columns: [
                        {
                            header: t('upgrade.table.name'),
                            sort: 'displayName',
                            cell: (cluster) => (
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
                            header: t('table.provider'),
                            sort: 'provider',
                            cell: (cluster: Cluster) =>
                                cluster?.provider ? <AcmInlineProvider provider={cluster?.provider} /> : '-',
                        },
                    ],
                    keyFn: (cluster) => cluster.name as string,
                    actionFn: (cluster: Cluster) => createImportResources(cluster.name!, cluster.clusterSet!),
                })
            },
            rbac: [rbacCreate(ManagedClusterDefinition)],
        },
        {
            id: 'hibernate-cluster',
            text: t('managed.hibernate'),
            click: () => {
                setModalProps({
                    open: true,
                    title: t('bulk.title.hibernate'),
                    action: t('hibernate'),
                    processing: t('hibernating'),
                    resources: [cluster],
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
                })
            },
            isDisabled: true,
            rbac: [rbacPatch(ClusterDeploymentDefinition, cluster.namespace, cluster.name)],
        },
        {
            id: 'resume-cluster',
            text: t('managed.resume'),
            click: () => {
                setModalProps({
                    open: true,
                    title: t('bulk.title.resume'),
                    action: t('resume'),
                    processing: t('resuming'),
                    resources: [cluster],
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
                })
            },
            isDisabled: true,
            rbac: [rbacPatch(ClusterDeploymentDefinition, cluster.namespace, cluster.name)],
        },
        {
            id: 'detach-cluster',
            text: t('managed.detach'),
            click: (cluster: Cluster) => {
                setModalProps({
                    open: true,
                    title: t('bulk.title.detach'),
                    action: t('detach'),
                    processing: t('detaching'),
                    resources: [cluster],
                    description: t('bulk.message.detach'),
                    columns: modalColumns,
                    keyFn: (cluster) => cluster.name as string,
                    actionFn: (cluster) => detachCluster(cluster.name!),
                    close: () => {
                        setModalProps({ open: false })
                    },
                    isDanger: true,
                    icon: 'warning',
                    confirmText: cluster.displayName,
                    isValidError: errorIsNot([ResourceErrorCode.NotFound]),
                })
            },
            isDisabled: true,
            rbac: [rbacDelete(ManagedClusterDefinition, undefined, cluster.name)],
        },
        {
            id: 'destroy-cluster',
            text: t('managed.destroy'),
            click: (cluster: Cluster) => {
                setModalProps({
                    open: true,
                    title: t('bulk.title.destroy'),
                    action: t('destroy'),
                    processing: t('destroying'),
                    resources: [cluster],
                    description: t('bulk.message.destroy'),
                    columns: modalColumns,
                    keyFn: (cluster) => cluster.name as string,
                    actionFn: (cluster) => deleteCluster(cluster),
                    close: () => {
                        setModalProps({ open: false })
                    },
                    isDanger: true,
                    icon: 'warning',
                    confirmText: cluster.displayName,
                    isValidError: errorIsNot([ResourceErrorCode.NotFound]),
                })
            },
            isDisabled: true,
            rbac: [
                rbacDelete(ManagedClusterDefinition, undefined, cluster.name),
                rbacDelete(ClusterDeploymentDefinition, cluster.namespace, cluster.name),
            ],
        },
    ]

    // ClusterCurator
    if ([ClusterStatus.prehookjob, ClusterStatus.prehookfailed].includes(cluster.status)) {
        const disabledPreHookActions = [
            'upgrade-cluster',
            'select-channel',
            'search-cluster',
            'import-cluster',
            'hibernate-cluster',
            'resume-cluster',
            'detach-cluster',
        ]
        actions = actions.filter((a) => !disabledPreHookActions.includes(a.id))
    }

    if (cluster.status === ClusterStatus.importfailed) {
        const disabledImportFailedActions = [
            'upgrade-cluster',
            'select-channel',
            'search-cluster',
            'import-cluster',
            'detach-cluster',
        ]
        actions = actions.filter((a) => !disabledImportFailedActions.includes(a.id))
    }

    if ([ClusterStatus.hibernating, ClusterStatus.stopping, ClusterStatus.resuming].includes(cluster.status)) {
        const disabledHibernationActions = [
            'upgrade-cluster',
            'select-channel',
            'search-cluster',
            'hibernate-cluster',
            'import-cluster',
            'detach-cluster',
        ]
        actions = actions.filter((a) => !disabledHibernationActions.includes(a.id))
    }

    if (cluster.status !== ClusterStatus.hibernating) {
        actions = actions.filter((a) => a.id !== 'resume-cluster')
    }

    if (!cluster.hive.isHibernatable) {
        actions = actions.filter((a) => a.id !== 'hibernate-cluster')
    }

    if (cluster.status !== ClusterStatus.ready || !cluster.distribution?.upgradeInfo?.isReadyUpdates) {
        actions = actions.filter((a) => a.id !== 'upgrade-cluster')
    }

    if (cluster.status !== ClusterStatus.ready || !cluster.distribution?.upgradeInfo?.isReadySelectChannels) {
        actions = actions.filter((a) => a.id !== 'select-channel')
    }

    if (!cluster.isManaged || cluster.status === ClusterStatus.detaching) {
        actions = actions.filter((a) => a.id !== 'edit-labels')
        actions = actions.filter((a) => a.id !== 'search-cluster')
    }

    if (cluster.status !== ClusterStatus.detached) {
        actions = actions.filter((a) => a.id !== 'import-cluster')
    }

    if (cluster.status === ClusterStatus.detached || !cluster.isManaged || cluster.status === ClusterStatus.detaching) {
        actions = actions.filter((a) => a.id !== 'detach-cluster')
    }

    if (!cluster.isHive || (cluster.hive.clusterPool && !cluster.hive.clusterClaimName)) {
        actions = actions.filter((a) => a.id !== 'destroy-cluster')
    }

    return (
        <>
            <EditLabels
                resource={
                    showEditLabels
                        ? { ...ManagedClusterDefinition, metadata: { name: cluster.name, labels: cluster.labels } }
                        : undefined
                }
                displayName={cluster.displayName}
                close={() => setShowEditLabels(false)}
            />
            <BatchUpgradeModal clusters={[cluster]} open={showUpgradeModal} close={() => setShowUpgradeModal(false)} />
            <BatchChannelSelectModal
                clusters={[cluster]}
                open={showChannelSelectModal}
                close={() => setShowChannelSelectModal(false)}
            />
            <BulkActionModel<Cluster> {...modalProps} />
            <RbacDropdown<Cluster>
                id={`${cluster.name}-actions`}
                item={cluster}
                isKebab={props.isKebab}
                text={t('actions')}
                actions={actions}
            />
        </>
    )
}

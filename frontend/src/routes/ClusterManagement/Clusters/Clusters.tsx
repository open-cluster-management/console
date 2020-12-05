import {
    AcmEmptyState,
    AcmLabels,
    AcmPageCard,
    AcmTable,
    IAcmTableColumn,
} from '@open-cluster-management/ui-components'
import { Dropdown, DropdownItem, DropdownToggle } from '@patternfly/react-core'
import CaretDownIcon from '@patternfly/react-icons/dist/js/icons/caret-down-icon'
import React, { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useHistory } from 'react-router-dom'
// import { deleteResource } from '../../../lib/resource-request'
import { useQuery } from '../../../lib/useQuery'
import { NavigationPath } from '../../../NavigationPath'
import { getAllClusters, mapClusters, Cluster } from '../../../lib/get-cluster'
import { deleteCluster, deleteClusters } from '../../../lib/delete-cluster'
import { usePageContext } from '../../ClusterManagement/ClusterManagement'
import { ClusterDeployment } from '../../../resources/cluster-deployment'
import { ManagedClusterInfo } from '../../../resources/managed-cluster-info'
import { CertificateSigningRequest } from '../../../resources/certificate-signing-requests'
import { StatusField, DistributionField } from '../../../components/ClusterCommon'
import { ClosedConfirmModalProps, ConfirmModal, IConfirmModalProps } from '../../../components/ConfirmModal'

const managedClusterCols: IAcmTableColumn<Cluster>[] = [
    {
        header: 'Name',
        sort: 'name',
        search: 'name',
        cell: (cluster) => (
            <Link to={NavigationPath.clusterDetails.replace(':id', cluster.name as string)}>{cluster.name}</Link>
        ),
    },
    {
        header: 'Status',
        sort: 'status',
        search: 'status',
        cell: (cluster) => <StatusField status={cluster.status} />,
    },
    {
        header: 'Distribution',
        sort: 'distribution.displayVersion',
        search: 'distribution.displayVersion',
        cell: (cluster) => <DistributionField data={cluster.distribution} />,
    },
    {
        header: 'Labels',
        // search: 'labels',
        cell: (cluster) => (cluster.labels ? <AcmLabels labels={cluster.labels} /> : '-'),
    },
    {
        header: 'Nodes',
        // sort: 'info.status.nodeList.length',
        cell: (cluster) => {
            return cluster.nodes?.active && cluster.nodes.active > 0 ? cluster.nodes.active : '-'
        },
    },
]

export default function ClustersPage() {
    return <ClustersPageContent />
}

const ClusterActions = () => {
    const [open, setOpen] = useState<boolean>(false)
    const { push } = useHistory()
    const { t } = useTranslation(['cluster'])
    return (
        <Dropdown
            isOpen={open}
            toggle={
                <DropdownToggle
                    onToggle={() => setOpen(!open)}
                    toggleIndicator={CaretDownIcon}
                    isPrimary
                    id="cluster-actions"
                >
                    {t('managed.addCluster')}
                </DropdownToggle>
            }
            dropdownItems={[
                <DropdownItem
                    key="create"
                    component={Link}
                    onClick={() => push(NavigationPath.createCluster)}
                    id="create-cluster"
                >
                    {t('managed.createCluster')}
                </DropdownItem>,
                <DropdownItem
                    key="import"
                    component={Link}
                    onClick={() => push(NavigationPath.importCluster)}
                    id="import-cluster"
                >
                    {t('managed.importCluster')}
                </DropdownItem>,
            ]}
        />
    )
}

export function ClustersPageContent() {
    const { data, startPolling, refresh } = useQuery(getAllClusters)
    useEffect(startPolling, [startPolling])
    usePageContext(!!data, ClusterActions)

    const items = data?.map((d) => {
        if (d.status === 'fulfilled') {
            return d.value
        } else {
            console.error(d.reason)
            return []
        }
    })

    let clusters: Cluster[] | undefined
    if (items) {
        clusters = mapClusters(
            items[0] as ClusterDeployment[],
            items[1] as ManagedClusterInfo[],
            items[2] as CertificateSigningRequest[]
        )
    }

    return (
        <AcmPageCard>
            <ClustersTable clusters={clusters} refresh={refresh} />
        </AcmPageCard>
    )
}

export function ClustersTable(props: {
    clusters?: Cluster[]
    deleteCluster?: (managedCluster: Cluster) => void
    refresh: () => void
}) {
    sessionStorage.removeItem('DiscoveredClusterName')
    sessionStorage.removeItem('DiscoveredClusterConsoleURL')

    const { t } = useTranslation(['cluster'])
    
    const [confirm, setConfirm] = useState<IConfirmModalProps>(ClosedConfirmModalProps)
    const [errors, setErrors] = useState<string[]>([])

    function mckeyFn(cluster: Cluster) {
        return cluster.name!
    }

    return (
        <Fragment>
            <ConfirmModal
                open={confirm.open}
                confirm={confirm.confirm}
                cancel={confirm.cancel}
                title={confirm.title}
                message={confirm.message}
            ></ConfirmModal>
            <AcmTable<Cluster>
                plural="clusters"
                items={props.clusters}
                columns={managedClusterCols}
                keyFn={mckeyFn}
                key="managedClustersTable"
                tableActions={[]}
                bulkActions={[
                    {
                        id: 'destroyCluster',
                        title: t('managed.destroy'),
                        click: (clusters) => {
                            setConfirm({
                                title: t('modal.delete.title'),
                                message: `You are about to destroy ${clusters.length} managed clusters. This action is irreversible.`,
                                open: true,
                                confirm: async () => {
                                    const clusterNames = clusters.map(
                                        (cluster) => cluster.name
                                    ) as Array<string>
                                    const promiseResults = await deleteClusters(clusterNames, true)
                                    const resultErrors: string[] = []
                                    promiseResults.promise.then((results)=>{
                                        results.forEach((result)=>{
                                            if(result.status === 'rejected'){
                                                resultErrors.push(`Failed to destroy managed cluster. ${result.reason}`)
                                            }
                                        })
                                    })
                                    setErrors([...errors, ...resultErrors])
                                    setConfirm(ClosedConfirmModalProps)
                                    props.refresh()
                                },
                                cancel: () => {
                                    setConfirm(ClosedConfirmModalProps)
                                },
                            })
                            props.refresh()

                        },
                        
                    },
                    {
                        id: 'detachCluster',
                        title: t('managed.detachSelected'),
                        click: (managedClusters) => {
                            setConfirm({
                                title: t('modal.detach.title'),
                                message: `You are about to detach ${managedClusters.length} managed clusters. This action is irreversible.`,
                                open: true,
                                confirm: async () => {

                                    const managedClusterNames = managedClusters.map(
                                        (managedCluster) => managedCluster.name
                                    ) as Array<string>
                                    const promiseResults = await deleteClusters(managedClusterNames, false)
                                    const resultErrors: string[] = []
                                    promiseResults.promise.then((results)=>{
                                        results.forEach((result)=>{
                                            if(result.status === 'rejected'){
                                                resultErrors.push(`Failed to detach managed cluster. ${result.reason}`)
                                            }
                                        })
                                    })
                                    setErrors([...errors, ...resultErrors])
                                    setConfirm(ClosedConfirmModalProps)
                                    props.refresh()
                                },
                                cancel: () => {
                                    setConfirm(ClosedConfirmModalProps)
                                },
                            })
                            props.refresh()
                        },
                    },
                    { id: 'upgradeClusters', title: t('managed.upgradeSelected'), click: (managedClusters) => {} },
                ]}
                rowActions={[
                    { id: 'editLabels', title: t('managed.editLabels'), click: (managedCluster) => {} },
                    { id: 'launchToCluster', title: t('managed.launch'), click: (managedCluster) => {} },
                    { id: 'upgradeCluster', title: t('managed.upgrade'), click: (managedCluster) => {} },
                    { id: 'searchCluster', title: t('managed.search'), click: (managedCluster) => {} },
                    { id: 'detachCluster', title: t('managed.detached'), click: (managedCluster) => {
                        //
                        setConfirm({
                            title: t('modal.delete.title'),
                            message: `You are about to detach ${managedCluster.name}. This action is irreversible.`,
                            open: true,
                            confirm: () => {
                                deleteCluster(managedCluster.name!, false)
                                    .promise.then(props.refresh)
                                    .catch(() => {
                                        setErrors([
                                            ...errors,
                                            `Failed to detach managed cluster named ${managedCluster.name}`,
                                        ])
                                    })
                                setConfirm(ClosedConfirmModalProps)
                            },
                            cancel: () => {
                                setConfirm(ClosedConfirmModalProps)
                            },
                        })
                        props.refresh()
                    } },
                    { id: 'destroyCluster', title: t('managed.destroySelected'), click: (managedCluster) => {
                        setConfirm({
                            title: t('modal.delete.title'),
                            message: `You are about to destroy ${managedCluster.name}. This action is irreversible.`,
                            open: true,
                            confirm: () => {
                                deleteCluster(managedCluster.name!, true)
                                    .promise.then(props.refresh)
                                    .catch(() => {
                                        setErrors([
                                            ...errors,
                                            `Failed to destroy managed cluster named ${managedCluster.name}`,
                                        ])
                                    })
                                setConfirm(ClosedConfirmModalProps)
                            },
                            cancel: () => {
                                setConfirm(ClosedConfirmModalProps)
                            },
                        })
                        props.refresh()
                    } },
                ]}
                emptyState={<AcmEmptyState title={t('managed.emptyStateHeader')} key="mcEmptyState" />}
            />
        </Fragment>
    )
}

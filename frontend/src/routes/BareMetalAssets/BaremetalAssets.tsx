import {
    AcmLabels,
    AcmLoadingPage,
    AcmPageCard,
    AcmTable,
    AcmEmptyState,
    AcmPageHeader,
} from '@open-cluster-management/ui-components'
import { Page } from '@patternfly/react-core'
import React, { useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ClosedConfirmModalProps, ConfirmModal, IConfirmModalProps } from '../../components/ConfirmModal'
import { ErrorPage } from '../../components/ErrorPage'
import {
    listBareMetalAssets,
    BareMetalAsset,
    BMAStatusMessage,
    GetLabels,
} from '../../../src/resources/bare-metal-asset'
import { useQuery } from '../../lib/useQuery'
import { deleteResource, IRequestResult } from '../../lib/resource-request'
import { deleteResources } from '../../lib/delete-resources'
import { NavigationPath } from '../../NavigationPath'

export default function BareMetalAssetsPage() {
    return (
        <Page>
            <AcmPageHeader title={'Bare-metal Assets'} />
            <BareMetalAssets />
        </Page>
    )
}

export function BareMetalAssets() {
    const { data, loading, error, startPolling, stopPolling } = useQuery(listBareMetalAssets)
    useEffect(() => {
        startPolling(5 * 1000)
        return stopPolling
    }, [startPolling, stopPolling])
    const { t } = useTranslation(['bma'])

    if (loading) {
        return <AcmLoadingPage />
    } else if (error) {
        return <ErrorPage error={error} />
    } else if (!data || data.length === 0) {
        return (
            <AcmPageCard>
                <AcmEmptyState
                    title={t('bareMetalAsset.emptyState.title')}
                    message={t('bareMetalAsset.emptyState.title')}
                />
            </AcmPageCard>
        )
    }

    return <BareMetalAssetsTable bareMetalAssets={data} deleteBareMetalAsset={deleteResource}></BareMetalAssetsTable>
}
// TODO: use deleteResources instead of deleteResource
export function deleteBareMetalAssets(
    bareMetalAssets: BareMetalAsset[],
) {
    const promises: Array<Promise<any>> = []

    Promise.all(deleteResources(bareMetalAssets))
}

export function BareMetalAssetsTable(props: {
    bareMetalAssets: BareMetalAsset[]
    deleteBareMetalAsset: (bareMetalAsset: BareMetalAsset) => IRequestResult
}) {
    const [confirm, setConfirm] = useState<IConfirmModalProps>(ClosedConfirmModalProps)
    const history = useHistory()
    const { t } = useTranslation(['bma'])

    function keyFn(bareMetalAsset: BareMetalAsset) {
        return bareMetalAsset.metadata.uid as string
    }

    return (
        <AcmPageCard>
            <ConfirmModal
                open={confirm.open}
                confirm={confirm.confirm}
                cancel={confirm.cancel}
                title={confirm.title}
                message={confirm.message}
            ></ConfirmModal>
            <AcmTable<BareMetalAsset>
                emptyState={<AcmEmptyState title={t('bareMetalAsset.emptyState.title')} />}
                plural="bare metal assets"
                items={props.bareMetalAssets}
                columns={[
                    {
                        header: t('bareMetalAsset.tableHeader.name'),
                        cell: 'metadata.name',
                        sort: 'metadata.name',
                        search: 'metadata.name',
                    },
                    {
                        header: t('bareMetalAsset.tableHeader.namespace'),
                        cell: 'metadata.namespace',
                        search: 'metadata.namespace',
                    },
                    {
                        header: t('bareMetalAsset.tableHeader.cluster'),
                        cell: 'metal3.io/cluster-deployment-name',
                        search: 'metal3.io/cluster-deployment-name',
                    },
                    {
                        header: t('bareMetalAsset.tableHeader.role'),
                        cell: 'metadata.labels.metal3.io/role',
                        search: 'metadata.labels.metal3.io/role',
                    },
                    {
                        header: t('bareMetalAsset.tableHeader.status'),
                        cell: (bareMetalAssets) => {
                            return BMAStatusMessage(bareMetalAssets, t)
                        },
                    },
                    {
                        header: t('bareMetalAsset.tableHeader.labels'),
                        cell: (bareMetalAssets) => {
                            const labels = GetLabels(bareMetalAssets)
                            return <AcmLabels labels={labels} />
                        },
                    },
                ]}
                keyFn={keyFn}
                tableActions={[
                    {
                        id: 'createAsset',
                        title: t('bareMetalAsset.bulkAction.createAsset'),
                        click: () => {
                            history.push(NavigationPath.createBareMetalAssets)
                        },
                    },
                ]}
                bulkActions={[
                    {
                        id: 'destroyBareMetalAsset',
                        title: t('bareMetalAsset.bulkAction.destroyAsset'),
                        click: (bareMetalAssets: BareMetalAsset[]) => {
                            setConfirm({
                                title: t('bareMetalAsset.modal.deleteMultiple.title'),
                                message: t('bareMetalAsset.modal.deleteMultiple.message', {
                                    assetNum: bareMetalAssets.length,
                                }),
                                open: true,
                                confirm: () => {
                                    deleteBareMetalAssets(bareMetalAssets, props.deleteBareMetalAsset)
                                    setConfirm(ClosedConfirmModalProps)
                                },
                                cancel: () => {
                                    setConfirm(ClosedConfirmModalProps)
                                },
                            })
                        },
                    },
                    {
                        id: 'createBareMetalAssetCluster',
                        title: t('bareMetalAsset.bulkAction.createCluster'),
                        click: (items) => {},
                    },
                ]}
                rowActions={[
                    { id: 'editLabels', title: t('bareMetalAsset.rowAction.editLabels.title'), click: (item) => {} },
                    { id: 'editAsset', title: t('bareMetalAsset.rowAction.editAsset.title'), click: (item) => {} },
                    {
                        id: 'deleteAsset',
                        title: t('bareMetalAsset.rowAction.deleteAsset.title'),
                        click: (bareMetalAsset: BareMetalAsset) => {
                            setConfirm({
                                title: t('bareMetalAsset.modal.delete.title'),
                                message: t('bareMetalAsset.modal.delete.message', {
                                    assetName: bareMetalAsset.metadata?.name,
                                }),
                                open: true,
                                confirm: () => {
                                    props.deleteBareMetalAsset(bareMetalAsset)
                                    setConfirm(ClosedConfirmModalProps)
                                },
                                cancel: () => {
                                    setConfirm(ClosedConfirmModalProps)
                                },
                            })
                        },
                    },
                ]}
            />
        </AcmPageCard>
    )
}

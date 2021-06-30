/* Copyright Contributors to the Open Cluster Management project */

import {
    AcmButton,
    AcmEmptyState,
    AcmPage,
    AcmPageContent,
    AcmPageHeader,
    AcmRoute,
    AcmTable,
} from '@open-cluster-management/ui-components'
import { ActionList, ActionListItem, Bullseye, PageSection, ButtonVariant } from '@patternfly/react-core'
import { fitContent } from '@patternfly/react-table'
import { Fragment, useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { acmRouteState, bareMetalAssetsState } from '../../../atoms'
import { BulkActionModel, IBulkActionModelProps } from '../../../components/BulkActionModel'
import { RbacDropdown } from '../../../components/Rbac'
import { importBMAs } from '../../../lib/bare-metal-assets'
import { deleteResources } from '../../../lib/delete-resources'
import { DOC_LINKS } from '../../../lib/doc-util'
import { canUser, rbacDelete, rbacPatch } from '../../../lib/rbac-util'
import { deleteResource, IRequestResult } from '../../../lib/resource-request'
import { NavigationPath } from '../../../NavigationPath'
import {
    BareMetalAsset,
    BareMetalAssetConditionReasons,
    BareMetalAssetConditionTypes,
    createBareMetalAssetNamespaces,
    importBareMetalAsset,
    ImportedBareMetalAsset,
} from '../../../resources/bare-metal-asset'
import { ManagedClusterDefinition } from '../../../resources/managed-cluster'

export default function BareMetalAssetsPage() {
    const [, setRoute] = useRecoilState(acmRouteState)
    useEffect(() => setRoute(AcmRoute.BareMetalAssets), [setRoute])

    const [bareMetalAssets] = useRecoilState(bareMetalAssetsState)
    const { t } = useTranslation(['bma', 'common'])

    return (
        <AcmPage
            hasDrawer
            header={
                <AcmPageHeader
                    title={t('bma:bmas')}
                    titleTooltip={
                        <>
                            {t('bma:bmas.tooltip')}
                            <a
                                href={DOC_LINKS.BARE_METAL_ASSETS}
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: 'block', marginTop: '4px' }}
                            >
                                {t('common:learn.more')}
                            </a>
                        </>
                    }
                />
            }
        >
            <AcmPageContent id="bare-metal-assets">
                <PageSection>
                    <BareMetalAssetsTable bareMetalAssets={bareMetalAssets} deleteBareMetalAsset={deleteResource} />
                </PageSection>
            </AcmPageContent>
        </AcmPage>
    )
}

export function deleteBareMetalAssets(bareMetalAssets: BareMetalAsset[]) {
    return deleteResources(bareMetalAssets).promise
}

export function BareMetalAssetsTable(props: {
    bareMetalAssets?: BareMetalAsset[]
    deleteBareMetalAsset: (bareMetalAsset: BareMetalAsset) => IRequestResult
}) {
    const [canCreateCluster, setCanCreateCluster] = useState<boolean>(true)
    const [modalProps, setModalProps] = useState<IBulkActionModelProps<BareMetalAsset> | { open: false }>({
        open: false,
    })
    const [importedProps, setImportedProps] = useState<IBulkActionModelProps<ImportedBareMetalAsset> | { open: false }>(
        { open: false }
    )
    const history = useHistory()
    const { t } = useTranslation(['bma', 'common'])

    useEffect(() => {
        const canCreateManagedCluster = canUser('create', ManagedClusterDefinition)
        canCreateManagedCluster.promise
            .then((result) => setCanCreateCluster(result.status?.allowed!))
            .catch((err) => console.error(err))
        return () => canCreateManagedCluster.abort()
    }, [])

    function keyFn(bareMetalAsset: BareMetalAsset) {
        return bareMetalAsset.metadata.uid as string
    }

    function setImportModalProps() {
        setImportedProps({
            open: true,
            icon: 'default',
            title: t('bulk.title.import'),
            action: t('common:import'),
            processing: '',
            description: '',
            keyFn: (bareMetalAsset: ImportedBareMetalAsset) => bareMetalAsset.uid as string,
            actionFn: (bareMetalAsset: ImportedBareMetalAsset) => importBareMetalAsset(bareMetalAsset),
            resources: [],
            columns: [{ header: '', cell: '' }],
            close: () => setImportedProps({ open: false }),
            emptyState: (
                <AcmEmptyState
                    title={t('bareMetalAsset.importAction.title')}
                    message={t('bareMetalAsset.importAction.message')}
                    showIcon={false}
                    action={
                        <AcmButton
                            id="import-button"
                            variant="primary"
                            onClick={async () => {
                                const result = await importBMAs()
                                setImportedProps({
                                    open: true,
                                    icon: 'default',
                                    title: t('bulk.title.import'),
                                    action: t('common:import'),
                                    processing: t('common:importing'),
                                    description: t('modal.import.content.batch'),
                                    resources: result,
                                    columns: [
                                        {
                                            header: t('bareMetalAsset.tableHeader.name'),
                                            cell: 'name',
                                            sort: 'name',
                                        },
                                        {
                                            header: t('bareMetalAsset.tableHeader.namespace'),
                                            cell: 'namespace',
                                            sort: 'namespace',
                                        },
                                        {
                                            header: t('bareMetalAsset.tableHeader.macaddress'),
                                            cell: 'bootMACAddress',
                                            sort: 'bootMACAddress',
                                        },
                                        {
                                            header: t('bareMetalAsset.tableHeader.address'),
                                            cell: 'bmc.address',
                                            sort: 'bmc.address',
                                        },
                                    ],
                                    keyFn: (bareMetalAsset: ImportedBareMetalAsset) => bareMetalAsset.uid as string,
                                    preActionFn: async (bareMetalAssets: ImportedBareMetalAsset[], errors) => {
                                        const responses = await createBareMetalAssetNamespaces(bareMetalAssets)
                                        responses.forEach((response) => {
                                            if (response.status === 'rejected') {
                                                if (response.reason.code !== 409) {
                                                    errors.push({
                                                        error: response.reason.message,
                                                        item: bareMetalAssets[0],
                                                    })
                                                }
                                            }
                                        })
                                    },
                                    actionFn: (bareMetalAsset: ImportedBareMetalAsset) =>
                                        importBareMetalAsset(bareMetalAsset),
                                    close: () => {
                                        setImportedProps({ open: false })
                                    },
                                })
                            }}
                        >
                            {t('bareMetalAsset.importAction.button')}
                        </AcmButton>
                    }
                />
            ),
        })
    }

    return (
        <Fragment>
            <BulkActionModel<BareMetalAsset> {...modalProps} />
            <BulkActionModel<ImportedBareMetalAsset> {...importedProps} />
            <AcmTable<BareMetalAsset>
                emptyState={
                    <AcmEmptyState
                        title={t('bareMetalAsset.emptyState.title')}
                        message={
                            <Trans
                                i18nKey={'bma:bareMetalAsset.emptyState.subtitle'}
                                components={{ bold: <strong /> }}
                            />
                        }
                        action={
                            <Bullseye>
                                <ActionList>
                                    <ActionListItem>
                                        <AcmButton
                                            variant="primary"
                                            onClick={() => {
                                                history.push(NavigationPath.createBareMetalAsset)
                                            }}
                                        >
                                            {t('createBareMetalAsset.title')}
                                        </AcmButton>
                                    </ActionListItem>
                                    <ActionListItem>
                                        <AcmButton
                                            variant="primary"
                                            onClick={() => {
                                                setImportModalProps()
                                            }}
                                        >
                                            {t('importBareMetalAssets.title')}
                                        </AcmButton>
                                    </ActionListItem>
                                </ActionList>
                            </Bullseye>
                        }
                    />
                }
                plural="bare metal assets"
                items={props.bareMetalAssets}
                columns={[
                    {
                        header: t('bareMetalAsset.tableHeader.name'),
                        sort: 'metadata.name',
                        search: 'metadata.name',
                        cell: (bareMetalAsset) => (
                            <span style={{ whiteSpace: 'nowrap' }}>
                                <Link
                                    to={NavigationPath.editBareMetalAsset
                                        .replace(':namespace', bareMetalAsset.metadata.namespace as string)
                                        .replace(':name', bareMetalAsset.metadata.name as string)}
                                >
                                    {bareMetalAsset.metadata.name}
                                </Link>
                            </span>
                        ),
                    },
                    {
                        header: t('bareMetalAsset.tableHeader.namespace'),
                        cell: 'metadata.namespace',
                        search: 'metadata.namespace',
                    },
                    {
                        header: t('bareMetalAsset.tableHeader.cluster'),
                        cell: (bareMetalAsset: BareMetalAsset) =>
                            bareMetalAsset.metadata.labels?.['metal3.io/cluster-deployment-name'] || '-',
                        search: 'metal3.io/cluster-deployment-name',
                    },
                    {
                        header: t('bareMetalAsset.tableHeader.role'),
                        cell: (bareMetalAsset: BareMetalAsset) =>
                            bareMetalAsset.metadata.labels?.['metal3.io/role'] || '-',
                        search: 'metal3.io/role',
                    },
                    {
                        header: t('bareMetalAsset.tableHeader.status'),
                        cell: (bareMetalAsset) => {
                            if (bareMetalAsset.status) {
                                let mostCurrentStatusTime = new Date(
                                    bareMetalAsset.status!.conditions[0].lastTransitionTime
                                )
                                let mostCurrentStatus = bareMetalAsset.status!.conditions[0].type
                                let mostCurrentReason = bareMetalAsset.status.conditions[0].reason
                                for (const conditions of bareMetalAsset.status!.conditions) {
                                    if (
                                        new Date(conditions.lastTransitionTime).getTime() >
                                        mostCurrentStatusTime!.getTime()
                                    ) {
                                        mostCurrentStatusTime = new Date(conditions.lastTransitionTime)
                                        mostCurrentStatus = conditions.type
                                        mostCurrentReason = conditions.reason
                                    }
                                    // if status time is equivalent, take the status at that was added last
                                    else if (
                                        new Date(conditions.lastTransitionTime).getTime() ===
                                        mostCurrentStatusTime.getTime()
                                    ) {
                                        mostCurrentStatusTime = new Date(conditions.lastTransitionTime)
                                        mostCurrentStatus = conditions.type
                                        mostCurrentReason = conditions.reason
                                    }
                                }

                                if (
                                    mostCurrentReason === BareMetalAssetConditionReasons.NoneSpecified &&
                                    mostCurrentStatus === BareMetalAssetConditionTypes.ConditionClusterDeploymentFound
                                )
                                    return t('bareMetalAsset.statusMessage.clusterDeploymentNameNotFound')
                                else return t(`bareMetalAsset.statusMessage.${mostCurrentReason}`)
                            }
                            return ''
                        },
                    },
                    {
                        header: '',
                        cellTransforms: [fitContent],
                        cell: (bareMetalAsset) => {
                            const actions = [
                                {
                                    id: 'editAsset',
                                    text: t('bareMetalAsset.rowAction.editAsset.title'),
                                    isDisabled: true,
                                    click: (bareMetalAsset: BareMetalAsset) => {
                                        history.push(
                                            NavigationPath.editBareMetalAsset.replace(
                                                ':namespace/:name',
                                                `${bareMetalAsset.metadata?.namespace}/${bareMetalAsset.metadata?.name}` as string
                                            )
                                        )
                                    },
                                    rbac: [rbacPatch(bareMetalAsset)],
                                },
                                {
                                    id: 'deleteAsset',
                                    text: t('bareMetalAsset.rowAction.deleteAsset.title'),
                                    isDisabled: true,
                                    click: (bareMetalAsset: BareMetalAsset) => {
                                        setModalProps({
                                            open: true,
                                            title: t('bulk.title.delete'),
                                            action: t('common:delete'),
                                            processing: t('common:deleting'),
                                            resources: [bareMetalAsset],
                                            description: t('bulk.message.delete'),
                                            columns: [
                                                {
                                                    header: t('bareMetalAsset.tableHeader.name'),
                                                    cell: 'metadata.name',
                                                    sort: 'metadata.name',
                                                },
                                                {
                                                    header: t('bareMetalAsset.tableHeader.namespace'),
                                                    cell: 'metadata.namespace',
                                                    sort: 'metadata.namespace',
                                                },
                                            ],
                                            keyFn: (bareMetalAsset: BareMetalAsset) =>
                                                bareMetalAsset.metadata.uid as string,
                                            actionFn: (bareMetalAsset: BareMetalAsset) =>
                                                deleteResource(bareMetalAsset),
                                            close: () => {
                                                setModalProps({ open: false })
                                            },
                                            isDanger: true,
                                            icon: 'warning',
                                        })
                                    },
                                    rbac: [rbacDelete(bareMetalAsset)],
                                },
                            ]

                            return (
                                <RbacDropdown<BareMetalAsset>
                                    id={`${bareMetalAsset.metadata.name}-actions`}
                                    item={bareMetalAsset}
                                    isKebab={true}
                                    text={`${bareMetalAsset.metadata.name}-actions`}
                                    actions={actions}
                                />
                            )
                        },
                    },
                ]}
                keyFn={keyFn}
                tableActions={[
                    {
                        id: 'createAsset',
                        title: t('bareMetalAsset.bulkAction.createAsset'),
                        click: () => history.push(NavigationPath.createBareMetalAsset),
                    },
                    {
                        id: 'importAsset',
                        title: t('bareMetalAsset.bulkAction.importAssets'),
                        variant: ButtonVariant.secondary,
                        click: () => setImportModalProps(),
                    },
                ]}
                bulkActions={[
                    {
                        id: 'deleteBareMetalAsset',
                        title: t('bareMetalAsset.bulkAction.deleteAsset'),
                        click: (bareMetalAssets: BareMetalAsset[]) => {
                            setModalProps({
                                open: true,
                                title: t('bulk.title.delete'),
                                action: t('common:delete'),
                                processing: t('common:deleting'),
                                resources: [...bareMetalAssets],
                                description: t('bulk.message.delete'),
                                columns: [
                                    {
                                        header: t('bareMetalAsset.tableHeader.name'),
                                        cell: 'metadata.name',
                                        sort: 'metadata.name',
                                    },
                                    {
                                        header: t('bareMetalAsset.tableHeader.namespace'),
                                        cell: 'metadata.namespace',
                                        sort: 'metadata.namespace',
                                    },
                                ],
                                keyFn: (bareMetalAsset: BareMetalAsset) => bareMetalAsset.metadata.uid as string,
                                actionFn: (bareMetalAsset: BareMetalAsset) => deleteResource(bareMetalAsset),
                                close: () => {
                                    setModalProps({ open: false })
                                },
                                isDanger: true,
                                icon: 'warning',
                            })
                        },
                    },
                    {
                        id: 'createBareMetalAssetCluster',
                        title: t('bareMetalAsset.bulkAction.createCluster'),
                        click: (items) => {
                            const params = new URLSearchParams()
                            const bmaIDs = items.map((bma) => bma.metadata.uid)
                            params.set('bmas', bmaIDs.join(','))
                            history.push(`${NavigationPath.createCluster}?${params}`)
                        },
                        isDisabled: !canCreateCluster,
                        tooltip: !canCreateCluster ? t('common:rbac.unauthorized') : '',
                    },
                ]}
                rowActions={[]}
            />
        </Fragment>
    )
}

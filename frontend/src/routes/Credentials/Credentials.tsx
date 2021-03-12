/* Copyright Contributors to the Open Cluster Management project */

import {
    AcmButton,
    AcmEmptyState,
    AcmInlineProvider,
    AcmPage,
    AcmPageHeader,
    AcmScrollable,
    AcmTable,
    AcmTablePaginationContextProvider,
    compareStrings,
    Provider,
} from '@open-cluster-management/ui-components'
import { PageSection } from '@patternfly/react-core'
import { fitContent } from '@patternfly/react-table'
import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { discoveryConfigState, providerConnectionsState } from '../../atoms'
import { BulkActionModel, IBulkActionModelProps } from '../../components/BulkActionModel'
import { RbacDropdown } from '../../components/Rbac'
import { getProviderByKey, ProviderID } from '../../lib/providers'
import { getResourceAttributes } from '../../lib/rbac-util'
import { deleteResource } from '../../lib/resource-request'
import { NavigationPath } from '../../NavigationPath'
import { DiscoveryConfig } from '../../resources/discovery-config'
import { ProviderConnection, ProviderConnectionDefinition } from '../../resources/provider-connection'

export default function CredentialsPage() {
    const { t } = useTranslation(['connection'])
    const [providerConnections] = useRecoilState(providerConnectionsState)
    const [discoveryConfigs] = useRecoilState(discoveryConfigState)
    return (
        <AcmPage>
            <AcmPageHeader title={t('manageCredentials')} />
            <AcmScrollable borderTop>
                <PageSection variant="light" isFilled={true}>
                    <AcmTablePaginationContextProvider localStorageKey="table-provider-connections">
                        <ProviderConnectionsTable
                            providerConnections={providerConnections}
                            discoveryConfigs={discoveryConfigs}
                        />
                    </AcmTablePaginationContextProvider>
                </PageSection>
            </AcmScrollable>
        </AcmPage>
    )
}

// Ingoring coverage since this will move one the console header navigation is done
/* istanbul ignore next */
const AddConnectionBtn = () => {
    const { t } = useTranslation(['connection'])
    return (
        <AcmButton component={Link} to={NavigationPath.addCredentials}>
            {t('add')}
        </AcmButton>
    )
}

function getProvider(labels: Record<string, string> | undefined) {
    const label = labels?.['cluster.open-cluster-management.io/provider']
    const provider = getProviderByKey(label as ProviderID)
    return provider.name
}

export function ProviderConnectionsTable(props: {
    providerConnections?: ProviderConnection[]
    discoveryConfigs?: DiscoveryConfig[]
}) {
    const { t } = useTranslation(['connection', 'common'])
    const history = useHistory()
    const [modalProps, setModalProps] = useState<IBulkActionModelProps<ProviderConnection> | { open: false }>({
        open: false,
    })

    var discoveryEnabled = false
    if (props.discoveryConfigs) {
        props.discoveryConfigs.forEach((discoveryConfig) => {
            if (discoveryConfig.spec.providerConnections && discoveryConfig.spec.providerConnections.length > 0) {
                discoveryEnabled = true
            }
        })
    }

    function getAdditionalActions(item: ProviderConnection) {
        const label = item.metadata.labels?.['cluster.open-cluster-management.io/provider']
        if (label === ProviderID.CRH && !discoveryEnabled) {
            return t('connections.actions.enableClusterDiscovery')
        }
        return '-'
    }

    return (
        <Fragment>
            <BulkActionModel<ProviderConnection> {...modalProps} />
            <AcmTable<ProviderConnection>
                emptyState={
                    <AcmEmptyState
                        title={t('empty.title')}
                        message={t('empty.subtitle')}
                        action={<AddConnectionBtn />}
                    />
                }
                plural={t('connections')}
                items={props.providerConnections}
                columns={[
                    {
                        header: t('table.header.name'),
                        sort: 'metadata.name',
                        search: 'metadata.name',
                        cell: (providerConnection) => (
                            <span style={{ whiteSpace: 'nowrap' }}>
                                <Link
                                    to={NavigationPath.editCredentials
                                        .replace(':namespace', providerConnection.metadata.namespace as string)
                                        .replace(':name', providerConnection.metadata.name as string)}
                                >
                                    {providerConnection.metadata.name}
                                </Link>
                            </span>
                        ),
                    },
                    {
                        header: t('table.header.additionalActions'),
                        search: (item: ProviderConnection) => {
                            return getAdditionalActions(item)
                        },
                        cell: (item: ProviderConnection) => {
                            const label = item.metadata.labels?.['cluster.open-cluster-management.io/provider']
                            if (label === ProviderID.CRH && !discoveryEnabled) {
                                return (
                                    <Link to={NavigationPath.discoveryConfig}>
                                        {t('connections.actions.enableClusterDiscovery')}
                                    </Link>
                                )
                            } else {
                                return <span>-</span>
                            }
                        },
                        sort: /* istanbul ignore next */ (a: ProviderConnection, b: ProviderConnection) => {
                            return compareStrings(getAdditionalActions(a), getAdditionalActions(b))
                        },
                    },
                    {
                        header: t('table.header.provider'),
                        sort: /* istanbul ignore next */ (a: ProviderConnection, b: ProviderConnection) => {
                            return compareStrings(getProvider(a.metadata?.labels), getProvider(b.metadata?.labels))
                        },
                        cell: (item: ProviderConnection) => {
                            const label = item.metadata.labels?.['cluster.open-cluster-management.io/provider']
                            let provider
                            switch (label) {
                                case ProviderID.GCP:
                                    provider = Provider.gcp
                                    break
                                case ProviderID.AWS:
                                    provider = Provider.aws
                                    break
                                case ProviderID.AZR:
                                    provider = Provider.azure
                                    break
                                case ProviderID.VMW:
                                    provider = Provider.vmware
                                    break
                                case ProviderID.BMC:
                                    provider = Provider.baremetal
                                    break
                                case ProviderID.CRH:
                                    provider = Provider.redhatcloud
                                    break
                                case ProviderID.UKN:
                                default:
                                    provider = Provider.other
                            }
                            return <AcmInlineProvider provider={provider} />
                        },
                        search: (item: ProviderConnection) => {
                            return getProvider(item.metadata?.labels)
                        },
                    },
                    {
                        header: t('table.header.namespace'),
                        sort: 'metadata.namespace',
                        search: 'metadata.namespace',
                        cell: 'metadata.namespace',
                    },
                    {
                        header: '',
                        cellTransforms: [fitContent],
                        cell: (providerConnection: ProviderConnection) => {
                            const actions = [
                                {
                                    id: 'editConnection',
                                    text: t('edit'),
                                    isDisabled: true,
                                    click: (providerConnection: ProviderConnection) => {
                                        history.push(
                                            NavigationPath.editCredentials
                                                .replace(':namespace', providerConnection.metadata.namespace!)
                                                .replace(':name', providerConnection.metadata.name!)
                                        )
                                    },
                                    rbac: [
                                        getResourceAttributes(
                                            'patch',
                                            ProviderConnectionDefinition,
                                            providerConnection.metadata.namespace,
                                            providerConnection.metadata.name
                                        ),
                                    ],
                                },
                                {
                                    id: 'deleteConnection',
                                    text: t('delete'),
                                    isDisabled: true,
                                    click: (providerConnection: ProviderConnection) => {
                                        setModalProps({
                                            open: true,
                                            singular: t('connection'),
                                            plural: t('connections'),
                                            action: t('common:delete'),
                                            processing: t('common:deleting'),
                                            resources: [providerConnection],
                                            description: t('modal.delete.content.batch'),
                                            columns: [
                                                {
                                                    header: t('table.header.name'),
                                                    cell: 'metadata.name',
                                                    sort: 'metadata.name',
                                                },
                                                {
                                                    header: t('table.header.namespace'),
                                                    cell: 'metadata.namespace',
                                                    sort: 'metadata.namespace',
                                                },
                                            ],
                                            keyFn: (providerConnection: ProviderConnection) =>
                                                providerConnection.metadata.uid as string,
                                            actionFn: deleteResource,
                                            close: () => setModalProps({ open: false }),
                                            isDanger: true,
                                        })
                                    },
                                    rbac: [
                                        getResourceAttributes(
                                            'delete',
                                            ProviderConnectionDefinition,
                                            providerConnection.metadata.namespace,
                                            providerConnection.metadata.name
                                        ),
                                    ],
                                },
                            ]

                            return (
                                <RbacDropdown<ProviderConnection>
                                    id={`${providerConnection.metadata.name}-actions`}
                                    item={providerConnection}
                                    isKebab={true}
                                    text={`${providerConnection.metadata.name}-actions`}
                                    actions={actions}
                                />
                            )
                        },
                    },
                ]}
                keyFn={(providerConnection) => providerConnection.metadata?.uid as string}
                tableActions={[
                    {
                        id: 'add',
                        title: t('add'),
                        click: () => {
                            history.push(NavigationPath.addCredentials)
                        },
                    },
                ]}
                bulkActions={[
                    {
                        id: 'deleteConnection',
                        title: t('delete.batch'),
                        click: (providerConnections: ProviderConnection[]) => {
                            setModalProps({
                                open: true,
                                singular: t('connection'),
                                plural: t('connections'),
                                action: t('common:delete'),
                                processing: t('common:deleting'),
                                resources: [...providerConnections],
                                description: t('modal.delete.content.batch'),
                                columns: [
                                    {
                                        header: t('table.header.name'),
                                        cell: 'metadata.name',
                                        sort: 'metadata.name',
                                    },
                                    {
                                        header: t('table.header.namespace'),
                                        cell: 'metadata.namespace',
                                        sort: 'metadata.namespace',
                                    },
                                ],
                                keyFn: (providerConnection: ProviderConnection) =>
                                    providerConnection.metadata.uid as string,
                                actionFn: deleteResource,
                                close: () => setModalProps({ open: false }),
                                isDanger: true,
                            })
                        },
                    },
                ]}
                rowActions={[]}
            />
        </Fragment>
    )
}

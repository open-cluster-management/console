/* Copyright Contributors to the Open Cluster Management project */


import React, { useContext, useEffect, useState } from 'react'
import {
    AcmAlertContext,
    AcmAlertGroup,
    AcmAlertProvider,
    AcmSubmit,
    AcmButton,
    AcmForm,
    AcmLoadingPage,
    AcmPageCard,
    AcmPageHeader,
    AcmSelect,
    AcmFormSection,
    AcmMultiSelect,
} from '@open-cluster-management/ui-components'
import { Page, SelectOption, Text, TextVariants, ButtonVariant, ActionGroup } from '@patternfly/react-core'
import { useTranslation } from 'react-i18next'
import { useHistory } from 'react-router-dom'
import { ErrorPage } from '../../../components/ErrorPage'
import { NavigationPath } from '../../../NavigationPath'
import { Link } from 'react-router-dom'
import { ResourceErrorCode } from '../../../lib/resource-request'

import { listMultiClusterHubs } from '../../../resources/multi-cluster-hub'

import { listProviderConnections, ProviderConnection } from '../../../resources/provider-connection'
import {
    createDiscoveryConfig,
    replaceDiscoveryConfig,
    DiscoveryConfig,
    DiscoveryConfigApiVersion,
    DiscoveryConfigKind,
    listDiscoveryConfigs,
} from '../../../resources/discovery-config'

export default function DiscoveryConfigPage() {
    const { t } = useTranslation(['discovery'])
    return (
        <AcmAlertProvider>
            <Page>
                <AcmPageHeader
                    title={t('discoveryConfig.title')}
                    breadcrumb={[
                        { text: t('discoveredClusters'), to: NavigationPath.discoveredClusters },
                        { text: t('discoveryConfig.title'), to: '' },
                    ]}
                />
                <AddDiscoveryConfigData />
            </Page>
        </AcmAlertProvider>
    )
}

export function AddDiscoveryConfigData() {
    const { t } = useTranslation(['discovery', 'common'])
    const [error, setError] = useState<Error>()
    const [retry, setRetry] = useState(0)
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [providerConnections, setProviderConnections] = useState<ProviderConnection[]>([])

    const [discoveryConfig, setDiscoveryConfig] = useState<DiscoveryConfig>({
        apiVersion: DiscoveryConfigApiVersion,
        kind: DiscoveryConfigKind,
        metadata: {
            name: '',
            namespace: '',
        },
        spec: {
            filters: {
                lastActive: 0,
            },
            providerConnections: [],
        },
    })

    useEffect(() => {
        setIsLoading(true)
        const providerConnectionsResult = listProviderConnections().promise
        providerConnectionsResult
            .then((results) => {
                setProviderConnections(results)
                setIsLoading(false)
            })
            .catch((err) => {
                setError(err)
            })
    }, [])

    // Get Discovery Config if it exists
    useEffect(() => {
        setIsLoading(true)
        const discoveryConfigResult = listDiscoveryConfigs().promise
        discoveryConfigResult
            .then((results) => {
                if (results.length === 1) {
                    setDiscoveryConfig(results[0])
                } else if (results.length === 0) {
                    const result = listMultiClusterHubs()
                    return result.promise
                        .then((mch) => {
                            // only one mch can exist
                            if (mch.length === 1) {
                                const copy = { ...discoveryConfig }
                                copy.metadata.namespace = mch[0].metadata.namespace
                                setDiscoveryConfig(copy)
                            }
                        })
                        .catch((err) => {
                            setError(err)
                        })
                } else {
                    setError(Error('Only 1 DiscoveryConfig resource may exist'))
                }
            })
            .catch((err) => {
                if (err.code !== ResourceErrorCode.NotFound) {
                    setError(err)
                }
            })
            .finally(() => {
                setIsLoading(false)
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (error) {
        return (
            <ErrorPage
                error={error}
                actions={
                    <AcmButton
                        onClick={() => {
                            setRetry(retry + 1)
                        }}
                    >
                        {t('common:retry')}
                    </AcmButton>
                }
            />
        )
    }
    if (isLoading) {
        return <AcmLoadingPage />
    }

    return <DiscoveryConfigPageContent discoveryConfig={discoveryConfig} providerConnections={providerConnections} />
}

export function DiscoveryConfigPageContent(props: {
    discoveryConfig: DiscoveryConfig
    providerConnections: ProviderConnection[]
}) {
    const [discoveryConfig, setDiscoveryConfig] = useState<DiscoveryConfig>(props.discoveryConfig)
    const alertContext = useContext(AcmAlertContext)
    const { t } = useTranslation(['discovery', 'common'])
    const history = useHistory()
    const [editing, setEditing] = useState<boolean>(false)

    const supportedVersions = ['4.5', '4.6', '4.7', '4.8']

    type LastActive = { day: number; stringDay: string; value: string }
    const lastActive: LastActive[] = [
        { day: 1, stringDay: '1 day', value: '1d' },
        { day: 2, stringDay: '2 days', value: '2d' },
        { day: 3, stringDay: '3 days', value: '3d' },
        { day: 7, stringDay: '7 days', value: '7d' },
        { day: 14, stringDay: '14 days', value: '14d' },
        { day: 21, stringDay: '21 days', value: '21d' },
        { day: 30, stringDay: '30 days', value: '30d' },
    ]

    useEffect(() => {
        if (props.discoveryConfig.metadata.name !== '') {
            setDiscoveryConfig(props.discoveryConfig)
            setEditing(true)
        }
    }, [props.discoveryConfig])

    function updateDiscoveryConfig(update: (discoveryConfig: DiscoveryConfig) => void) {
        const copy = { ...discoveryConfig }
        update(copy)
        setDiscoveryConfig(copy)
    }

    const onSubmit = async () => {
        alertContext.clearAlerts()
        return new Promise(async (resolve, reject) => {
            try {
                if (!editing) {
                    discoveryConfig.metadata.name = 'discovery'
                    await createDiscoveryConfig(discoveryConfig).promise
                } else {
                    await replaceDiscoveryConfig(discoveryConfig).promise
                }
                resolve(undefined)
                history.push(NavigationPath.discoveredClusters)
            } catch (err) {
                if (err instanceof Error) {
                    alertContext.addAlert({
                        type: 'danger',
                        title: t('common:request.failed'),
                        message: err.message,
                    })
                    reject()
                }
            }
        })
    }

    return (
        <AcmPageCard>
            <AcmForm>
                <AcmFormSection title={t('discoveryConfig.filterform.header')}></AcmFormSection>
                <Text component={TextVariants.h3}>{t('discoveryConfig.filterform.subheader')}</Text>
                <AcmSelect
                    id="lastActiveFilter"
                    label={t('discoveryConfig.lastActiveFilter.label')}
                    labelHelp={t('discoveryConfig.lastActiveFilter.labelHelp')}
                    value={getDiscoveryConfigLastActive(discoveryConfig)}
                    onChange={(lastActive) => {
                        updateDiscoveryConfig((discoveryConfig) => {
                            if (lastActive) {
                                if (!discoveryConfig.spec.filters) {
                                    discoveryConfig.spec.filters = {}
                                }
                                discoveryConfig.spec.filters.lastActive = parseInt(
                                    lastActive.substring(0, lastActive.length - 1)
                                )
                            }
                        })
                    }}
                    isRequired
                >
                    {lastActive.map((e, i) => (
                        <SelectOption key={e.day} value={e.value}>
                            {e.stringDay}
                        </SelectOption>
                    ))}
                </AcmSelect>
                <AcmMultiSelect
                    id="discoveryVersions"
                    label={t('discoveryConfig.discoveryVersions.label')}
                    labelHelp={t('discoveryConfig.discoveryVersions.labelHelp')}
                    value={discoveryConfig.spec?.filters?.openShiftVersions}
                    onChange={(versions) => {
                        updateDiscoveryConfig((discoveryConfig) => {
                            if (!discoveryConfig.spec.filters) {
                                discoveryConfig.spec.filters = {}
                            }
                            discoveryConfig.spec.filters.openShiftVersions = versions
                        })
                    }}
                    isRequired
                >
                    {supportedVersions.map((version) => (
                        <SelectOption key={version} value={version}>
                            {version}
                        </SelectOption>
                    ))}
                </AcmMultiSelect>
                <AcmFormSection title={t('discoveryConfig.connections.header')}></AcmFormSection>
                <Text component={TextVariants.h3}>{t('discoveryConfig.connections.subheader')}</Text>
                <AcmSelect
                    id="providerConnections"
                    label={t('discoveryConfig.connections.label')}
                    labelHelp={t('discoveryConfig.connections.labelHelp')}
                    value={getDiscoveryConfigProviderConnection(discoveryConfig)}
                    onChange={(providerConnection) => {
                        updateDiscoveryConfig((discoveryConfig) => {
                            if (providerConnection) {
                                discoveryConfig.spec.providerConnections = []
                                discoveryConfig.spec.providerConnections.push(providerConnection)
                            }
                        })
                    }}
                    isRequired
                >
                    {props.providerConnections?.map((providerConnection) => (
                        <SelectOption key={providerConnection.metadata.name} value={providerConnection.metadata.name}>
                            {providerConnection.metadata.name}
                        </SelectOption>
                    ))}
                </AcmSelect>
                <AcmAlertGroup isInline canClose />
                <ActionGroup>
                    <AcmSubmit id="applyDiscoveryConfig" onClick={onSubmit} variant={ButtonVariant.primary}>
                        {t('discoveryConfig.enable')}
                    </AcmSubmit>
                    <Link to={NavigationPath.discoveredClusters} id="cancelDiscoveryConfig">
                        <AcmButton variant={ButtonVariant.link}>{t('discoveryConfig.cancel')}</AcmButton>
                    </Link>
                </ActionGroup>
            </AcmForm>
        </AcmPageCard>
    )
}

export function getDiscoveryConfigLastActive(discoveryConfig: Partial<DiscoveryConfig>) {
    let lastActive = discoveryConfig.spec?.filters?.lastActive
    if (lastActive === undefined) {
        return '7d'
    }
    return lastActive.toString().concat('d')
}

export function getDiscoveryConfigProviderConnection(discoveryConfig: Partial<DiscoveryConfig>) {
    let providerConnection = discoveryConfig.spec?.providerConnections
    if (providerConnection !== undefined && providerConnection[0] !== undefined) {
        return providerConnection[0]
    }
    return ''
}

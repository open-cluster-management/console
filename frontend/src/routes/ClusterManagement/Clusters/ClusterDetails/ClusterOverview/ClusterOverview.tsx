import React, { useContext } from 'react'
import { AcmDescriptionList, AcmLabels, AcmButton, AcmInlineProvider } from '@open-cluster-management/ui-components'
import { PageSection, ButtonVariant } from '@patternfly/react-core'
import { PencilAltIcon } from '@patternfly/react-icons'
import { useTranslation } from 'react-i18next'
import { ClusterContext } from '../ClusterDetails'
import { StatusField, DistributionField } from '../../../../../components/ClusterCommon'
import { LoginCredentials } from '../../components/LoginCredentials'
import { HiveNotification } from '../../components/HiveNotification'
import { ImportCommandContainer } from '../../../Clusters/components/ImportCommand'
import { StatusSummaryCount } from '../../components/StatusSummaryCount'
import { ClusterStatus } from '../../../../../lib/get-cluster'

export function ClusterOverviewPageContent(props: { accessRestriction?: boolean }) {
    const { cluster, setEditModalOpen } = useContext(ClusterContext)
    const { t } = useTranslation(['cluster'])
    return (
        <PageSection>
            <HiveNotification />
            <ImportCommandContainer />
            <AcmDescriptionList
                title={t('table.details')}
                leftItems={[
                    { key: t('table.name'), value: cluster?.name },
                    { key: t('table.status'), value: cluster?.status && <StatusField status={cluster?.status} /> },
                    {
                        key: t('table.provider'),
                        value: cluster?.provider && <AcmInlineProvider provider={cluster.provider} />,
                    },
                    {
                        key: t('table.distribution'),
                        value: cluster?.distribution?.displayVersion && (
                            <DistributionField data={cluster?.distribution} clusterName={cluster?.name || ''} clusterStatus={cluster?.status}/>
                        ),
                    },
                    {
                        key: t('table.labels'),
                        value: cluster?.labels && <AcmLabels labels={cluster?.labels} />,
                        keyAction: (
                            <AcmButton
                                onClick={() => setEditModalOpen?.(true)}
                                variant={ButtonVariant.plain}
                                aria-label={t('common:labels.edit.title')}
                            >
                                <PencilAltIcon color="var(--pf-global--primary-color--100)" />
                            </AcmButton>
                        ),
                    },
                ]}
                rightItems={[
                    { key: t('table.kubeApiServer'), value: cluster?.kubeApiServer },
                    {
                        key: t('table.consoleUrl'),
                        value: cluster?.consoleURL && (
                            <a href={cluster?.consoleURL} target="_blank" rel="noreferrer">
                                {cluster?.consoleURL}
                            </a>
                        ),
                    },
                    {
                        key: t('table.credentials'),
                        value: <LoginCredentials accessRestriction={props.accessRestriction} />,
                    },
                ]}
            />
            {cluster?.status === ClusterStatus.ready && <StatusSummaryCount />}
        </PageSection>
    )
}

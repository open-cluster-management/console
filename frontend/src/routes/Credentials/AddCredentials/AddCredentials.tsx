/* Copyright Contributors to the Open Cluster Management project */

import {
    AcmButton,
    AcmEmptyState,
    AcmPage,
    AcmPageContent,
    AcmPageHeader,
} from '@open-cluster-management/ui-components'
import { PageSection } from '@patternfly/react-core'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RouteComponentProps } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { featureGatesState, namespacesState, secretsState } from '../../../atoms'
import { ErrorPage } from '../../../components/ErrorPage'
import { LoadingPage } from '../../../components/LoadingPage'
import { DOC_LINKS } from '../../../lib/doc-util'
import { getAuthorizedNamespaces, rbacCreate } from '../../../lib/rbac-util'
import { NavigationPath } from '../../../NavigationPath'
import { filterForAnsibleSecrets } from '../../../resources/ansible-tower-secret'
import { filterForProviderSecrets } from '../../../resources/provider-connection'
import AnsibleTowerSecretForm from './Components/AnsibleTowerSecretForm'
import CloudConnectionForm from './Components/CloudConnectionForm'
import { CreateProviderWizard } from './Components/CreateProviderWizard'
import { getSecret, Secret, SecretApiVersion, SecretDefinition, SecretKind } from '../../../resources/secret'
import { ProviderID } from '../../../lib/providers'

/* TODO:
- validation
*/
export default function AddCredentialPage({ match }: RouteComponentProps<{ namespace: string; name: string }>) {
    const { t } = useTranslation(['connection', 'common'])
    const isEditing = match?.params.name !== undefined
    return (
        <AcmPage>
            {match?.params.namespace ? (
                <AcmPageHeader
                    title={t('editConnection.title')}
                    titleTooltip={
                        <>
                            {t('addConnection.title.tooltip')}
                            <a
                                href={DOC_LINKS.CREATE_CONNECTION}
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: 'block', marginTop: '4px' }}
                            >
                                {t('common:learn.more')}
                            </a>
                        </>
                    }
                    breadcrumb={[
                        { text: t('connections'), to: NavigationPath.credentials },
                        { text: t('editConnection.title'), to: '' },
                    ]}
                />
            ) : (
                <AcmPageHeader
                    title={t('addConnection.title')}
                    titleTooltip={
                        <>
                            {t('addConnection.title.tooltip')}
                            <a
                                href={DOC_LINKS.CREATE_CONNECTION}
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: 'block', marginTop: '4px' }}
                            >
                                {t('common:learn.more')}
                            </a>
                        </>
                    }
                    breadcrumb={[
                        { text: t('connections'), to: NavigationPath.credentials },
                        { text: t('addConnection.title'), to: '' },
                    ]}
                />
            )}
            <AcmPageContent id="add-credentials">
                <PageSection variant="light" isFilled type={isEditing ? undefined : 'wizard'}>
                    <AddCredentialPageData namespace={match?.params.namespace} name={match?.params.name} />
                </PageSection>
            </AcmPageContent>
        </AcmPage>
    )
}

export function AddCredentialPageData(props: { namespace: string; name: string }) {
    const { t } = useTranslation(['connection', 'common'])
    const [namespaces] = useRecoilState(namespacesState)
    const [projects, setProjects] = useState<string[]>([])
    const [error, setError] = useState<Error>()
    const [retry, setRetry] = useState(0)
    const [isLoading, setIsLoading] = useState<boolean>(true)

    const [secret, setSecret] = useState<Secret>({
        apiVersion: SecretApiVersion,
        kind: SecretKind,
        metadata: {
            name: '',
            namespace: '',
        },
    })

    useEffect(() => {
        setError(undefined)
        setProjects([])
        setIsLoading(true)
    }, [retry])

    // create credential
    useEffect(() => {
        if (!props.namespace) {
            getAuthorizedNamespaces([rbacCreate(SecretDefinition)], namespaces)
                .then((namespaces: string[]) => setProjects(namespaces))
                .catch(setError)
                .finally(() => setIsLoading(false))
        }
    }, [props.namespace, namespaces])

    // edit credential
    useEffect(() => {
        if (props.name) {
            setProjects([props.namespace])
            const result = getSecret(props)
            result.promise
                .then((secret) => {
                    setSecret(secret)
                })
                .catch(setError)
                .finally(() => setIsLoading(false))
            return result.abort
        }
    }, [retry, props])

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
        return <LoadingPage />
    }

    if (projects.length === 0) {
        return (
            <AcmEmptyState
                title={t('common:rbac.title.unauthorized')}
                message={t('common:rbac.namespaces.unauthorized')}
                showIcon={false}
            />
        )
    }

    return <AddCredentialPageContent projects={projects} secret={secret} />
}

export function AddCredentialPageContent(props: { projects: string[]; secret: Secret }) {
    const [featureGates] = useRecoilState(featureGatesState)
    const discoveryFeatureGate = featureGates.find((fg) => fg.metadata.name === 'open-cluster-management-discovery')
    const isEditing = () => props.secret.metadata.name !== ''
    const [secrets] = useRecoilState(secretsState)

    // access what type of credentail is being edited
    if (props.secret?.metadata?.labels?.['cluster.open-cluster-management.io/provider'] === ProviderID.ANS) {
        return (
            <AnsibleTowerSecretForm
                projects={props.projects}
                isEditing={true}
                ansibleSecret={filterForAnsibleSecrets([props.secret])[0]}
            />
        )
    }
    if (props.secret?.metadata?.labels?.['cluster.open-cluster-management.io/cloudconnection'] !== undefined) {
        return (
            <CloudConnectionForm
                providerConnection={filterForProviderSecrets([props.secret])[0]}
                projects={props.projects}
                discoveryFeatureGate={discoveryFeatureGate}
                isEditing={isEditing()}
            />
        )
    }

    // else, creating new credential, Wizard will go here
    return (
        <CreateProviderWizard
            projects={props.projects}
            discoveryFeatureGate={discoveryFeatureGate}
            ansibleSecrets={filterForAnsibleSecrets(secrets)}
        />
    )
}

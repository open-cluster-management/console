/* Copyright Contributors to the Open Cluster Management project */

import React, { useState, useContext } from 'react'
import {
    AcmAlertProvider,
    AcmAlertContext,
    AcmExpandableSection,
    AcmForm,
    AcmLabelsInput,
    AcmPage,
    AcmPageCard,
    AcmPageHeader,
    AcmTextInput,
    AcmSubmit,
    AcmButton,
    AcmErrorBoundary,
    AcmAlertGroup,
    AcmTextArea,
    AcmSelect,
} from '@open-cluster-management/ui-components'
import { ActionGroup, Button, Label, Text, TextVariants, SelectOption } from '@patternfly/react-core'
import CheckCircleIcon from '@patternfly/react-icons/dist/js/icons/check-circle-icon'
import '@patternfly/react-styles/css/components/CodeEditor/code-editor.css'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { deleteResources } from '../../../../lib/delete-resources'
import { ResourceError, ResourceErrorCode, createResource } from '../../../../lib/resource-request'
import { NavigationPath } from '../../../../NavigationPath'
import { createKlusterletAddonConfig } from '../../../../resources/klusterlet-add-on-config'
import { createManagedCluster } from '../../../../resources/managed-cluster'
import { createProject } from '../../../../resources/project'
import { IResource } from '../../../../resources/resource'
import { ImportCommand, pollImportYamlSecret } from '../components/ImportCommand'
import { useHistory } from 'react-router-dom'
import { DOC_LINKS } from '../../../../lib/doc-util'

export default function ImportClusterPage() {
    const { t } = useTranslation(['cluster'])
    return (
        <AcmAlertProvider>
            <AcmPage>
                <AcmPageHeader
                    title={t('page.header.import-cluster')}
                    breadcrumb={[
                        { text: t('clusters'), to: NavigationPath.clusters },
                        { text: t('page.header.import-cluster'), to: '' },
                    ]}
                    titleTooltip={
                        <>
                            {t('page.header.import-cluster.tooltip')}
                            <a
                                href={DOC_LINKS.IMPORT_CLUSTER}
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: 'block', marginTop: '4px' }}
                            >
                                {t('common:learn.more')}
                            </a>
                        </>
                    }
                />
                <AcmErrorBoundary>
                    <ImportClusterPageContent />
                </AcmErrorBoundary>
            </AcmPage>
        </AcmAlertProvider>
    )
}

export function ImportClusterPageContent() {
    const { t } = useTranslation(['cluster', 'common'])
    const alertContext = useContext(AcmAlertContext)
    const history = useHistory()
    const [clusterName, setClusterName] = useState<string>(sessionStorage.getItem('DiscoveredClusterName') ?? '')
    const [additionalLabels, setAdditionaLabels] = useState<Record<string, string> | undefined>({})
    const [submitted, setSubmitted] = useState<boolean>(false)
    const [importCommand, setImportCommand] = useState<string | undefined>()
    //    const [Username, setUsername] = useState<string | undefined>()
    //    const [Password, setPassword] = useState<string | undefined>()
    const [importMode, setimportMode] = useState<string | undefined>()
    const [credentialMode, setcredentialMode] = useState<string | undefined>()
    const [kubeConfigText, setkubeConfigText] = useState<string | undefined>()
    const [manualButton, setmanualButton] = useState<boolean>(false)
    const [credentialBool, setcredentialBool] = useState<boolean>(false)

    const onReset = () => {
        setClusterName('')
        setAdditionaLabels({})
        setSubmitted(false)
        setImportCommand(undefined)
    }

    return (
        <AcmPageCard>
            <AcmExpandableSection label={t('import.form.header')} expanded={true}>
                <AcmForm id="import-cluster-form">
                    <AcmTextInput
                        id="clusterName"
                        label={t('import.form.clusterName.label')}
                        value={clusterName}
                        isDisabled={submitted}
                        onChange={(name) => setClusterName(name)}
                        placeholder={t('import.form.clusterName.placeholder')}
                        isRequired
                    />
                    <AcmLabelsInput
                        id="additionalLabels"
                        label={t('import.form.labels.label')}
                        buttonLabel={t('common:label.add')}
                        value={additionalLabels}
                        onChange={(label) => setAdditionaLabels(label)}
                        placeholder={t('labels.edit.placeholder')}
                        isDisabled={submitted}
                    />
                </AcmForm>
            </AcmExpandableSection>
            <AcmExpandableSection label={t('import.mode.header')} expanded={true}>
                <AcmForm>
                    <AcmSelect
                        label={t('import.mode.select')}
                        placeholder={t('import.mode.default')}
                        value={importMode}
                        onChange={(id) => {
                            setimportMode(id)
                            switch (id) {
                                case 'automatic-import':
                                    setmanualButton(false)
                                    break
                                case 'manual-import':
                                    setmanualButton(true)
                                    break
                                default:
                                    setmanualButton(false)
                            }
                        }}
                    >
                        <SelectOption key="automatic-import" value="automatic-import">
                            {t('import.auto.choice')}
                        </SelectOption>
                        <SelectOption key="manual-import" value="manual-import">
                            {t('import.manual.choice')}
                        </SelectOption>
                    </AcmSelect>
                    {!manualButton && <Text component={TextVariants.small}>{t('import.credential.explanation')} </Text>}
                    {!manualButton && (
                        <AcmSelect
                            label={t('import.credential.select')}
                            placeholder={t('import.credential.default')}
                            value={credentialMode}
                            onChange={(id) => {
                                setcredentialMode(id)
                                switch (id) {
                                    case 'credentials':
                                        setcredentialBool(true)
                                        break
                                    case 'kubeconfig':
                                        setcredentialBool(false)
                                        break
                                    default:
                                        setcredentialBool(false)
                                }
                            }}
                        >
                            {/* <SelectOption key="credentials" value="credentials">
                                {t('import.credential.choice')}
                            </SelectOption> */}
                            <SelectOption key="kubeconfig" value="kubeconfig">
                                {t('import.config.choice')}
                            </SelectOption>
                        </AcmSelect>
                    )}

                    {/* <AcmTextInput
                        id="username"
                        label={t('import.username')}
                        placeholder={t('import.username.place')}
                        value={Username}
                        onChange={(username) => {
                            setUsername(username)
                        }}
                        isRequired
                        hidden={manualButton || !credentialBool}
                    />
                    <AcmTextInput
                        id="password"
                        label={t('import.password')}
                        placeholder={t('import.password.place')}
                        value={Password}
                        onChange={(password) => {
                            setPassword(password)
                        }}
                        isRequired            
                        hidden={manualButton || !credentialBool}
                    /> */}
                    <AcmTextArea
                        id="kubeConfigEntry"
                        label={t('import.auto.config.label')}
                        placeholder={t('import.auto.config.prompt')}
                        value={kubeConfigText}
                        onChange={(file) => {
                            setkubeConfigText(file)
                        }}
                        hidden={credentialBool || manualButton}
                        isRequired
                    />

                    {manualButton && <Text component={TextVariants.small}>{t('import.description')}; </Text>}

                    <AcmAlertGroup isInline canClose />
                    <ActionGroup>
                        <AcmSubmit
                            id="submit"
                            variant="primary"
                            isDisabled={!clusterName || submitted}
                            onClick={async () => {
                                setSubmitted(true)
                                alertContext.clearAlerts()
                                /* istanbul ignore next */
                                const clusterLabels = {
                                    cloud: 'auto-detect',
                                    vendor: 'auto-detect',
                                    name: clusterName,
                                    ...additionalLabels,
                                }
                                const createdResources: IResource[] = []
                                return new Promise(async (resolve, reject) => {
                                    try {
                                        try {
                                            createdResources.push(await createProject(clusterName).promise)
                                        } catch (err) {
                                            const resourceError = err as ResourceError
                                            if (resourceError.code !== ResourceErrorCode.Conflict) {
                                                throw err
                                            }
                                        }
                                        createdResources.push(
                                            await createManagedCluster({ clusterName, clusterLabels }).promise
                                        )
                                        createdResources.push(
                                            await createKlusterletAddonConfig({ clusterName, clusterLabels }).promise
                                        )

                                        if (!manualButton) {
                                            createdResources.push(
                                                await createResource<IResource>({
                                                    apiVersion: 'v1',
                                                    kind: 'Secret',
                                                    metadata: {
                                                        name: 'auto-import-secret',
                                                        namespace: clusterName,
                                                    },
                                                    stringData: {
                                                        autoImportRetry: '2',
                                                        kubeconfig: kubeConfigText,
                                                    },
                                                    type: 'Opaque',
                                                }).promise
                                            )
                                                ? history.push(
                                                      NavigationPath.clusterDetails.replace(
                                                          ':id',
                                                          clusterName as string
                                                      )
                                                  )
                                                : onReset()
                                        } else {
                                            setImportCommand(await pollImportYamlSecret(clusterName))
                                        }
                                    } catch (err) {
                                        if (err instanceof Error) {
                                            alertContext.addAlert({
                                                type: 'danger',
                                                title: err.name,
                                                message: err.message,
                                            })
                                        }
                                        await deleteResources(createdResources).promise
                                        setSubmitted(false)
                                        reject()
                                    } finally {
                                        resolve(undefined)
                                    }
                                })
                            }}
                            label={
                                submitted
                                    ? t('import.form.submitted')
                                    : manualButton
                                    ? t('import.form.submit')
                                    : t('import.auto.button')
                            }
                            processingLabel={t('import.generating')}
                        />

                        {submitted ? (
                            <Label variant="outline" color="blue" icon={<CheckCircleIcon />}>
                                {t('import.importmode.importsaved')}
                            </Label>
                        ) : (
                            <Link to={NavigationPath.clusters} id="cancel">
                                <Button variant="link">{t('common:cancel')}</Button>
                            </Link>
                        )}
                    </ActionGroup>
                    {importCommand && (
                        <React.Fragment>
                            <ImportCommand importCommand={importCommand}>
                                <ActionGroup>
                                    <Link to={NavigationPath.clusterDetails.replace(':id', clusterName as string)}>
                                        <Button variant="primary">{t('import.footer.viewcluster')}</Button>
                                    </Link>
                                    <AcmButton
                                        variant="secondary"
                                        role="link"
                                        onClick={() => {
                                            sessionStorage.getItem('DiscoveredClusterConsoleURL')
                                                ? history.push(NavigationPath.discoveredClusters)
                                                : onReset()
                                        }}
                                    >
                                        {t('import.footer.importanother')}
                                    </AcmButton>
                                </ActionGroup>
                            </ImportCommand>
                        </React.Fragment>
                    )}
                </AcmForm>
            </AcmExpandableSection>
        </AcmPageCard>
    )
}

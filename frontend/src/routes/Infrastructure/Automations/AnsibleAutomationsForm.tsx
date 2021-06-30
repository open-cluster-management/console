/* Copyright Contributors to the Open Cluster Management project */
import { AcmForm, AcmLabelsInput, AcmModal, AcmSubmit, AcmTextInput } from '@open-cluster-management/ui-components'
import { ActionGroup, Button, Chip, ChipGroup, Flex, FlexItem, ModalVariant } from '@patternfly/react-core'
import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RouteComponentProps, useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { featureGatesState, secretsState } from '../../../atoms'
import { AcmDataFormPage } from '../../../components/AcmDataForm'
import { FormData, Section } from '../../../components/AcmFormData'
import { ErrorPage } from '../../../components/ErrorPage'
import { LoadingPage } from '../../../components/LoadingPage'
import { createResource, replaceResource } from '../../../lib/resource-request'
import { NavigationPath } from '../../../NavigationPath'
import { FeatureGates } from '../../../FeatureGates'
import {
    AnsibleJob,
    ClusterCurator,
    ClusterCuratorApiVersion,
    ClusterCuratorKind,
    getClusterCurator,
} from '../../../resources/cluster-curator'
import { ProviderConnection, unpackProviderConnection } from '../../../resources/provider-connection'
import { IResource } from '../../../resources/resource'
import { validateKubernetesDnsName } from '../../../lib/validation'

export default function AnsibleAutomationsFormPage({
    match,
}: RouteComponentProps<{ namespace: string; name: string }>) {
    const { name, namespace } = match.params

    let isEditing = false
    let isViewing = false
    if (name !== undefined) {
        isEditing = match.path.endsWith(NavigationPath.editAnsibleAutomation)
        isViewing = !isEditing
    }

    const [error, setError] = useState<Error>()
    const [secrets] = useRecoilState(secretsState)
    const providerConnections = secrets.map(unpackProviderConnection)
    const [clusterCuratorTemplate, setClusterCuratorTemplate] = useState<ClusterCurator | undefined>()

    const ansibleCredentials = providerConnections.filter(
        (providerConnection) =>
            providerConnection.metadata?.labels?.['cluster.open-cluster-management.io/type'] === 'ans'
    )

    useEffect(() => {
        if (isEditing || isViewing) {
            const result = getClusterCurator({ name, namespace })
            result.promise
                .then((curator) => {
                    setClusterCuratorTemplate(curator)
                })
                .catch(setError)
            return result.abort
        }
        return undefined
    }, [isEditing, isViewing, name, namespace])

    if (error) return <ErrorPage error={error} />

    if (isEditing || isViewing) {
        if (!clusterCuratorTemplate) return <LoadingPage />
        return (
            <AnsibleAutomationsForm
                ansibleCredentials={ansibleCredentials}
                clusterCurator={clusterCuratorTemplate}
                isEditing={isEditing}
                isViewing={isViewing}
            />
        )
    } else {
        // TODO: Can we create templates without an ansible secret linked?
        // Where do we store the template in this scenario?
        return (
            <AnsibleAutomationsForm
                ansibleCredentials={ansibleCredentials}
                clusterCurator={clusterCuratorTemplate}
                isEditing={false}
                isViewing={false}
            />
        )
    }
}

export function AnsibleAutomationsForm(props: {
    ansibleCredentials: ProviderConnection[]
    clusterCurator: ClusterCurator | undefined
    isEditing: boolean
    isViewing: boolean
}) {
    const { t } = useTranslation(['cluster', 'common', 'credentials', 'create'])
    const { ansibleCredentials, clusterCurator, isEditing, isViewing } = props

    const [featureGateCache] = useRecoilState(featureGatesState)

    const history = useHistory()
    const [editAnsibleJob, setEditAnsibleJob] = useState<AnsibleJob | undefined>()
    const [editAnsibleJobList, setEditAnsibleJobList] =
        useState<{ jobs: AnsibleJob[]; setJobs: (jobs: AnsibleJob[]) => void }>()
    const [templateName, setTemplateName] = useState(clusterCurator?.metadata.name ?? '')
    const [ansibleSelection, setAnsibleSelection] = useState(clusterCurator?.spec?.install?.towerAuthSecret ?? '')

    const [installPreJobs, setInstallPreJobs] = useState<AnsibleJob[]>(clusterCurator?.spec?.install?.prehook ?? [])
    const [installPostJobs, setInstallPostJobs] = useState<AnsibleJob[]>(clusterCurator?.spec?.install?.posthook ?? [])
    const [upgradePreJobs, setUpgradePreJobs] = useState<AnsibleJob[]>(clusterCurator?.spec?.upgrade?.prehook ?? [])
    const [upgradePostJobs, setUpgradePostJobs] = useState<AnsibleJob[]>(clusterCurator?.spec?.upgrade?.posthook ?? [])
    const [scalePreJobs, setScalePreJobs] = useState<AnsibleJob[]>(clusterCurator?.spec?.scale?.prehook ?? [])
    const [scalePostJobs, setScalePostJobs] = useState<AnsibleJob[]>(clusterCurator?.spec?.scale?.posthook ?? [])
    const [destroyPreJobs, setDestroyPreJobs] = useState<AnsibleJob[]>(clusterCurator?.spec?.destroy?.prehook ?? [])
    const [destroyPostJobs, setDestroyPostJobs] = useState<AnsibleJob[]>(clusterCurator?.spec?.destroy?.posthook ?? [])

    const resourceVersion: string | undefined = clusterCurator?.metadata.resourceVersion ?? undefined

    function updateAnsibleJob(ansibleJob?: AnsibleJob, replaceJob?: AnsibleJob) {
        if (ansibleJob && replaceJob && ansibleJob.name && editAnsibleJobList) {
            if (editAnsibleJobList.jobs.includes(replaceJob)) {
                editAnsibleJobList.setJobs(
                    editAnsibleJobList.jobs.map((job) => (job === replaceJob ? ansibleJob : job))
                )
            } else {
                editAnsibleJobList.setJobs([...editAnsibleJobList.jobs, ...[ansibleJob]])
            }
        }
        setEditAnsibleJob(undefined)
    }

    function stateToData() {
        let ansibleSecretNamespace = ''
        ansibleCredentials.forEach((credential) => {
            if (ansibleSelection === credential.metadata.name) ansibleSecretNamespace = credential.metadata!.namespace!
        })
        const curator: ClusterCurator = {
            apiVersion: ClusterCuratorApiVersion,
            kind: ClusterCuratorKind,
            metadata: {
                name: templateName,
                namespace: ansibleSecretNamespace,
                resourceVersion: resourceVersion,
            },
            spec: {
                install: {
                    towerAuthSecret: ansibleSelection,
                    prehook: installPreJobs,
                    posthook: installPostJobs,
                },
                upgrade: {
                    towerAuthSecret: ansibleSelection,
                    prehook: upgradePreJobs,
                    posthook: upgradePostJobs,
                },
                scale: {
                    towerAuthSecret: ansibleSelection,
                    prehook: scalePreJobs,
                    posthook: scalePostJobs,
                },
                destroy: {
                    towerAuthSecret: ansibleSelection,
                    prehook: destroyPreJobs,
                    posthook: destroyPostJobs,
                },
            },
        }
        return curator
    }

    function cellsFn(ansibleJob: AnsibleJob) {
        return [
            <Flex style={{ gap: '8px' }}>
                <FlexItem>{ansibleJob.name}</FlexItem>
                {ansibleJob.extra_vars && (
                    <ChipGroup>
                        {Object.keys(ansibleJob.extra_vars).map((key) => (
                            <Chip isReadOnly>
                                {key}={ansibleJob.extra_vars![key]}
                            </Chip>
                        ))}
                    </ChipGroup>
                )}
            </Flex>,
        ]
    }

    const formData: FormData = {
        title: t('create:template.create.title'),
        titleTooltip: 'tooltip test',
        breadcrumb: [
            { text: t('template.title'), to: NavigationPath.ansibleAutomations },
            { text: t('create:template.create.title') },
        ],
        reviewDescription: t('template.create.review.description'),
        reviewTitle: t('template.create.review.title'),
        cancelLabel: t('common:cancel'),
        nextLabel: t('common:next'),
        backLabel: t('common:back'),
        sections: [
            {
                type: 'Section',
                title: t('template.information.title'),
                wizardTitle: t('template.create.config.wizard.title'),
                description: t('template.information.description'),
                inputs: [
                    {
                        id: 'Template',
                        type: 'Text',
                        label: t('template.create.name'),
                        placeholder: t('template.create.placeholder'),
                        value: templateName,
                        onChange: setTemplateName,
                        isRequired: true,
                        isDisabled: isEditing,
                        validation: (value) => validateKubernetesDnsName(value, t),
                    },
                    {
                        id: 'ansibleSecrets',
                        type: 'Select',
                        label: t('credentials:credentialsForm.ansibleCredentials.label'),
                        placeholder: t('credentials:credentialsForm.ansibleCredentials.placeholder'),
                        value: ansibleSelection,
                        onChange: setAnsibleSelection,
                        isRequired: true,
                        options: ansibleCredentials.map((credential) => ({
                            id: credential.metadata.name as string,
                            value: credential.metadata.name as string,
                        })),
                        isDisabled: isEditing,
                    },
                ],
            },
            {
                type: 'SectionGroup',
                title: t('template.templates.title'),
                sections: [
                    {
                        type: 'Section',
                        title: t('template.create.install'),
                        wizardTitle: t('template.create.install.wizard.title'),
                        inputs: [
                            {
                                id: 'installPreJob',
                                type: 'OrderedItems',
                                label: t('template.preInstall.label'),
                                placeholder: t('template.job.placeholder'),
                                value: installPreJobs,
                                onChange: setInstallPreJobs,
                                keyFn: (ansibleJob: AnsibleJob) => ansibleJob.name,
                                cellsFn,
                                onEdit: (ansibleJob) => {
                                    setEditAnsibleJobList({ jobs: installPreJobs, setJobs: setInstallPreJobs })
                                    setEditAnsibleJob(ansibleJob)
                                },
                                onCreate: () => {
                                    setEditAnsibleJobList({ jobs: installPreJobs, setJobs: setInstallPreJobs })
                                    setEditAnsibleJob({ name: '', extra_vars: {} })
                                },
                            },
                            {
                                id: 'installPostJob',
                                type: 'OrderedItems',
                                label: t('template.postInstall.label'),
                                placeholder: t('template.job.placeholder'),
                                value: installPostJobs,
                                onChange: setInstallPostJobs,
                                keyFn: (ansibleJob: AnsibleJob) => ansibleJob.name,
                                cellsFn,
                                onEdit: (ansibleJob) => {
                                    setEditAnsibleJobList({ jobs: installPostJobs, setJobs: setInstallPostJobs })
                                    setEditAnsibleJob(ansibleJob)
                                },
                                onCreate: () => {
                                    setEditAnsibleJobList({ jobs: installPostJobs, setJobs: setInstallPostJobs })
                                    setEditAnsibleJob({ name: '', extra_vars: {} })
                                },
                            },
                        ],
                    },
                    {
                        type: 'Section',
                        title: t('template.create.upgrade'),
                        wizardTitle: t('template.create.upgrade.wizard.title'),
                        inputs: [
                            {
                                id: 'upgradePreJob',
                                type: 'OrderedItems',
                                label: t('template.preUpgrade.label'),
                                placeholder: t('template.job.placeholder'),
                                value: upgradePreJobs,
                                onChange: setUpgradePreJobs,
                                keyFn: (ansibleJob: AnsibleJob) => ansibleJob.name,
                                cellsFn,
                                onEdit: (ansibleJob) => {
                                    setEditAnsibleJobList({ jobs: upgradePreJobs, setJobs: setUpgradePreJobs })
                                    setEditAnsibleJob(ansibleJob)
                                },
                                onCreate: () => {
                                    setEditAnsibleJobList({ jobs: upgradePreJobs, setJobs: setUpgradePreJobs })
                                    setEditAnsibleJob({ name: '', extra_vars: {} })
                                },
                            },
                            {
                                id: 'upgradePostJob',
                                type: 'OrderedItems',
                                label: t('template.postUpgrade.label'),
                                placeholder: t('template.job.placeholder'),
                                value: upgradePostJobs,
                                onChange: setUpgradePostJobs,
                                keyFn: (ansibleJob: AnsibleJob) => ansibleJob.name,
                                cellsFn,
                                onEdit: (ansibleJob) => {
                                    setEditAnsibleJobList({ jobs: upgradePostJobs, setJobs: setUpgradePostJobs })
                                    setEditAnsibleJob(ansibleJob)
                                },
                                onCreate: () => {
                                    setEditAnsibleJobList({ jobs: upgradePostJobs, setJobs: setUpgradePostJobs })
                                    setEditAnsibleJob({ name: '', extra_vars: {} })
                                },
                            },
                        ],
                    },
                    ...(featureGateCache.find(
                        (featureGate) => featureGate.metadata.name === FeatureGates.ansibleAutomationTemplate
                    )
                        ? ([
                              {
                                  type: 'Section',
                                  title: t('template.create.scale'),
                                  wizardTitle: t('template.create.scale.wizard.title'),
                                  inputs: [
                                      {
                                          id: 'scalePreJob',
                                          type: 'OrderedItems',
                                          label: t('template.preScale.label'),
                                          placeholder: t('template.job.placeholder'),
                                          value: scalePreJobs,
                                          onChange: setScalePreJobs,
                                          keyFn: (ansibleJob: AnsibleJob) => ansibleJob.name,
                                          cellsFn,
                                          onEdit: (ansibleJob) => {
                                              setEditAnsibleJobList({ jobs: scalePreJobs, setJobs: setScalePreJobs })
                                              setEditAnsibleJob(ansibleJob)
                                          },
                                          onCreate: () => {
                                              setEditAnsibleJobList({ jobs: scalePreJobs, setJobs: setScalePreJobs })
                                              setEditAnsibleJob({ name: '', extra_vars: {} })
                                          },
                                      },
                                      {
                                          id: 'scalePostJob',
                                          type: 'OrderedItems',
                                          label: t('template.postScale.label'),
                                          placeholder: t('template.job.placeholder'),
                                          value: scalePostJobs,
                                          onChange: setScalePostJobs,
                                          keyFn: (ansibleJob: AnsibleJob) => ansibleJob.name,
                                          cellsFn,
                                          onEdit: (ansibleJob) => {
                                              setEditAnsibleJobList({ jobs: scalePostJobs, setJobs: setScalePostJobs })
                                              setEditAnsibleJob(ansibleJob)
                                          },
                                          onCreate: () => {
                                              setEditAnsibleJobList({ jobs: scalePostJobs, setJobs: setScalePostJobs })
                                              setEditAnsibleJob({ name: '', extra_vars: {} })
                                          },
                                      },
                                  ],
                              },
                              {
                                  type: 'Section',
                                  title: t('template.create.destroy'),
                                  wizardTitle: t('template.create.destroy.wizard.title'),
                                  inputs: [
                                      {
                                          id: 'destroyPreJob',
                                          type: 'OrderedItems',
                                          label: t('template.preDestroy.label'),
                                          placeholder: t('template.job.placeholder'),
                                          value: destroyPreJobs,
                                          onChange: setDestroyPreJobs,
                                          keyFn: (ansibleJob: AnsibleJob) => ansibleJob.name,
                                          cellsFn,
                                          onEdit: (ansibleJob) => {
                                              setEditAnsibleJobList({
                                                  jobs: destroyPreJobs,
                                                  setJobs: setDestroyPreJobs,
                                              })
                                              setEditAnsibleJob(ansibleJob)
                                          },
                                          onCreate: () => {
                                              setEditAnsibleJobList({
                                                  jobs: destroyPreJobs,
                                                  setJobs: setDestroyPreJobs,
                                              })
                                              setEditAnsibleJob({ name: '', extra_vars: {} })
                                          },
                                      },
                                      {
                                          id: 'destroyPostJob',
                                          type: 'OrderedItems',
                                          label: t('template.postDestroy.label'),
                                          placeholder: t('template.job.placeholder'),
                                          value: destroyPostJobs,
                                          onChange: setDestroyPostJobs,
                                          keyFn: (ansibleJob: AnsibleJob) => ansibleJob.name,
                                          cellsFn,
                                          onEdit: (ansibleJob) => {
                                              setEditAnsibleJobList({
                                                  jobs: destroyPostJobs,
                                                  setJobs: setDestroyPostJobs,
                                              })
                                              setEditAnsibleJob(ansibleJob)
                                          },
                                          onCreate: () => {
                                              setEditAnsibleJobList({
                                                  jobs: destroyPostJobs,
                                                  setJobs: setDestroyPostJobs,
                                              })
                                              setEditAnsibleJob({ name: '', extra_vars: {} })
                                          },
                                      },
                                  ],
                              },
                          ] as Section[])
                        : []),
                ],
            },
        ],
        submit: () => {
            if (isEditing) {
                return replaceResource(stateToData() as IResource).promise.then(async () => {
                    if (process.env.NODE_ENV === 'development')
                        await new Promise((resolve) => setTimeout(resolve, 4000))
                    history.push(NavigationPath.ansibleAutomations)
                })
            } else {
                return createResource(stateToData() as IResource).promise.then(async () => {
                    if (process.env.NODE_ENV === 'development')
                        await new Promise((resolve) => setTimeout(resolve, 4000))
                    history.push(NavigationPath.ansibleAutomations)
                })
            }
        },
        submitText: isEditing ? t('common:save') : t('common:add'),
        submittingText: isEditing ? t('common:saving') : t('common:adding'),
        cancel: () => history.push(NavigationPath.ansibleAutomations),
        stateToData,
    }

    return (
        <Fragment>
            <AcmDataFormPage formData={formData} mode={isViewing ? 'details' : isEditing ? 'form' : 'wizard'} />
            <EditAnsibleJobModal
                ansibleJob={editAnsibleJob}
                setAnsibleJob={updateAnsibleJob}
                ansibleJobList={editAnsibleJobList?.jobs}
            />
        </Fragment>
    )
}

function EditAnsibleJobModal(props: {
    ansibleJob?: AnsibleJob
    setAnsibleJob: (ansibleJob?: AnsibleJob, old?: AnsibleJob) => void
    ansibleJobList?: AnsibleJob[]
}) {
    const { t } = useTranslation(['common', 'cluster'])
    const [ansibleJob, setAnsibleJob] = useState<AnsibleJob | undefined>()
    let ansibleJobList: string[]
    if (props.ansibleJobList)
        ansibleJobList = props.ansibleJobList.filter((job) => ansibleJob !== job).map((ansibleJob) => ansibleJob.name)
    useEffect(() => setAnsibleJob(props.ansibleJob), [props.ansibleJob])
    return (
        <AcmModal
            variant={ModalVariant.medium}
            title={
                props.ansibleJob?.name !== ''
                    ? t('cluster:template.modal.title.edit')
                    : t('cluster:template.modal.title.add')
            }
            isOpen={props.ansibleJob !== undefined}
            onClose={() => props.setAnsibleJob()}
        >
            <AcmForm>
                <AcmTextInput
                    id="job-name"
                    label={t('cluster:template.modal.name.label')}
                    value={ansibleJob?.name}
                    helperText={t('cluster:template.modal.name.helper.text')}
                    onChange={(name) => {
                        if (ansibleJob) {
                            const copy = { ...ansibleJob }
                            copy.name = name
                            setAnsibleJob(copy)
                        }
                    }}
                    validation={(name: string) => {
                        if (ansibleJobList.includes(name)) {
                            // no duplicate job names can be added
                            return t('cluster:template.job.duplicate.error')
                        }
                    }}
                    isRequired
                />
                <AcmLabelsInput
                    id="job-settings"
                    label={t('cluster:template.modal.settings.label')}
                    value={ansibleJob?.extra_vars}
                    onChange={(labels) => {
                        if (ansibleJob) {
                            const copy = { ...ansibleJob }
                            copy.extra_vars = labels
                            setAnsibleJob(copy)
                        }
                    }}
                    buttonLabel=""
                    placeholder={t('cluster:template.modal.settings.placeholder')}
                />
                <ActionGroup>
                    <AcmSubmit
                        variant="primary"
                        onClick={() => {
                            if (ansibleJob) props.setAnsibleJob({ ...ansibleJob }, props.ansibleJob)
                            props.setAnsibleJob()
                        }}
                    >
                        {t('common:save')}
                    </AcmSubmit>

                    <Button variant="link" onClick={() => props.setAnsibleJob()} key="cancel">
                        {t('common:cancel')}
                    </Button>
                </ActionGroup>
            </AcmForm>
        </AcmModal>
    )
}

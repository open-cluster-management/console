/* Copyright Contributors to the Open Cluster Management project */
import { AcmProgressTracker, ProgressTrackerStep, StatusType } from '@open-cluster-management/ui-components'
import { Card, CardBody } from '@patternfly/react-core'
import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { useRecoilState } from 'recoil'
import { ansibleJobState, clusterCuratorsState, configMapsState } from '../../../../../atoms'
import { ClusterStatus } from '../../../../../lib/get-cluster'
import { getLatestAnsibleJob } from '../../../../../resources/ansible-job'
import { ClusterContext } from '../ClusterDetails/ClusterDetails'
import { launchLogs } from './HiveNotification'

export function ProgressStepBar() {
    const { t } = useTranslation(['cluster'])
    const { cluster } = useContext(ClusterContext)
    const [curators] = useRecoilState(clusterCuratorsState)
    const [ansibleJobs] = useRecoilState(ansibleJobState)
    const [configMaps] = useRecoilState(configMapsState)
    const latestJobs = getLatestAnsibleJob(ansibleJobs, cluster?.name!)
    const curator = curators.find((curator) => curator.metadata.name === cluster?.name)

    const installStatus = [
        ClusterStatus.prehookjob,
        ClusterStatus.prehookfailed,
        ClusterStatus.creating,
        ClusterStatus.provisionfailed,
        ClusterStatus.importing,
        ClusterStatus.importfailed,
        ClusterStatus.posthookjob,
        ClusterStatus.posthookfailed,
    ]

    if (installStatus.includes(cluster?.status!) && curator?.spec?.desiredCuration === 'install') {
        // hook state
        const prehooks = curator?.spec?.install?.prehook?.length
        const posthooks = curator?.spec?.install?.posthook?.length
        let creatingStatus = StatusType.pending
        let prehookStatus = StatusType.pending
        let posthookStatus: StatusType | undefined = undefined
        let importStatus = StatusType.pending

        switch (cluster?.status) {
            case ClusterStatus.posthookjob:
                posthookStatus = StatusType.progress
                break
            case ClusterStatus.posthookfailed:
                posthookStatus = StatusType.danger
                break
            default: {
                if (posthooks) {
                    posthookStatus = StatusType.empty
                } else {
                    posthookStatus = StatusType.pending
                }
            }
        }

        switch (cluster?.status) {
            case ClusterStatus.importing:
                importStatus = StatusType.progress
                break
            case ClusterStatus.importfailed:
                importStatus = StatusType.danger
                break
            default: {
                if (posthookStatus === StatusType.progress || posthookStatus === StatusType.danger) {
                    importStatus = StatusType.healthy
                } else {
                    importStatus = StatusType.empty
                }
            }
        }

        // creating
        switch (cluster?.status) {
            case ClusterStatus.creating:
                creatingStatus = StatusType.progress
                break
            case ClusterStatus.provisionfailed:
                creatingStatus = StatusType.danger
                break
            default: {
                if (importStatus !== StatusType.empty) {
                    creatingStatus = StatusType.healthy
                } else {
                    creatingStatus = StatusType.empty
                }
            }
        }

        // prehook
        switch (cluster?.status) {
            case ClusterStatus.prehookjob:
                prehookStatus = StatusType.progress
                break
            case ClusterStatus.prehookfailed:
                prehookStatus = StatusType.danger
                break
            default:
                prehookStatus = StatusType.healthy
        }

        const provisionStatus: string[] = [
            ClusterStatus.creating,
            ClusterStatus.provisionfailed,
            ClusterStatus.importing,
            ClusterStatus.importfailed,
            ClusterStatus.posthookjob,
            ClusterStatus.posthookfailed,
        ]
        const steps: ProgressTrackerStep[] = [
            {
                statusType: prehookStatus,
                statusText: t('status.prehook.text'),
                statusSubtitle: prehooks ? t(`status.subtitle.${prehookStatus}`) : t('status.subtitle.nojobs'),
                // will render link when prehook job url is defined or when there are no job hooks setup
                link: {
                    linkName: !prehooks && !posthooks ? t('status.link.info') : t('status.link.logs'),
                    // TODO: add ansible documentation url
                    linkUrl:
                        !prehooks && !posthooks
                            ? 'https://access.redhat.com/documentation/en-us/red_hat_advanced_cluster_management_for_kubernetes/2.2/'
                            : latestJobs.prehook?.status?.ansibleJobResult?.url,
                    isDisabled:
                        !prehooks && !posthooks
                            ? false
                            : !!prehooks && latestJobs.prehook?.status?.ansibleJobResult?.url === undefined,
                },
            },
            {
                statusType: creatingStatus,
                statusText: t('status.install.text'),
                statusSubtitle: t(`status.subtitle.${creatingStatus}`),
                ...(provisionStatus.includes(cluster?.status!) && {
                    link: {
                        linkName: t('status.link.logs'),
                        linkCallback: () => launchLogs(cluster!, configMaps),
                    },
                }),
            },
            {
                statusType: importStatus,
                statusText: t('status.import.text'),
                statusSubtitle: t(`status.subtitle.${importStatus}`),
            },
            {
                statusType: posthookStatus,
                statusText: t('status.posthook.text'),
                statusSubtitle: posthooks ? t(`status.subtitle.${posthookStatus}`) : t('status.subtitle.nojobs'),
                ...(posthooks &&
                    latestJobs.posthook?.status?.ansibleJobResult?.url && {
                        link: {
                            linkName: t('status.link.logs'),
                            linkUrl: latestJobs.posthook?.status?.ansibleJobResult?.url,
                            isDisabled: !latestJobs.posthook?.status?.ansibleJobResult?.url,
                        },
                    }),
            },
        ]

        let completedSteps = 0
        steps.forEach((step, index) => {
            if (step.statusType === StatusType.progress) completedSteps = index
        })

        return (
            <div style={{ marginBottom: '24px' }}>
                <Card>
                    <CardBody>
                        <AcmProgressTracker
                            Title={t('status.stepbar.title')}
                            Subtitle={t('status.stepbar.subtitle', { stepsDone: completedSteps, steps: steps.length })}
                            isStacked={false}
                            steps={steps}
                            isCentered={true}
                        ></AcmProgressTracker>
                    </CardBody>
                </Card>
            </div>
        )
    }
    return null
}

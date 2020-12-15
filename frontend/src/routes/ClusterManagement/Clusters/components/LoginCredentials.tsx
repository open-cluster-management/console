import React, { Fragment, useContext, useEffect, useState } from 'react'
import {
    AcmIcon,
    AcmIconVariant,
    AcmButton,
    AcmInlineStatus,
    AcmInlineCopy,
    StatusType,
} from '@open-cluster-management/ui-components'
import { ButtonVariant } from '@patternfly/react-core'
import { useTranslation } from 'react-i18next'
import { ClusterContext } from '../ClusterDetails/ClusterDetails'
import { getSecret, unpackSecret } from '../../../../resources/secret'
import { makeStyles } from '@material-ui/styles'
import { createSubjectAccessReview, ResourceAttributes } from '../../../../resources/self-subject-access-review'
import { WarningModal, IWarningModalProps, ClosedWarningModalProps } from '../../../../components/WarningModal'

export type LoginCredential = {
    username: string
    password: string
}

export type LoginCredentialStyle = {
    disabled: boolean
}

const useStyles = makeStyles({
    toggleButton: {
        paddingLeft: '0 !important',
        '& svg': {
            width: '24px',
            fill: (props: LoginCredentialStyle) => (props.disabled ? '#000' : '#06C'),
        },
        '& span': {
            color: (props: LoginCredentialStyle) => (props.disabled ? '#000' : undefined),
        },
        '& .credentials-toggle': {
            display: 'flex',
            '& svg': {
                marginRight: '0.4rem',
            },
        },
        '&:hover': {
            '& .credentials-toggle svg': {
                fill: 'var(--pf-c-button--m-link--hover--Color)',
            },
        },
    },
    credentialsContainer: {
        '& button': {
            paddingRight: 0,
        },
    },
})

export function LoginCredentials() {
    const { cluster } = useContext(ClusterContext)
    const { t } = useTranslation(['cluster', 'common'])
    const [isVisible, setVisible] = useState<boolean>(false)
    const [loading, setLoading] = useState<boolean>(false)
    const [rbacLoading, setRbacLoading] = useState<boolean>(true)
    const [error, setError] = useState<boolean>(false)
    const [credentials, setCredentials] = useState<LoginCredential | undefined>(undefined)
    const [permissionRestriction, setPermissionRestriction] = useState<boolean>(false)
    const [warning, setWarning] = useState<IWarningModalProps>(ClosedWarningModalProps)
    const disableButton = loading || error || rbacLoading
    const classes = useStyles({ disabled: disableButton } as LoginCredentialStyle)
    
    useEffect(() => {
        // TODO: consolidate common calls in one place
        const resource: ResourceAttributes = {
            name: '',
            namespace: cluster?.namespace!,
            resource: 'secret',
            verb: 'get',
            version: 'v1',
        }

        try {
            const promiseResult = createSubjectAccessReview(resource).promise
            promiseResult.then((result) => {
                setPermissionRestriction(!result.status?.allowed)
            })
        } catch (err) {
            setError(true)
        } finally {
            setRbacLoading(false)
        }
    }, [cluster])

    const onClick = async () => {
        /* istanbul ignore next */
        const namespace = cluster?.namespace ?? ''
        /* istanbul ignore next */
        const name = cluster?.hiveSecrets?.kubeadmin ?? ''
        if (!credentials && !isVisible && cluster?.hiveSecrets?.kubeadmin && !permissionRestriction) {
            setLoading(true)
            try {
                const secret = await getSecret({ name, namespace }).promise
                const { stringData } = unpackSecret(secret)
                setCredentials(stringData as LoginCredential)
                setVisible(!isVisible)
            } catch (err) {
                setError(true)
            } finally {
                setLoading(false)
            }
        } else if (permissionRestriction){
            setWarning({
                open:true,
                confirm:()=>{setWarning(ClosedWarningModalProps)},
                title:t("common:request.failed"),
                message: t("common:rbac.unauthorized")
            })
        } else {
            setVisible(!isVisible)
        }
    }

    if (cluster?.hiveSecrets?.kubeadmin) {
        return (
            <Fragment>
                <WarningModal
                    open={warning.open}
                    confirm={warning.confirm}
                    title={warning.title}
                    message={warning.message}
                ></WarningModal>
                {!isVisible && <div>&#8226;&#8226;&#8226;&#8226;&#8226; / &#8226;&#8226;&#8226;&#8226;&#8226;</div>}
                {isVisible && (
                    <div className={classes.credentialsContainer}>
                        <AcmInlineCopy
                            text={/* istanbul ignore next */ credentials?.username ?? ''}
                            id="username-credentials"
                        />
                        {'  /  '}
                        <AcmInlineCopy
                            text={/* istanbul ignore next */ credentials?.password ?? ''}
                            id="password-credentials"
                        />
                    </div>
                )}
                <AcmButton
                    variant={ButtonVariant.link}
                    className={classes.toggleButton}
                    onClick={onClick}
                    isDisabled={disableButton}
                    id="login-credentials"
                >
                    <Fragment> 
                        {(() => {
                            if (error) {
                                return <AcmInlineStatus type={StatusType.danger} status={t('credentials.failed')} />
                            } else if (loading) {
                                return <AcmInlineStatus type={StatusType.progress} status={t('credentials.loading')} />
                            } else {
                                return (
                                    <div className="credentials-toggle">
                                        <AcmIcon
                                            icon={
                                                isVisible ? AcmIconVariant.visibilityoff : AcmIconVariant.visibilityon
                                            }
                                        />
                                        {isVisible ? t('credentials.hide') : t('credentials.show')}
                                    </div>
                                )
                            }
                        })()}
                    </Fragment>
                </AcmButton>
            </Fragment>
        )
    } else {
        return <>-</>
    }
}

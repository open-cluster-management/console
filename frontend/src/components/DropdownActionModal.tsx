/* Copyright Contributors to the Open Cluster Management project */

import {
    AcmAlert,
    AcmForm,
    AcmFormProvider,
    AcmModal,
    AcmSelect,
    AcmSubmit,
    AcmTable,
    AcmTablePaginationContextProvider,
    AcmTextInput,
    IAcmTableColumn,
} from '@open-cluster-management/ui-components'
import {
    ActionGroup,
    Button,
    ButtonVariant,
    ModalVariant,
    Progress,
    ProgressMeasureLocation,
    SelectOption,
} from '@patternfly/react-core'
import { TableGridBreakpoint } from '@patternfly/react-table'
import { prependListener } from 'node:process'
import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getErrorInfo } from '../components/ErrorPage'
import { IRequestResult, ResourceError, ResourceErrorCode, resultsSettled } from '../lib/resource-request'

export interface IDropdownActionModalProps<T = undefined> {
    open: true
    action: string
    title: string
    processing: string
    selectOptions: Array<string>
    resource: T
    close: () => void
    onCancel?: () => void
    description: string | React.ReactNode
    actionFn?: (item: T, selection: string) => IRequestResult
    //preActionFn?: (items: Array<T>, errors: ItemError<T>[]) => void
    isDanger?: boolean
    isValidError?: (error: Error) => boolean
    emptyState?: JSX.Element
    selectLabel: string
    selectPlaceholder: string
    confirmText: string
}

interface ItemError<T> {
    item: T
    error: Error
}

export function DropdownActionModal<T = unknown>(props: IDropdownActionModalProps<T> | { open: false }) {
    const { t } = useTranslation(['common'])
    const [progress, setProgress] = useState(0)
    const [progressCount, setProgressCount] = useState(0)
    const [confirm, setConfirm] = useState('')
    const [errors, setErrors] = useState<ItemError<T>[] | undefined>()
    const [selection, setSelection] = useState<string | undefined>('')

    useEffect(() => {
        setConfirm('')
        setErrors(undefined)
        setProgress(0)
        setProgressCount(1)
    }, [props.open])

    if (props.open === false) {
        return <></>
    }

    function getItemError(item: T) {
        if (errors) {
            for (const error of errors) {
                if (error.item === item) {
                    return getErrorInfo(error.error)
                }
            }
        }
        return undefined
    }

    return (
        <AcmFormProvider>
            <AcmModal variant={ModalVariant.medium} title={props.title} isOpen={true} onClose={props.close}>
                <AcmForm style={{ gap: 0 }}>
                    {!errors ? (
                        <Fragment>
                            {props.description}
                            <AcmSelect
                                id="modal-selector"
                                toggleId="modal-selector-toggal"
                                label={props.selectLabel}
                                placeholder={props.selectPlaceholder}
                                value={selection}
                                onChange={(selection) => {
                                    setSelection(selection)
                                }}
                                isRequired
                            >
                                {props.selectOptions.map((option) => (
                                    <SelectOption key={option} value={option}>
                                        {option}
                                    </SelectOption>
                                ))}
                            </AcmSelect>
                            <div style={{ paddingTop: '12px', paddingBottom: '12px' }}>
                                {progress > 0 ? (
                                    <Progress
                                        value={(progress * 100) / progressCount}
                                        measureLocation={
                                            progress ? ProgressMeasureLocation.outside : ProgressMeasureLocation.none
                                        }
                                    />
                                ) : (
                                    <div style={{ minHeight: '24px' }} />
                                )}
                            </div>
                        </Fragment>
                    ) : (
                        <Fragment>
                            <AcmAlert isInline noClose variant="danger" title={t('common:there.were.errors')} />
                            <div style={{ minHeight: '24px' }} />
                        </Fragment>
                    )}
                    <ActionGroup>
                        {errors
                            ? [
                                  <Button variant="primary" key="close-action" onClick={props.close}>
                                      {t('common:close')}
                                  </Button>,
                              ]
                            : [
                                  <AcmSubmit
                                      key="submit-action"
                                      id="submit-button"
                                      isDisabled={!selection}
                                      variant={props.isDanger ? ButtonVariant.danger : ButtonVariant.primary}
                                      onClick={async () => {
                                          const errors: ItemError<T>[] = []

                                          if (props.actionFn) {
                                              console.log('running actionFn')
                                              console.log('checking props.reso: ', props.resource)
                                              props
                                                  .actionFn(props.resource, selection as string)
                                                  .promise.catch((err) => {
                                                      console.log('caught err: ', err)
                                                      setErrors([err])
                                                  })
                                                  .then(() => {
                                                      if (!errors) props.close()
                                                      else console.log('error: ', errors)
                                                  })
                                          }
                                      }}
                                      label={props.action}
                                      processingLabel={props.processing}
                                  />,
                                  <Button
                                      variant="link"
                                      onClick={props.onCancel ? props.onCancel : props.close}
                                      key="cancel-bulk-action"
                                  >
                                      {t('common:cancel')}
                                  </Button>,
                              ]}
                    </ActionGroup>
                </AcmForm>
            </AcmModal>
        </AcmFormProvider>
    )
}

export function errorIsNot(codes: ResourceErrorCode[]) {
    return (error: Error) => error instanceof ResourceError && !codes.includes(error.code)
}

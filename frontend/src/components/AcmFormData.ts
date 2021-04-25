/* Copyright Contributors to the Open Cluster Management project */
import { ReactNode } from 'react'

export interface FormData {
    title: string
    titleTooltip: ReactNode
    description?: string
    breadcrumb: { text: string; to?: string }[]
    sections: Section[]
    // toYaml?: () => string
    submit: () => void
    cancel: () => void
    submitText?: string
}

export interface Section {
    name: string
    inputs?: Input[]
    groups?: Group[]
    columns?: 1 | 2
}

export interface Group {
    name: string
    inputs: Input[]
    columns?: 1 | 2
}

export interface InputBase {
    id: string
    isRequired?: boolean | (() => boolean)
    isDisabled?: boolean | (() => boolean)
    isHidden?: boolean | (() => boolean)
    helperText?: string | (() => string)
    placeholder?: string | (() => string)
    labelHelp?: string
    labelHelpTitle?: string
    isSecret?: boolean
}

export interface TextInput extends InputBase {
    type: 'Text'
    label: string
    value: string | (() => string)
    onChange: (value: string) => void
    validation?: (value: string) => string | undefined
}

export interface TextArea extends InputBase {
    type: 'TextArea'
    label: string
    value: string | (() => string)
    onChange: (value: string) => void
    validation?: (value: string) => string | undefined
}

export interface SelectInputOptions {
    id: string
    value: string
    icon?: ReactNode
    text?: string
    description?: string
}

export interface SelectInput extends InputBase {
    type: 'Select'
    label: string
    options: SelectInputOptions[] | (() => SelectInputOptions[])
    value: string | (() => string)
    onChange: (value: string) => void
    validation?: (value: string) => string
    mode?: 'default' | 'tiles' | 'icon'
    isDisplayLarge?: boolean
}

export type Input = TextInput | TextArea | SelectInput
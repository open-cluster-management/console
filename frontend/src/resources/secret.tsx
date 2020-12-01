import { V1ObjectMeta, V1Secret } from '@kubernetes/client-node'
import { getResource } from '../lib/resource-request'
import { IResource } from './resource'

export const SecretApiVersion = 'v1'
export type SecretApiVersionType = 'v1'

export const SecretKind = 'Secret'
export type SecretKindType = 'Secret'

export interface Secret extends V1Secret, IResource {
    apiVersion: SecretApiVersionType
    kind: SecretKindType
    metadata: V1ObjectMeta
}

export function getSecret(metadata: { name: string; namespace: string }) {
    return getResource<Secret>({ apiVersion: SecretApiVersion, kind: SecretKind, metadata })
}

export function unpackSecret(secret: Secret) {
    if (secret.data) {
        if (!secret.stringData) secret.stringData = {}
        for (const key in secret.data) {
            secret.stringData[key] = Buffer.from(secret.data[key], 'base64').toString('ascii')
        }
    }
    return secret
}

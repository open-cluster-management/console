import {
    validateKubernetesDnsName,
    validatePrivateSshKey,
    validatePublicSshKey,
    validateCertificate,
    validateGCProjectID,
    validateJSON,
    validateLibvirtURI,
    validateBaseDnsName,
    validateImageMirror,
} from './validation'

const t = (key: string) => key
describe('validation', () => {
    describe('validateKubernetesDnsName', () => {
        test.each([
            [`should allow lowercase alphabets`, 'abc', true],
            [`should allow empty`, '', true],
            [`should allow number`, '123', true],
            [`should allow name with '-'`, 'ab-c12', true],
            [
                `should not allow name longer than 63`,
                'abcd012345678901234567890123456789012345678901234567890123456789',
                false,
            ],
            [`should not allow '.'`, 'abc.', false],
            [`should not allow '_'`, 'abc_', false],
            [`should not allow start with '-'`, '-abc', false],
            [`should not allow end with '-'`, 'abc-', false],
        ])('%s', (name, value, isValid) => {
            if (!isValid) {
                expect(validateKubernetesDnsName(value, 'test', t)).toBeTruthy()
            } else {
                expect(validateKubernetesDnsName(value, 'test', t)).toBeUndefined()
            }
        })
    })
    describe('validatePrivateSshKey', () => {
        test.each([
            [
                `should allow valid openssh key`,
                '-----BEGIN OPENSSH PRIVATE KEY-----\nkey\n-----END OPENSSH PRIVATE KEY-----',
                true,
            ],
            [`should allow any key`, '-----BEGIN A PRIVATE KEY-----\nabc\n-----END A PRIVATE KEY-----', true],
            [`should not allow empty key type`, '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----', false],
            [
                `should not allow end line next to the begin line`,
                '-----BEGIN A PRIVATE KEY-----\n-----END A PRIVATE KEY-----',
                false,
            ],
        ])('%s', (name, value, isValid) => {
            if (!isValid) {
                expect(validatePrivateSshKey(value, t)).toBeTruthy()
            } else {
                expect(validatePrivateSshKey(value, t)).toBeUndefined()
            }
        })
    })
    describe('validateCertificate', () => {
        test.each([
            [`should allow valid certificate`, '-----BEGIN CERTIFICATE-----\nkey\n-----END CERTIFICATE-----', true],
            [
                `should not allow non certificate type`,
                '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
                false,
            ],
            [
                `should not allow end line next to the begin line`,
                '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----',
                false,
            ],
        ])('%s', (name, value, isValid) => {
            if (!isValid) {
                expect(validateCertificate(value, t)).toBeTruthy()
            } else {
                expect(validateCertificate(value, t)).toBeUndefined()
            }
        })
    })
    describe('validatePublicSshKey', () => {
        test.each([
            [`should allow rsa public key`, 'ssh-rsa AAAAB3Nz', true],
            [`should allow ed25519 public key`, 'ssh-ed25519 AAAAC3', true],
            [`should not allow unsupported type`, 'ssh-abc AAAAB3Nz', false],
            [`should not allow wrong length in key`, 'ssh-rsa AAAAC3', false],
            [`should not allow invalid rsa key`, 'ssh-rsa ABC', false],
            [`should not allow empty input`, '', false],
            [`should not allow invalid character in key`, 'ssh-rsa A@B-C', false],
            [`should not allow non public key`, 'abcdefg', false],
        ])('%s', (name, value, isValid) => {
            if (!isValid) {
                expect(validatePublicSshKey(value, t)).toBeTruthy()
            } else {
                expect(validatePublicSshKey(value, t)).toBeUndefined()
            }
        })
    })
    describe('validateGCProjectID', () => {
        test.each([
            [`should allow lowercase alphabets`, 'abcdefg', true],
            [`should allow number (start with alphabets)`, 'a123456', true],
            [`should allow name with '-'`, 'ab-c123', true],
            [`should not allow less than 6`, 'abc', false],
            [`should not allow longer than 30`, 'a012345678901234567890123456789', false],
            [`should not allow '.'`, 'a.abcdef', false],
            [`should not allow start with '-'`, '-abcdef', false],
            [`should not allow end with '-'`, 'abcdef-', false],
        ])('%s', (name, value, isValid) => {
            if (!isValid) {
                expect(validateGCProjectID(value, t)).toBeTruthy()
            } else {
                expect(validateGCProjectID(value, t)).toBeUndefined()
            }
        })
    })
    describe('validateJSON', () => {
        test.each([
            [`should allow json object with entries`, '{"a":"b","c":"d"}', true],
            [`should allow array with entries`, '[1]', true],
            [`should allow json string`, '"abc"', true],
            [`should not allow empty object`, '{}', false],
            [`should not allow plain string`, 'abc', false],
            [`should not allow non json string`, '{abc:"def"}', false],
            [`should not allow empty string`, '', false],
        ])('%s', (name, value, isValid) => {
            if (!isValid) {
                expect(validateJSON(value, t)).toBeTruthy()
            } else {
                expect(validateJSON(value, t)).toBeUndefined()
            }
        })
    })
    describe('validateLibvirtURI', () => {
        test.each([
            [`should allow qemu+ssh://any`, 'qemu+ssh://any', true],
            [`should not allow only ssh protocols (no qemu)`, 'ssh://any', false],
            [`should not allow only qemu`, 'qemu://any', false],
            [`should not allow empty path`, '"qemu+ssh://"', false],
            [`should not allow non uri`, '"qemu+ssh/b/c"', false],
        ])('%s', (name, value, isValid) => {
            if (!isValid) {
                expect(validateLibvirtURI(value, t)).toBeTruthy()
            } else {
                expect(validateLibvirtURI(value, t)).toBeUndefined()
            }
        })
    })
    describe('validateBaseDnsName', () => {
        test.each([
            [`should allow normal dns name`, 'abc', true],
            [`should allow '.' and '-'`, 'a.b-c.d', true],
            [`should not allow with protocols e.g. http://`, 'http://a.b.c', false],
            [`should not allow start with '.'`, '.abc', false],
            [`should not allow end with '.'`, 'abc.', false],
            [`should not allow start with '-'`, '-abc', false],
        ])('%s', (name, value, isValid) => {
            if (!isValid) {
                expect(validateBaseDnsName(value, t)).toBeTruthy()
            } else {
                expect(validateBaseDnsName(value, t)).toBeUndefined()
            }
        })
    })
    describe('validateImageMirror', () => {
        test.each([
            [`should allow normal image mirror url`, 'abc:123/def', true],
            [`should allow '_' in path`, 'abc:123/a/d_ef', true],
            [`should not allow '_' in first path`, 'abc:123/d_ef', false],
            [`should not allow without port`, 'abc/abc', false],
            [`should not allow if port is not number`, 'abc:d/efg', false],
            [`should not allow host with invalid dns name`, '.abc:123/def', false],
            [`should not allow start with '-'`, '-abc', false],
        ])('%s', (name, value, isValid) => {
            if (!isValid) {
                expect(validateImageMirror(value, t)).toBeTruthy()
            } else {
                expect(validateImageMirror(value, t)).toBeUndefined()
            }
        })
    })
})

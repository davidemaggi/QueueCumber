import process from 'node:process'
import { URL } from 'node:url'
export default () => {
  const publisher = process.env.CODESIGN_CERT_SUBJECT?.trim()
  if (!publisher || publisher.length > 256 || /[\r\n\0]/.test(publisher))
    throw Error('Missing or invalid CODESIGN_CERT_SUBJECT')
  let timestamp
  try {
    timestamp = new URL(process.env.CODESIGN_TIMESTAMP_URL)
    if (
      !['http:', 'https:'].includes(timestamp.protocol) ||
      !timestamp.hostname ||
      timestamp.username ||
      timestamp.password ||
      timestamp.search ||
      timestamp.hash
    )
      throw Error()
  } catch {
    throw Error('Missing or invalid CODESIGN_TIMESTAMP_URL')
  }
  return {
    extends: './electron-builder.yml',
    forceCodeSigning: true,
    artifactName: 'QueueCumber-${version}-win-${arch}-signed.${ext}',
    nsis: {
      artifactName: 'QueueCumber-${version}-win-${arch}-signed-setup.${ext}',
    },
    win: {
      signtoolOptions: {
        certificateSubjectName: publisher,
        publisherName: publisher,
        signingHashAlgorithms: ['sha256'],
        rfc3161TimeStampServer: timestamp.toString(),
      },
    },
  }
}

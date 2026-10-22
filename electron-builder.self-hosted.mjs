import process from 'node:process'
export default () => {
  const thumbprint = process.env.WINDOWS_SIGNING_CERTIFICATE_SHA1,
    publisher = process.env.WINDOWS_SIGNING_PUBLISHER
  if (!/^[a-f0-9]{40}$/i.test(thumbprint ?? ''))
    throw Error('Missing or invalid WINDOWS_SIGNING_CERTIFICATE_SHA1')
  if (!publisher?.trim() || /[\r\n\0]/.test(publisher))
    throw Error('Missing or invalid WINDOWS_SIGNING_PUBLISHER')
  return {
    extends: './electron-builder.yml',
    forceCodeSigning: true,
    artifactName: 'QueueCumber-${version}-win-${arch}-signed.${ext}',
    nsis: {
      artifactName: 'QueueCumber-${version}-win-${arch}-signed-setup.${ext}',
    },
    win: {
      signtoolOptions: {
        certificateSha1: thumbprint,
        publisherName: publisher,
        signingHashAlgorithms: ['sha256'],
      },
    },
  }
}

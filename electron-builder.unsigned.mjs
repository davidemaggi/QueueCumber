export default {
  extends: './electron-builder.yml',
  forceCodeSigning: false,
  artifactName: 'QueueCumber-${version}-${os}-${arch}-unsigned.${ext}',
  nsis: {
    artifactName: 'QueueCumber-${version}-win-${arch}-unsigned-setup.${ext}',
  },
  mac: { identity: '-', notarize: false, hardenedRuntime: false },
}

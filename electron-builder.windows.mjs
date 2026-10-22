import process from 'node:process'
import { windowsSigningConfig } from './scripts/release-config.mjs'
export default () => windowsSigningConfig(process.env)

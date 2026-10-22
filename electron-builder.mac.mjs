import process from 'node:process'
import { macSigningConfig } from './scripts/release-config.mjs'
export default () => macSigningConfig(process.env)

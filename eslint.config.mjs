import js from '@eslint/js'
import ts from 'typescript-eslint'
export default ts.config({ignores:['out/**','dist/**','release/**','node_modules/**','.agents/**','.codex/**','.taste-skill/**','.impeccable/**','.superpowers/**','test-results/**','playwright-report/**']},js.configs.recommended,...ts.configs.recommended,{rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}})

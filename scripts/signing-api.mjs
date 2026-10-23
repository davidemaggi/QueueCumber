import process from 'node:process'
export async function github(
  path,
  token = process.env.GH_TOKEN,
  method = 'GET',
) {
  if (!token) throw Error('GitHub API credential unavailable')
  const response = await globalThis.fetch(
    `${process.env.GITHUB_API_URL || 'https://api.github.com'}/repos/${process.env.GITHUB_REPOSITORY}/${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: globalThis.AbortSignal.timeout(10000),
    },
  )
  if (!response.ok) {
    const error = Error(`GitHub API returned ${response.status}`)
    error.status = response.status
    throw error
  }
  return response.status === 204 || response.status === 202
    ? null
    : response.json()
}

export async function resolveSigningTag(tag) {
  try {
    const result = await github(`commits/${encodeURIComponent(tag)}`)
    if (!/^[a-f0-9]{40}$/.test(result.sha ?? ''))
      throw Error('Invalid tag commit')
    return result.sha
  } catch (error) {
    if (error.status === 404) return undefined
    throw error
  }
}

export async function uploadReleaseAsset(id, name, bytes) {
  if (!Number.isSafeInteger(id) || id <= 0 || !name || /[\\/\r\n\0]/.test(name))
    throw Error('Invalid signed asset destination')
  if (!process.env.GH_TOKEN) throw Error('GitHub API credential unavailable')
  const response = await globalThis.fetch(
    `https://uploads.github.com/repos/${process.env.GITHUB_REPOSITORY}/releases/${id}/assets?name=${encodeURIComponent(name)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/octet-stream',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: bytes,
      signal: globalThis.AbortSignal.timeout(300000),
    },
  )
  if (!response.ok)
    throw Error(`Signed asset upload returned ${response.status}`)
}

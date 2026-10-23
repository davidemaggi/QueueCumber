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
  if (!response.ok) throw Error(`GitHub API returned ${response.status}`)
  return response.status === 204 || response.status === 202
    ? null
    : response.json()
}

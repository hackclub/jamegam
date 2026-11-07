/** Accept only owner/repository names, so substituted values stay shell-safe. */
export function parseGitHubRepository(value) {
  const match = /^([a-z\d](?:[a-z\d-]{0,37}[a-z\d])?)\/([a-z\d._-]{1,100})$/i.exec(value ?? '');
  if (!match || match[2] === '.' || match[2] === '..') return null;
  const [, owner, repo] = match;
  return { owner, repo, github: `${owner}/${repo}`, url: `https://github.com/${owner}/${repo}.git` };
}

/** Templates support {owner}, {repo}, {github}, and {url}. */
export function formatGitHubCommand(template, repository) {
  if (!repository) return template;
  return template.replace(/\{(owner|repo|github|url)\}/g, (_, key) => repository[key]);
}

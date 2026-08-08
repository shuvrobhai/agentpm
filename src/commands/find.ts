export interface FindOptions {
  owner?: string;
}

interface GitHubRepoSearchItem {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
}

interface GitHubRepoSearchResponse {
  items?: GitHubRepoSearchItem[];
  message?: string;
}

function buildQuery(query: string | undefined, owner: string | undefined): string {
  const parts: string[] = ['topic:agent-plugins'];
  if (owner) parts.push(`user:${owner}`);
  if (query && query.trim()) parts.push(query.trim());
  return parts.join(' ');
}

export async function findCommand(query: string | undefined, options: FindOptions = {}): Promise<void> {
  try {
    const q = buildQuery(query, options.owner);
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=10`;

    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'plugins-cli',
      },
    });

    if (!res.ok) {
      throw new Error(`GitHub search failed (${res.status}): ${res.statusText}`);
    }

    const data = (await res.json()) as GitHubRepoSearchResponse;

    if (data.message) {
      console.log(`GitHub search: ${data.message}`);
      return;
    }

    const items = data.items || [];
    console.log(`\n🔍 Plugins matching "${q}":\n`);
    if (items.length === 0) {
      console.log('  (No plugin repositories found)');
      console.log('  Tip: Search GitHub for repos containing a plugin.json manifest.');
      return;
    }

    for (const item of items) {
      const stars = item.stargazers_count > 0 ? ` ⭐ ${item.stargazers_count}` : '';
      console.log(`  • ${item.full_name}${stars}`);
      console.log(`    └ ${item.html_url}`);
      if (item.description) {
        console.log(`      ${item.description}`);
      }
    }
    console.log('');
  } catch (err: any) {
    console.error(`Error searching for plugins: ${err.message}`);
    process.exitCode = 1;
  }
}

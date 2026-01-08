import { Octokit } from '@octokit/rest';

/**
 * Creates an Octokit instance with the provided access token
 * @param {string} accessToken - GitHub personal access token
 * @returns {Octokit} Octokit instance
 */
export function createOctokitInstance(accessToken) {
    return new Octokit({
        auth: accessToken,
    });
}

/**
 * Fetches all repositories for the authenticated user
 * Includes repos where user is owner, collaborator, or organization member
 * @param {string} accessToken - GitHub personal access token
 * @returns {Promise<Array>} Array of repository objects with organization info
 */
export async function fetchAllRepos(accessToken) {
    const octokit = createOctokitInstance(accessToken);

    try {
        // Fetch all repos (owner, collaborator, organization_member)
        const repos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
            affiliation: 'owner,collaborator,organization_member',
            per_page: 100,
            sort: 'updated',
            direction: 'desc',
        });

        // Transform repos to include organization name
        const reposWithOrg = repos.map((repo) => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            owner: repo.owner.login,
            ownerType: repo.owner.type, // 'User' or 'Organization'
            organization: repo.owner.type === 'Organization' ? repo.owner.login : null,
            description: repo.description,
            private: repo.private,
            url: repo.html_url,
            updatedAt: repo.updated_at,
            language: repo.language,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            defaultBranch: repo.default_branch,
        }));

        return reposWithOrg;
    } catch (error) {
        console.error('Error fetching repos:', error);
        throw error;
    }
}

/**
 * Fetches repositories filtered by organization
 * @param {string} accessToken - GitHub personal access token
 * @param {string} orgName - Organization name to filter by
 * @returns {Promise<Array>} Array of repository objects for the organization
 */
export async function fetchReposByOrg(accessToken, orgName) {
    const allRepos = await fetchAllRepos(accessToken);
    return allRepos.filter((repo) => repo.organization === orgName);
}

/**
 * Groups repositories by organization
 * @param {Array} repos - Array of repository objects
 * @returns {Object} Object with organization names as keys and arrays of repos as values
 */
export function groupReposByOrg(repos) {
    const grouped = {
        personal: [], // Repos owned by the user (not in an org)
    };

    repos.forEach((repo) => {
        if (repo.organization) {
            if (!grouped[repo.organization]) {
                grouped[repo.organization] = [];
            }
            grouped[repo.organization].push(repo);
        } else {
            grouped.personal.push(repo);
        }
    });

    return grouped;
}

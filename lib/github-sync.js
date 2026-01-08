import { Octokit } from '@octokit/rest';
import clientPromise from './mongodb';

export const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

// Convert YYYY-MM-DD to DD-MM-YYYY
export function formatDateToDDMMYYYY(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
}

// Convert DD-MM-YYYY to YYYY-MM-DD
export function formatDateToYYYYMMDD(dateStr) {
    const [day, month, year] = dateStr.split('-');
    return `${year}-${month}-${day}`;
}

export function getAllDatesBetween(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        const isoDate = current.toISOString().split('T')[0];
        dates.push(formatDateToDDMMYYYY(isoDate));
        current.setDate(current.getDate() + 1);
    }

    return dates;
}

// Helper function to add delay between API requests
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper function to retry API calls with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const isLastAttempt = attempt === maxRetries - 1;
            const isRateLimit = error.status === 403 || error.status === 429;
            const isServerError = error.status >= 500;
            const isNetworkError = error.code === 'UND_ERR_SOCKET' || error.message?.includes('other side closed');

            if (isLastAttempt || (!isRateLimit && !isServerError && !isNetworkError)) {
                throw error;
            }

            // Exponential backoff: 1s, 2s, 4s
            const delayMs = baseDelay * Math.pow(2, attempt);
            console.log(`Retrying after ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
            await delay(delayMs);
        }
    }
}

export async function fetchGitHubActivity(startDate, endDate) {
    const dailyStats = {};
    // Set since to start of day
    const sinceDate = new Date(startDate);
    sinceDate.setHours(0, 0, 0, 0);
    const sinceISO = sinceDate.toISOString();

    // Set until to end of day (23:59:59.999)
    const untilDate = new Date(endDate);
    untilDate.setHours(23, 59, 59, 999);
    const untilISO = untilDate.toISOString();

    const allDates = getAllDatesBetween(startDate, endDate);
    allDates.forEach((date) => {
        dailyStats[date] = {
            commits: 0,
            prs: 0,
            linesAdded: 0,
            linesDeleted: 0,
            filesChanged: 0,
            repositories: new Set(),
            commitDetails: [],
            prDetails: [],
            issues: 0,
            reviews: 0,
        };
    });

    const { data: user } = await octokit.users.getAuthenticated();
    const username = user.login;

    const allRepos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
        affiliation: 'owner,collaborator,organization_member',
        per_page: 100,
    });

    // Fetch active repos from database
    const client = await clientPromise;
    const db = client.db('github_tracker');
    const collection = db.collection('repositories');
    const activeRepos = await collection.find({ isActive: true }).toArray();

    // Create a set of active repo fullNames for quick lookup
    const activeRepoSet = new Set(activeRepos.map((repo) => repo.fullName));

    // Filter repos to only process active ones
    const repos = allRepos.filter((repo) => {
        const fullName = repo.full_name;
        return activeRepoSet.has(fullName);
    });

    console.log(`Processing ${repos.length} active repositories out of ${allRepos.length} total repositories`);

    // Fetch detailed commit information from all branches
    for (const repo of repos) {
        try {
            // Get all branches for this repository with retry
            const branches = await retryWithBackoff(async () => {
                return await octokit.paginate(octokit.repos.listBranches, {
                    owner: repo.owner.login,
                    repo: repo.name,
                    per_page: 100,
                });
            });

            // Track processed commits by SHA to avoid duplicates across branches
            const processedCommits = new Set();

            // Check commits on each branch
            for (const branch of branches) {
                try {
                    // Add delay between branch requests to avoid overwhelming the API
                    await delay(200);

                    // Try fetching commits with author filter first
                    let commits = await retryWithBackoff(async () => {
                        return await octokit.paginate(octokit.repos.listCommits, {
                            owner: repo.owner.login,
                            repo: repo.name,
                            sha: branch.name,
                            author: username,
                            since: sinceISO,
                            until: untilISO,
                            per_page: 100,
                        });
                    });

                    console.log(`Found ${commits.length} commits for ${repo.name}/${branch.name}`);

                    // If no commits found with author filter, try without it (then filter manually)
                    if (commits.length === 0) {
                        console.log(`No commits found with author filter, trying without author filter...`);
                        const allCommits = await retryWithBackoff(async () => {
                            return await octokit.paginate(octokit.repos.listCommits, {
                                owner: repo.owner.login,
                                repo: repo.name,
                                sha: branch.name,
                                since: sinceISO,
                                until: untilISO,
                                per_page: 100,
                            });
                        });

                        // Filter commits by author manually
                        commits = allCommits.filter((commit) => {
                            const commitAuthor = commit.commit.author.name || commit.author?.login || '';
                            const commitEmail = commit.commit.author.email || '';
                            return (
                                commitAuthor.toLowerCase().includes(username.toLowerCase()) ||
                                commitEmail.toLowerCase().includes(username.toLowerCase()) ||
                                commit.author?.login === username
                            );
                        });

                        console.log(
                            `Found ${allCommits.length} total commits, ${commits.length} match author ${username}`,
                        );
                    }

                    for (const commit of commits) {
                        // Skip if we've already processed this commit
                        if (processedCommits.has(commit.sha)) {
                            continue;
                        }
                        processedCommits.add(commit.sha);

                        const isoDate = commit.commit.author.date.split('T')[0];
                        const date = formatDateToDDMMYYYY(isoDate);

                        if (dailyStats[date]) {
                            dailyStats[date].commits += 1;
                            dailyStats[date].repositories.add(repo.name);

                            // Fetch detailed commit info with retry
                            try {
                                // Add small delay before fetching commit details
                                await delay(100);

                                const commitDetails = await retryWithBackoff(async () => {
                                    return await octokit.repos.getCommit({
                                        owner: repo.owner.login,
                                        repo: repo.name,
                                        ref: commit.sha,
                                    });
                                });

                                const stats = commitDetails.data.stats || {};
                                dailyStats[date].linesAdded += stats.additions || 0;
                                dailyStats[date].linesDeleted += stats.deletions || 0;
                                dailyStats[date].filesChanged += commitDetails.data.files?.length || 0;

                                // Store commit details
                                dailyStats[date].commitDetails.push({
                                    sha: commit.sha.substring(0, 7),
                                    message: commit.commit.message,
                                    repository: repo.name,
                                    url: commit.html_url,
                                    additions: stats.additions || 0,
                                    deletions: stats.deletions || 0,
                                    filesChanged: commitDetails.data.files?.length || 0,
                                    timestamp: commit.commit.author.date,
                                });
                            } catch (error) {
                                console.error(`Error fetching commit details for ${commit.sha}:`, error);
                                // If we can't get detailed stats, just count the commit
                                dailyStats[date].commitDetails.push({
                                    sha: commit.sha.substring(0, 7),
                                    message: commit.commit.message,
                                    repository: repo.name,
                                    url: commit.html_url,
                                    additions: 0,
                                    deletions: 0,
                                    filesChanged: 0,
                                    timestamp: commit.commit.author.date,
                                });
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error fetching commits for ${repo.name} branch ${branch.name}:`, error);
                    // Continue to next branch even if this one fails
                }

                // Add delay between repositories to avoid rate limiting
                await delay(300);
            }
        } catch (error) {
            console.error(`Error fetching branches for ${repo.name}:`, error);
        }
    }

    // Fetch detailed PR information
    try {
        const searchQuery = `is:pr author:${username} created:${startDate}..${endDate}`;
        const searchResults = await octokit.paginate(octokit.search.issuesAndPullRequests, {
            q: searchQuery,
            per_page: 100,
        });

        for (const pr of searchResults) {
            const createdDate = new Date(pr.created_at);
            const isoDate = createdDate.toISOString().split('T')[0];
            const date = formatDateToDDMMYYYY(isoDate);

            if (dailyStats[date]) {
                dailyStats[date].prs += 1;

                // Extract repo name from URL
                const repoName = pr.repository_url.split('/').slice(-1)[0];
                dailyStats[date].repositories.add(repoName);

                // Store PR details
                dailyStats[date].prDetails.push({
                    number: pr.number,
                    title: pr.title,
                    repository: repoName,
                    state: pr.state,
                    url: pr.html_url,
                    merged: pr.pull_request?.merged_at ? true : false,
                    createdAt: pr.created_at,
                    closedAt: pr.closed_at,
                    mergedAt: pr.pull_request?.merged_at,
                    comments: pr.comments,
                    labels: pr.labels.map((l) => l.name),
                });
            }
        }
    } catch (error) {
        console.error('Error fetching PRs:', error);
    }

    // Fetch issues created
    try {
        const issuesQuery = `is:issue author:${username} created:${startDate}..${endDate}`;
        const issues = await octokit.paginate(octokit.search.issuesAndPullRequests, {
            q: issuesQuery,
            per_page: 100,
        });

        issues.forEach((issue) => {
            const createdDate = new Date(issue.created_at);
            const isoDate = createdDate.toISOString().split('T')[0];
            const date = formatDateToDDMMYYYY(isoDate);

            if (dailyStats[date]) {
                dailyStats[date].issues += 1;
            }
        });
    } catch (error) {
        console.error('Error fetching issues:', error);
    }

    // Convert repositories Set to Array for storage
    Object.keys(dailyStats).forEach((date) => {
        dailyStats[date].repositories = Array.from(dailyStats[date].repositories);
    });

    return dailyStats;
}

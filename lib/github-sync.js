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

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

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

            const delayMs = baseDelay * Math.pow(2, attempt);
            console.log(`Retrying after ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
            await delay(delayMs);
        }
    }
}

async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await fn(items[index], index);
        }
    }

    const workerCount = Math.min(limit, items.length);
    await Promise.all(Array.from({ length: workerCount }, worker));
    return results;
}

function createEmptyDayStats() {
    return {
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
}

function normalizeCommit(commit) {
    const repository = commit.repository || {};
    const ownerLogin = repository.owner?.login || repository.full_name?.split('/')[0];
    const repoName = repository.name || repository.full_name?.split('/')[1];

    return {
        sha: commit.sha,
        htmlUrl: commit.html_url,
        message: commit.commit?.message || '',
        timestamp: commit.commit?.author?.date || commit.commit?.committer?.date,
        owner: ownerLogin,
        repoName,
        fullName: repository.full_name || (ownerLogin && repoName ? `${ownerLogin}/${repoName}` : null),
    };
}

function isOwnCommit(commit, { username, emails, displayName }) {
    const login = commit.author?.login || commit.committer?.login || '';
    if (login && login.toLowerCase() === username.toLowerCase()) {
        return true;
    }

    const commitEmail = (commit.commit?.author?.email || '').toLowerCase();
    if (commitEmail && emails.has(commitEmail)) {
        return true;
    }

    const commitName = (commit.commit?.author?.name || '').toLowerCase();
    if (displayName && commitName === displayName.toLowerCase()) {
        return true;
    }

    return false;
}

async function getAuthorIdentities(user) {
    const emails = new Set();

    try {
        const listedEmails = await octokit.paginate(octokit.users.listEmailsForAuthenticatedUser, {
            per_page: 100,
        });
        listedEmails.forEach((item) => {
            if (item.email) {
                emails.add(item.email.toLowerCase());
            }
        });
    } catch (error) {
        console.warn('Could not list authenticated emails; username search only:', error.message);
    }

    if (user.email) {
        emails.add(user.email.toLowerCase());
    }

    return {
        username: user.login,
        displayName: user.name || '',
        emails,
    };
}

async function searchCommitsForUser({ username, emails, startDate, endDate }) {
    const dateRange = `${startDate}..${endDate}`;
    const queries = [`author:${username} author-date:${dateRange}`];

    emails.forEach((email) => {
        queries.push(`author-email:${email} author-date:${dateRange}`);
    });

    const bySha = new Map();

    for (const [index, query] of queries.entries()) {
        const queryLabel = index === 0 ? `author:${username}` : `author-email (${index}/${queries.length - 1})`;
        console.log(`Searching commits with ${queryLabel} for ${dateRange}`);

        const items = await retryWithBackoff(async () => {
            return await octokit.paginate(octokit.search.commits, {
                q: query,
                per_page: 100,
            });
        });

        items.forEach((item) => {
            if (item?.sha && !bySha.has(item.sha)) {
                bySha.set(item.sha, item);
            }
        });

        // Search API is limited to ~30 requests/minute
        if (index < queries.length - 1) {
            await delay(800);
        }
    }

    return [...bySha.values()];
}

function attachRepository(commit, fullName) {
    const [owner, name] = (fullName || '').split('/');
    return {
        ...commit,
        repository: {
            full_name: fullName,
            name,
            owner: { login: owner },
        },
    };
}

function mergeCommitsBySha(...groups) {
    const bySha = new Map();
    groups.flat().forEach((commit) => {
        if (commit?.sha && !bySha.has(commit.sha)) {
            bySha.set(commit.sha, commit);
        }
    });
    return [...bySha.values()];
}

async function fetchPushEventCommits({ username, emails, displayName, startDate, endDate, activeRepoSet }) {
    const rangeStart = new Date(`${startDate}T00:00:00.000Z`);
    rangeStart.setDate(rangeStart.getDate() - 2);
    const rangeEnd = new Date(`${endDate}T23:59:59.999Z`);
    rangeEnd.setDate(rangeEnd.getDate() + 2);

    let events = [];
    try {
        events = await retryWithBackoff(async () => {
            return await octokit.paginate(octokit.activity.listEventsForAuthenticatedUser, {
                username,
                per_page: 100,
            });
        });
    } catch (error) {
        console.error('Error fetching user push events:', error.message);
        return [];
    }

    const commits = [];
    for (const event of events) {
        if (event.type !== 'PushEvent') {
            continue;
        }

        const createdAt = new Date(event.created_at);
        if (createdAt < rangeStart || createdAt > rangeEnd) {
            continue;
        }

        const fullName = event.repo?.name;
        if (!fullName || !activeRepoSet.has(fullName)) {
            continue;
        }

        (event.payload?.commits || []).forEach((payloadCommit) => {
            if (payloadCommit.distinct === false) {
                return;
            }

            const commit = attachRepository(
                {
                    sha: payloadCommit.sha,
                    html_url: `https://github.com/${fullName}/commit/${payloadCommit.sha}`,
                    commit: {
                        message: payloadCommit.message,
                        author: {
                            name: payloadCommit.author?.name,
                            email: payloadCommit.author?.email,
                            date: event.created_at,
                        },
                    },
                },
                fullName,
            );

            if (isOwnCommit(commit, { username, emails, displayName })) {
                commits.push(commit);
            }
        });
    }

    console.log(`Push events contributed ${commits.length} candidate commits`);
    return commits;
}

async function fetchPullRequestCommits({ username, emails, displayName, startDate, endDate, activeRepoSet }) {
    const query = `is:pr author:${username} updated:${startDate}..${endDate}`;
    let pullRequests = [];

    try {
        pullRequests = await retryWithBackoff(async () => {
            return await octokit.paginate(octokit.search.issuesAndPullRequests, {
                q: query,
                per_page: 100,
            });
        });
    } catch (error) {
        console.error('Error searching pull requests for commits:', error.message);
        return [];
    }

    const commits = [];
    for (const pr of pullRequests) {
        const repoUrlParts = pr.repository_url.split('/');
        const repoName = repoUrlParts.pop();
        const owner = repoUrlParts.pop();
        const fullName = `${owner}/${repoName}`;

        if (!activeRepoSet.has(fullName)) {
            continue;
        }

        try {
            const prCommits = await retryWithBackoff(async () => {
                return await octokit.paginate(octokit.pulls.listCommits, {
                    owner,
                    repo: repoName,
                    pull_number: pr.number,
                    per_page: 100,
                });
            });

            prCommits.forEach((commit) => {
                const isoDate = commit.commit?.author?.date?.split('T')[0];
                if (!isoDate || isoDate < startDate || isoDate > endDate) {
                    return;
                }
                if (!isOwnCommit(commit, { username, emails, displayName })) {
                    return;
                }
                commits.push(attachRepository(commit, fullName));
            });
        } catch (error) {
            console.error(`Error listing commits for ${fullName}#${pr.number}:`, error.message);
        }

        await delay(100);
    }

    console.log(`Pull requests contributed ${commits.length} candidate commits`);
    return commits;
}

async function fetchCommitsFromDefaultBranches(repos, { username, emails, displayName, sinceISO, untilISO }) {
    const authors = [username, ...emails];
    const bySha = new Map();

    for (const repo of repos) {
        const owner = repo.owner;
        const name = repo.name;
        const sha = repo.defaultBranch || 'main';

        try {
            let foundForRepo = 0;

            for (const author of authors) {
                const commits = await retryWithBackoff(async () => {
                    return await octokit.paginate(octokit.repos.listCommits, {
                        owner,
                        repo: name,
                        sha,
                        author,
                        since: sinceISO,
                        until: untilISO,
                        per_page: 100,
                    });
                });

                commits.forEach((commit) => {
                    if (!bySha.has(commit.sha)) {
                        bySha.set(commit.sha, {
                            ...commit,
                            repository: {
                                full_name: repo.fullName,
                                name: repo.name,
                                owner: { login: owner },
                            },
                        });
                        foundForRepo += 1;
                    }
                });
            }

            if (foundForRepo === 0) {
                const unfiltered = await retryWithBackoff(async () => {
                    return await octokit.paginate(octokit.repos.listCommits, {
                        owner,
                        repo: name,
                        sha,
                        since: sinceISO,
                        until: untilISO,
                        per_page: 100,
                    });
                });

                unfiltered.filter((commit) => isOwnCommit(commit, { username, emails, displayName })).forEach((commit) => {
                    if (!bySha.has(commit.sha)) {
                        bySha.set(commit.sha, {
                            ...commit,
                            repository: {
                                full_name: repo.fullName,
                                name: repo.name,
                                owner: { login: owner },
                            },
                        });
                        foundForRepo += 1;
                    }
                });
            }

            console.log(`Default branch ${repo.fullName}/${sha}: ${foundForRepo} matching commits`);
        } catch (error) {
            if (error.status === 409) {
                console.log(`Skipping empty repository ${repo.fullName}`);
                continue;
            }
            console.error(`Error listing default-branch commits for ${repo.fullName}:`, error.message);
        }

        await delay(150);
    }

    return [...bySha.values()];
}

async function enrichAndStoreCommits(commits, dailyStats, activeRepoSet) {
    const uniqueCommits = [];
    const seen = new Set();

    for (const commit of commits) {
        const normalized = normalizeCommit(commit);
        if (!normalized.sha || !normalized.fullName || seen.has(normalized.sha)) {
            continue;
        }
        if (activeRepoSet.size > 0 && !activeRepoSet.has(normalized.fullName)) {
            continue;
        }
        seen.add(normalized.sha);
        uniqueCommits.push(normalized);
    }

    console.log(`Enriching stats for ${uniqueCommits.length} unique commits in active repositories`);

    await mapWithConcurrency(uniqueCommits, 4, async (commit) => {
        let timestamp = commit.timestamp;
        let message = commit.message;
        let additions = 0;
        let deletions = 0;
        let filesChanged = 0;

        try {
            const commitDetails = await retryWithBackoff(async () => {
                return await octokit.repos.getCommit({
                    owner: commit.owner,
                    repo: commit.repoName,
                    ref: commit.sha,
                });
            });
            timestamp = commitDetails.data.commit?.author?.date || timestamp;
            message = commitDetails.data.commit?.message || message;
            additions = commitDetails.data.stats?.additions || 0;
            deletions = commitDetails.data.stats?.deletions || 0;
            filesChanged = commitDetails.data.files?.length || 0;
        } catch (error) {
            console.error(`Error fetching commit details for ${commit.sha}:`, error.message);
        }

        const isoDate = timestamp?.split('T')[0];
        if (!isoDate) {
            return;
        }

        const date = formatDateToDDMMYYYY(isoDate);
        const dayStats = dailyStats[date];
        if (!dayStats) {
            return;
        }

        dayStats.commits += 1;
        dayStats.repositories.add(commit.repoName);
        dayStats.linesAdded += additions;
        dayStats.linesDeleted += deletions;
        dayStats.filesChanged += filesChanged;
        dayStats.commitDetails.push({
            sha: commit.sha.substring(0, 7),
            message,
            repository: commit.repoName,
            url: commit.htmlUrl,
            additions,
            deletions,
            filesChanged,
            timestamp,
        });
    });
}

export async function fetchGitHubActivity(startDate, endDate) {
    const dailyStats = {};
    const sinceDate = new Date(startDate);
    sinceDate.setHours(0, 0, 0, 0);
    const sinceISO = sinceDate.toISOString();

    const untilDate = new Date(endDate);
    untilDate.setHours(23, 59, 59, 999);
    const untilISO = untilDate.toISOString();

    const allDates = getAllDatesBetween(startDate, endDate);
    allDates.forEach((date) => {
        dailyStats[date] = createEmptyDayStats();
    });

    const { data: user } = await octokit.users.getAuthenticated();
    const identities = await getAuthorIdentities(user);
    const username = identities.username;

    const client = await clientPromise;
    const db = client.db('github_tracker');
    const collection = db.collection('repositories');
    const activeRepos = await collection.find({ isActive: true }).toArray();
    const activeRepoSet = new Set(activeRepos.map((repo) => repo.fullName).filter(Boolean));

    console.log(`Syncing commits for ${username} across ${activeRepos.length} active repositories`);

    let searchCommits = [];
    try {
        const searchResults = await searchCommitsForUser({
            username,
            emails: identities.emails,
            startDate,
            endDate,
        });
        searchCommits = searchResults.filter((commit) => {
            const fullName = commit.repository?.full_name;
            return fullName && activeRepoSet.has(fullName);
        });
        console.log(
            `Commit search returned ${searchResults.length} unique commits, ${searchCommits.length} in active repositories`,
        );
    } catch (error) {
        console.error('Commit search failed:', error.message);
    }

    const [eventCommits, prCommits] = await Promise.all([
        fetchPushEventCommits({
            username,
            emails: identities.emails,
            displayName: identities.displayName,
            startDate,
            endDate,
            activeRepoSet,
        }),
        fetchPullRequestCommits({
            username,
            emails: identities.emails,
            displayName: identities.displayName,
            startDate,
            endDate,
            activeRepoSet,
        }),
    ]);

    let commits = mergeCommitsBySha(searchCommits, eventCommits, prCommits);

    if (commits.length === 0) {
        console.log('No search/event/PR hits; checking default branches only (not every feature branch)');
        commits = await fetchCommitsFromDefaultBranches(activeRepos, {
            username,
            emails: identities.emails,
            displayName: identities.displayName,
            sinceISO,
            untilISO,
        });
        console.log(`Default-branch fallback found ${commits.length} unique commits`);
    }

    console.log(`Processing ${commits.length} unique commits after dedupe`);
    await enrichAndStoreCommits(commits, dailyStats, activeRepoSet);

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

                const repoName = pr.repository_url.split('/').slice(-1)[0];
                dailyStats[date].repositories.add(repoName);

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

    Object.keys(dailyStats).forEach((date) => {
        dailyStats[date].repositories = Array.from(dailyStats[date].repositories);
        dailyStats[date].commitDetails.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    });

    return dailyStats;
}

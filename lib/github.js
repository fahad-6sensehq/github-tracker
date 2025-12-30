import { Octokit } from '@octokit/rest';

export const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
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

export async function fetchGitHubActivity(startDate, endDate) {
    const dailyStats = {};
    const sinceISO = new Date(startDate).toISOString();
    const untilISO = new Date(endDate).toISOString();

    const allDates = getAllDatesBetween(startDate, endDate);
    allDates.forEach(date => {
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
            reviews: 0
        };
    });

    const { data: user } = await octokit.users.getAuthenticated();
    const username = user.login;

    const repos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
        affiliation: 'owner,collaborator,organization_member',
        per_page: 100
    });

    // Fetch detailed commit information
    for (const repo of repos) {
        try {
            const commits = await octokit.paginate(octokit.repos.listCommits, {
                owner: repo.owner.login,
                repo: repo.name,
                author: username,
                since: sinceISO,
                until: untilISO,
                per_page: 100
            });

            for (const commit of commits) {
                const isoDate = commit.commit.author.date.split('T')[0];
                const date = formatDateToDDMMYYYY(isoDate);

                if (dailyStats[date]) {
                    dailyStats[date].commits += 1;
                    dailyStats[date].repositories.add(repo.name);

                    // Fetch detailed commit info
                    try {
                        const commitDetails = await octokit.repos.getCommit({
                            owner: repo.owner.login,
                            repo: repo.name,
                            ref: commit.sha
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
                            timestamp: commit.commit.author.date
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
                            timestamp: commit.commit.author.date
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`Error fetching commits for ${repo.name}:`, error);
        }
    }

    // Fetch detailed PR information
    try {
        const searchQuery = `is:pr author:${username} created:${startDate}..${endDate}`;
        const searchResults = await octokit.paginate(octokit.search.issuesAndPullRequests, {
            q: searchQuery,
            per_page: 100
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
                    labels: pr.labels.map(l => l.name)
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
            per_page: 100
        });

        issues.forEach(issue => {
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
    Object.keys(dailyStats).forEach(date => {
        dailyStats[date].repositories = Array.from(dailyStats[date].repositories);
    });

    return dailyStats;
}

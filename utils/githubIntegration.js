const axios = require('axios');

/**
 * GitHub API integration utilities
 */
class GitHubIntegration {
    constructor() {
        this.baseUrl = 'https://api.github.com';
        this.graphqlUrl = 'https://api.github.com/graphql';
        this.headers = {
            Accept: 'application/vnd.github.v3+json',
        };
        
        // Set GitHub token if available
        if (process.env.GITHUB_TOKEN) {
            this.headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
        }
    }

    /**
     * Set GitHub API token
     * @param {String} token - GitHub personal access token
     */
    setToken(token) {
        this.headers.Authorization = `token ${token}`;
    }

    /**
     * Fetch basic user profile
     * @param {String} username - GitHub username
     * @returns {Promise<Object>} User profile data
     */
    async getUserProfile(username) {
        try {
            const response = await axios.get(`${this.baseUrl}/users/${username}`, {
                headers: this.headers
            });
            
            return response.data;
        } catch (error) {
            console.error(`Error fetching GitHub profile for ${username}:`, error.message);
            if (error.response) {
                console.error(`Status: ${error.response.status}, Data:`, error.response.data);
            }
            throw error;
        }
    }

    /**
     * Fetch user's repositories
     * @param {String} username - GitHub username
     * @param {Number} perPage - Results per page (max 100)
     * @param {Number} page - Page number
     * @returns {Promise<Array>} Repositories data
     */
    async getUserRepositories(username, perPage = 100, page = 1) {
        try {
            const response = await axios.get(`${this.baseUrl}/users/${username}/repos`, {
                headers: this.headers,
                params: {
                    per_page: perPage,
                    page,
                    sort: 'updated',
                    direction: 'desc'
                }
            });
            
            return response.data;
        } catch (error) {
            console.error(`Error fetching repositories for ${username}:`, error.message);
            throw error;
        }
    }

    /**
     * Fetch contribution calendar data using GraphQL API
     * @param {String} username - GitHub username
     * @returns {Promise<Object>} Contribution calendar data
     */
    async getContributionCalendar(username) {
        try {
            const query = `
                query {
                    user(login: "${username}") {
                        contributionsCollection {
                            contributionCalendar {
                                totalContributions
                                weeks {
                                    contributionDays {
                                        date
                                        contributionCount
                                        color
                                    }
                                }
                            }
                        }
                    }
                }
            `;
            
            const response = await axios.post(
                this.graphqlUrl,
                { query },
                { headers: this.headers }
            );
            
            if (response.data.errors) {
                throw new Error(response.data.errors[0].message);
            }
            
            return response.data.data.user.contributionsCollection.contributionCalendar;
        } catch (error) {
            console.error(`Error fetching contribution calendar for ${username}:`, error.message);
            throw error;
        }
    }

    /**
     * Fetch recent contributions (commits, issues, PRs)
     * @param {String} username - GitHub username
     * @param {Number} days - Number of days to look back
     * @returns {Promise<Object>} Recent contributions
     */
    async getRecentContributions(username, days = 30) {
        try {
            const since = new Date();
            since.setDate(since.getDate() - days);
            
            const query = `
                query {
                    user(login: "${username}") {
                        contributionsCollection(from: "${since.toISOString()}") {
                            totalCommitContributions
                            totalIssueContributions
                            totalPullRequestContributions
                            totalPullRequestReviewContributions
                            
                            commitContributionsByRepository(maxRepositories: 100) {
                                repository {
                                    name
                                    url
                                }
                                contributions {
                                    totalCount
                                }
                            }
                            
                            issueContributionsByRepository(maxRepositories: 100) {
                                repository {
                                    name
                                    url
                                }
                                contributions {
                                    totalCount
                                }
                            }
                            
                            pullRequestContributionsByRepository(maxRepositories: 100) {
                                repository {
                                    name
                                    url
                                }
                                contributions {
                                    totalCount
                                }
                            }
                        }
                    }
                }
            `;
            
            const response = await axios.post(
                this.graphqlUrl,
                { query },
                { headers: this.headers }
            );
            
            if (response.data.errors) {
                throw new Error(response.data.errors[0].message);
            }
            
            return response.data.data.user.contributionsCollection;
        } catch (error) {
            console.error(`Error fetching recent contributions for ${username}:`, error.message);
            throw error;
        }
    }

    /**
     * Calculate score based on GitHub activity
     * Scoring weights can be adjusted as needed
     * @param {Object} data - GitHub data
     * @returns {Object} Score data
     */
    calculateGitHubScore(data) {
        const {
            profile = {},
            repositories = [],
            contributionCalendar = { totalContributions: 0 },
            recentContributions = {}
        } = data;
        
        // Scoring constants - can be adjusted
        const SCORE_WEIGHTS = {
            TOTAL_CONTRIBUTIONS: 1,      // Points per contribution
            REPOSITORIES: 10,            // Points per repository
            STARS: 5,                    // Points per star
            FORKS: 3,                    // Points per fork
            COMMITS: 1,                  // Points per commit
            ISSUES: 2,                   // Points per issue
            PULL_REQUESTS: 5,            // Points per PR
            CODE_REVIEWS: 2              // Points per code review
        };
        
        // Calculate repo scores
        const repoScores = repositories.map(repo => {
            const repoScore = SCORE_WEIGHTS.REPOSITORIES + 
                (repo.stargazers_count * SCORE_WEIGHTS.STARS) + 
                (repo.forks_count * SCORE_WEIGHTS.FORKS);
            
            return {
                name: repo.name,
                url: repo.html_url,
                stars: repo.stargazers_count,
                forks: repo.forks_count,
                score: repoScore
            };
        });
        
        // Calculate contributions score
        const contributionsScore = contributionCalendar.totalContributions * SCORE_WEIGHTS.TOTAL_CONTRIBUTIONS;
        
        // Calculate recent activity score
        let recentActivityScore = 0;
        if (recentContributions) {
            recentActivityScore += (recentContributions.totalCommitContributions || 0) * SCORE_WEIGHTS.COMMITS;
            recentActivityScore += (recentContributions.totalIssueContributions || 0) * SCORE_WEIGHTS.ISSUES;
            recentActivityScore += (recentContributions.totalPullRequestContributions || 0) * SCORE_WEIGHTS.PULL_REQUESTS;
            recentActivityScore += (recentContributions.totalPullRequestReviewContributions || 0) * SCORE_WEIGHTS.CODE_REVIEWS;
        }
        
        // Total GitHub score
        const totalRepoScore = repoScores.reduce((sum, repo) => sum + repo.score, 0);
        const totalScore = contributionsScore + recentActivityScore + totalRepoScore;
        
        return {
            repositories: repoScores,
            contributionsScore,
            recentActivityScore,
            totalRepoScore,
            totalScore
        };
    }
}

module.exports = new GitHubIntegration(); 
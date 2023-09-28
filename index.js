// github action script
// script to update the database
// we will get the user stats for all the users
// compile them and send them over to the main server
// ---
const { Octokit } = require("octokit"); // npm install @octokit/rest
const fs = require('fs');
const axios = require('axios');
// create a fetch simulation wGith axios
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

function sendToServer(data) {

    axios.post('https://coral-app-fwssm.ondigitalocean.app/github/orgrank/upload', data)
        .then((res) => {
            console.log(`statusCode: ${res.statusCode}`)
            console.log(res)
        })
        .catch((error) => {
        })
}

// get the owner of the repo this is running in
let currentOwner = 'velocitatem'
    //process.env.GITHUB_REPOSITORY.split('/')[0];

const users =  [currentOwner];
      /*

  'followers',
  'commits',
  'pull_requests',
  'stars',
  'following',
  'public_repos',
  'public_gists'
  */
let metrics = {
    commits: {

        get: (username) => {
            return octokit.request('GET /search/commits', {
                q: `author:${username}+committer:${username}`,
            });
        }
    },
    pull_requests: {

        get: (username) => {
            return octokit.request('GET /search/issues', {
                q: `type:pr+author:${username}`,
            });
        }
    },
    about: {

        get: (username) => {
            // get followers, following, public repos, public gists, id
            return octokit.request('GET /users/{username}', {
                username: username,
            }).then((response) => {
                return {
                    data: {
                        total_count: {
                            followers: response.data.followers,
                            following: response.data.following,
                            public_repos: response.data.public_repos,
                            public_gists: response.data.public_gists,
                            id: response.data.id
                        }
                    }
                }
            })
        }
    },
    stars: { // number of stars on all repos

        get: (username) => {
            return octokit.request('GET /search/repositories', {
                q: `user:${username}`,
            }).then((response) => {
                let stars = 0;
                response.data.items.forEach((repo) => {
                    stars += repo.stargazers_count;
                });
                return {
                    data: { total_count: stars }
                }
            });
        }
    },
    // metric of the total number of lines of code changed in all the repos
    // in the past 24 hours
    cc: {

        get: (username) => {

            return octokit.request('GET /search/commits', {
                q: `author:${username}+committer:${username}+committer-date:>${new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString()}`,
            }).then((response) => {
                let cc = 0;

                // stats not included, so we have to get the commit
                // also avoid rate limit
                let commits = response.data.items;
                // avoid rate limit
                if (commits.length > 10) {
                    commits = commits.slice(0, 10);
                }
                let promises = commits.map((commit) => {
                    return octokit.request('GET /repos/{owner}/{repo}/commits/{ref}', {
                        owner: commit.repository.owner.login,
                        repo: commit.repository.name,
                        ref: commit.sha
                    }).then((response) => {
                        let stats = response.data.stats;
                        cc += stats.total;
                    });
                });
                return Promise.all(promises).then(() => {
                    return {
                        data: { total_count: cc }
                    }
                });
            });
        }
    }
};

async function main() {
    let data = users.map(async (user) => {
        let data = {
            username: user,
            date: new Date()
        };
        // test only public_repos
        for (let metric in metrics) {
            console.log(`Getting ${metric} for ${user}`);
            let response = await metrics[metric].get(user);
            data[metric] = response.data.total_count;
        }
        return data;
    });
    data = await Promise.all(data);
    // sendToServer(data);
    console.log(data);
}

main();

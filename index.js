// github action script
// script to update the database
// we will get the user stats for all the users
// compile them and send them over to the main server
// ---
const { Octokit } = require("octokit"); // npm install @octokit/rest
const fs = require('fs');
import fetch from 'node-fetch';
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
    request: {
        fetch: fetch
    }
});
const axios = require('axios');

function sendToServer(data) {
    // save to data.json
    fs.writeFile('data.json', JSON.stringify(data), (err) => {
        if (err) {
            console.error(err)
            return
        }
        //file written successfully
    })

    axios.post('https://coral-app-fwssm.ondigitalocean.app/github/orgrank/upload', data)
        .then((res) => {
            console.log(`statusCode: ${res.statusCode}`)
            console.log(res)
        })
        .catch((error) => {
        })
}

// get the owner of the repo this is running in
let currentOwner = process.env.GITHUB_REPOSITORY.split('/')[0];

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
    followers: {

        get: (username) => {
            return octokit.request('GET /users/{username}/followers', {
                username: username,
            }).then((response) => {
                return {
                    data: { total_count: response.data.length }
                }
            });
        }
    },
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
    following: {

        get: (username) => {
            return octokit.request('GET /users/{username}/following', {
                username: username,
            }).then((response) => {
                return {
                    data: { total_count: response.data.length }
                }
            });
        }
    },
    public_repos: {

        get: (username) => {
            return octokit.request('GET /users/{username}/repos', {
                username: username,
            }).then((response) => {
                return {
                    data: { total_count: response.data.length }
                }
            });
        }
    },
    public_gists: {

        get: (username) => {
            return octokit.request('GET /users/{username}/gists', {
                username: username,
            }).then((response) => {
                return {
                    data: { total_count: response.data.length }
                }
            })
        }
    }
};

async function main() {
    let data = users.map(async (user) => {
        let data = {
            username: user,
            date: new Date()
        };
        for (let metric in metrics) {
            let response = await metrics[metric].get(user);
            data[metric] = response.data.total_count;
        }
        return data;
    });
    data = await Promise.all(data);
    sendToServer(data);
}

main();

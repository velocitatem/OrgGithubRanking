// github action script
// script to update the database
// we will get the user stats for all the users
// compile them and send them over to the main server
// ---
const { Octokit } = require("octokit"); // npm install @octokit/rest
const fs = require('fs');
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

function sendToServer(data) {
    fs.writeFile('data.json', JSON.stringify(data), function (err) {
        if (err) return console.log(err);
    });
}

// get all the users from the people in the Organization IERoboticsClub
const users = [
        'velocitatem',
    ];

let metrics = [
    'followers',
    'following',
    'public_repos',
    'public_gists'
];


async function getCommitActivity(owner, repo) {
    try {
        const response = await octokit.rest.activity.listRepoEvents({
            owner: owner,
            repo: repo,
        });

        const commitEvents = response.data.filter(
            (event) => event.type === "PushEvent"
        );

        return commitEvents;
    } catch (error) {
        console.error("Error retrieving commit activity:", error);
        throw error;
    }
}

async function main() {
    let stats = [];
    await Promise.all(users.map(async (user) => {
        let stat = await octokit.rest.users.getByUsername({
            username: user
        });
        stats.push(stat);
    }));
    // compile the stats
    let compiledMetrics = stats.map((stat) => {
        return {
            user: stat.data.login,
            stats: metrics.map((metric) => {
                return {
                    metric: metric,
                    value: stat.data[metric]
                };
            })
        };
    });
    console.log(compiledMetrics);

    // contribution statistics
    // for each user get a list of all the repos they have contributed to in the last 24h

    let ReposWithContributions = [];
    /*

      let reposWithContributions = await octokit.rest.repos.listForUser({
      username: user,
      sort: 'updated'
      });
      the above for each user
      */
    await Promise.all(users.map(async (user) => {
        console.log(user)
        let reposWithContributions = await octokit.rest.repos.listForUser({
            username: user,
            sort: 'updated'
        })
        // only get the last 4 repos
        reposWithContributions = reposWithContributions.data.slice(0, 4)
        ReposWithContributions.push(reposWithContributions);
    }));

    let usersActivity = [];

    let creationThreshold = new Date();
    creationThreshold.setDate(creationThreshold.getDate() - 5);

    // last 4 repos with contributions
    await Promise.all(ReposWithContributions.map(async (repos) => {
        let userActivity = []
        await Promise.all(repos.map(async (repo) => {
            console.log(repo)
            let activity = await getCommitActivity(repo.owner.login, repo.name);
            // returns a list with all the pushes with property created_at: string_date
            activity = activity.filter((commit) => {
                let commitDate = new Date(commit.created_at);
                return commitDate > creationThreshold;
            });
            console.log(activity);
            // return the commits from the each push in the activity
            activity = activity.map((push) => {
                return push.payload.commits;
            });
            // flatten the array
            activity = activity.flat();
            // extend userActivity with the activity from this repo
            userActivity = userActivity.concat(activity);
        }));
        console.log(userActivity)
        usersActivity.push(userActivity)
    }));
    compiledMetrics = compiledMetrics.map((user, index) => {
        return {
            ...user,
            activity: usersActivity[index]
        }
    });
    // send the data to the server
    sendToServer(compiledMetrics);
}

main();

// github action script
// script to update the database
// we will get the user stats for all the users
// compile them and send them over to the main server
// ---
const { Octokit } = require("octokit"); // npm install @octokit/rest
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

function sendToServer(data) {
    console.log("SENDING", data);
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
        ReposWithContributions.push(reposWithContributions.slice(0, 4));
    }));

    let userActivity = [];
    // last 4 repos with contributions
    await Promise.all(ReposWithContributions.map(async (repo) => {
        let activity = await getCommitActivity(repo.data[0].owner.login, repo.data[0].name);
        console.log(activity);
        userActivity.push(activity);
    }));

}



main();

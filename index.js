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
                return {
                    ...push.payload.commits['0'],
                    repo: {
                        name: push.repo.name,
                        owner: repo.owner.login
                    }
                };
            });
            // flatten the array
            activity = activity.flat();
            // extend userActivity with the activity from this repo
            userActivity = userActivity.concat(activity);
        }));
        console.log(userActivity)
        usersActivity.push(userActivity)
    }));
    async function fetchActivities() {
        const usersActivityPromises = usersActivity.map(async (activities) => {
            const activityPromises = activities.map(async (activity) => {
                try {
                    const response = await octokit.rest.repos.getCommit({
                        owner: activity.repo.owner,
                        repo: activity.repo.name.split('/')[1],
                        ref: activity.sha
                    });

                    return {
                        total: response.data.stats.total,
                        ...activity
                    };
                } catch (error) {
                    console.log(error);
                }
            });

            return Promise.all(activityPromises);
        });

        const allUserActivities = await Promise.all(usersActivityPromises);
        return allUserActivities;
    }

    fetchActivities()
        .then((result) => {
            console.log("All user activities:", result);

            usersActivity = result;

            compiledMetrics = compiledMetrics.map((user, index) => {
                return {
                    ...user,
                    activity: usersActivity[index]
                }
            });

            // remove teh author property from the commits in teh activity array
            compiledMetrics = compiledMetrics.map((user) => {
                return {
                    ...user,
                    activity: user.activity.map((activity) => {
                        let newActivity = activity;
                        delete newActivity.author;
                        return newActivity;
                    })
                }
            });

            // send the data to the server
            sendToServer(compiledMetrics);
        })
        .catch((error) => {
            console.log("Error fetching activities:", error);
        });

}

main();

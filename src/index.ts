/* eslint-disable camelcase */
import {
  getInput,
  setFailed,
  setOutput,
  exportVariable,
  info,
} from "@actions/core";
import { getOctokit } from "@actions/github";
import debug from "debug";

const dbg = debug("action-dependabot-labels:index");

export async function run(): Promise<void> {
  dbg("Check whether user is memebr of teams");
  try {
    dbg("Retrieve inputs");
    const token = getInput("token", { required: true });
    const username = getInput("username", { required: true });
    const varName =
      getInput("varName", { required: false }) || "USER_IS_MEMBER";
    const teams = getInput("teams", { required: true })
      .split(",")
      .map((t) => {
        const [org, team] = t.trim().split("/");
        return { org, team };
      });
    dbg("Check user: %s in teams: %o", teams);

    dbg("Fetch teams by name and org");
    const byOrg = [] as { name: string; teams: string[] }[];
    teams.forEach((t) => {
      let org = byOrg.find((o) => o.name === t.org);
      if (!org) {
        org = { name: t.org, teams: [] };
        byOrg.push(org);
      }

      if (!org.teams.find((n) => n === t.team)) {
        org.teams.push(t.team);
      }
    });

    const oqs = byOrg.map(({ name, teams: orgTeams }) => {
      const orgKey = name.replace(/\W/g, "_");

      const tqs = orgTeams.map((t) => {
        const teamkey = t.replace(/\W/g, "_");
        return `${teamkey}: teams(first: 100, query: "${t}") { ...Teams }`;
      });

      return `${orgKey}: organization(login: "${name}") { ${tqs.join("\n")} }`;
    });

    const query = `fragment Teams on TeamConnection {
      nodes { name members { nodes { name: login } } }
    }
    query { ${oqs.join("\n")} }`;

    const client = getOctokit(token);
    const data = await client.graphql<
      Record<
        string,
        Record<
          string,
          {
            nodes: { name: string; members: { nodes: { name: string }[] } }[];
          }
        >
      >
    >(query);

    dbg("Process result data");
    const users = Object.values(data)
      .map((org) =>
        Object.values(org).map((orgTeams) =>
          orgTeams.nodes.map((t) =>
            t.members.nodes.map((user) => ({ team: t.name, user: user.name }))
          )
        )
      )
      .flat(4);

    dbg("Apply team filter to the users list");
    const filtered = users.filter(({ team }) =>
      teams.some((t) => team === t.team)
    );

    const res = filtered.find((u) => username === u.user);
    if (res) {
      dbg("User %s is member of given team: %s", res.user, res.team);
      info(`User ${res.user} is member of team ${res.team}`);
    } else {
      dbg("User %s is not member of any of given teams", username);
      info(`User ${username} is not member of any given team`);
    }

    setOutput("ismember", !!res);
    exportVariable(varName, !!res);
  } catch (e) {
    dbg("Failed:", e);
    setFailed(e.message);
  }
}

export default run();

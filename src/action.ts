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

const dbg = debug("action-is-user-member-of-teams:index");

export type GqlTeamMemberResult = {
  name: string;
};

export type GqlTeamResult = {
  name: string;
  members: { nodes: GqlTeamMemberResult[] };
};

export type GqlOrgResult = Record<string, { nodes: GqlTeamResult[] }>;

export type GqlResult = Record<string, GqlOrgResult>;

export async function run(): Promise<void> {
  dbg("Check whether user is memebr of teams");
  try {
    dbg("Retrieve inputs");
    const token = getInput("token", { required: true });
    const usernames = getInput("username", { required: true })
      .split(",")
      .map((u) => u.trim());
    const varName =
      getInput("varName", { required: false }) || "USER_IS_MEMBER";
    const teams = getInput("teams", { required: true })
      .split(",")
      .map((t) => {
        const [org, team] = t.trim().split("/");
        return { org, team };
      });
    dbg("Check users: %o in teams: %o", usernames, teams);

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

      return `${orgKey}: organization(login: "${name}") { name ${tqs.join(
        "\n"
      )} }`;
    });

    const query = `
    fragment Teams on TeamConnection {
      nodes { name members { nodes { name: login } } }
    }
    query { 
      ${oqs.join("\n")} 
    }`;

    const client = getOctokit(token);

    const data = await client.graphql<GqlResult>(query);

    dbg("Process result data: %o", data);
    const users = Object.values(data)
      .map((org) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { name, ...tdata } = org;
        return Object.values(tdata).map((orgTeams) =>
          orgTeams.nodes.map((t) =>
            t.members.nodes.map((user) => ({
              org: org.name,
              team: t.name,
              user: user.name,
            }))
          )
        );
      })
      .flat(4);

    dbg("Apply team filter to the users list");
    const filtered = users.filter(({ team }) =>
      teams.some((t) => team === t.team)
    );

    const res = filtered.find((u) => usernames.find((un) => un === u.user));
    if (res) {
      dbg("User %s is member of given team: %s", res.user, res.team);
      info(`Found User ${res.user} is member of team ${res.team}`);

      setOutput("orgName", res.org);
      setOutput("teamName", res.team);
      setOutput("userName", res.user);
    } else {
      dbg("Users %s not member of any of given teams", usernames.join(","));
      info(
        `Users ${usernames.join(",")} not member of ${teams
          .map((t) => `${t.org}/${t.team}`)
          .join(" or ")}`
      );

      setOutput("orgName", undefined);
      setOutput("teamName", undefined);
      setOutput("userName", undefined);
    }

    setOutput("ismember", !!res);
    exportVariable(varName, !!res);
  } catch (e) {
    dbg("Failed:", e);
    setFailed((e as Error).message);
  }
}

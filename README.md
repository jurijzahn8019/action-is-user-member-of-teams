# action-is-user-member-of-teams

Outputs boolean indicating whether user is a member of one or more github teams

This action will take the username and a list of team names in format `<org>/<team>`
And then perform an api Query to fetch the team metadata and evaluate whether the user
is a member of any of them.

Then it will set a boolean result as output

The Action is used in my org in some Project board automation workflows

## Inputs

### `token`

**Required** Github Api Token `"World"`.

### `username`

**Required** Username of the github user to check: `anyuser3445`.

### `teams`

**Required** Comma-sparated list of teams to check membership: `org/team1,org/team2`.

### `varName`

If given, then action will export the result as this env Var `USER_IS_MEMBER`.

## Outputs

### `ismember`

true if user is member of one or more teams

## Example usage

```yaml
name: User was Assigned to Issue
on:
  issues: [assigned]

jobs:
  do-something:
    steps:
      - uses: jurijzahn8019/action-is-user-member-of-teams@v0.0.1
        id: checker
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          username: ${{ github.event.assignee.login }}
          teams: my-org/team1, myorg2/team-b
          varName: USER_IS_MEMBER

      - name: Do Something if user is one of my teams
        if: ${{ steps.checker.outputs.ismember }}
        run: |
          do something with the issue
```

## Test run

```bash
DEBUG=* \
  INPUT_TOKEN=FOOOOO \
  INPUT_USERNAME=foobar \
  INPUT_TEAMS=foo/bar \
  node dist/index.cjs.js
```

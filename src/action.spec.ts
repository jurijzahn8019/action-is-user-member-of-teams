/* eslint-disable @typescript-eslint/no-explicit-any */
import { getInput, info, setFailed, setOutput } from "@actions/core";
import { getOctokit } from "@actions/github";
import { GqlOrgResult, GqlResult, run } from "./action";

jest.mock("@actions/core");
jest.mock("@actions/github");

const getInputMock = getInput as jest.MockedFunction<typeof getInput>;
const setFailedMock = setFailed as jest.MockedFunction<typeof setFailed>;
const getOctokitMock = getOctokit as jest.MockedFunction<typeof getOctokit>;
const infoMock = info as jest.MockedFunction<typeof info>;
const setOutputMock = setOutput as jest.MockedFunction<typeof setOutput>;

const octokit = {
  graphql: jest.fn() as jest.Mock<Promise<GqlResult>, any>,
};

describe("action", () => {
  beforeEach(() => {
    getOctokitMock.mockReturnValue(octokit as any);
    getInputMock.mockReturnValueOnce("THE TOKEN");
    getInputMock.mockReturnValueOnce("user1,user2");
    getInputMock.mockReturnValueOnce("");
    getInputMock.mockReturnValueOnce("foo/bar,foo/baz,baz/bar,baz/bar");
    octokit.graphql.mockResolvedValue({
      non: { bar: { nodes: [] } },
      foo: {
        bar: {
          nodes: [
            {
              name: "bar",
              members: { nodes: [{ name: "user4" }, { name: "user1" }] },
            },
          ],
        },
      },
    });
  });

  it("Happy Path", async () => {
    await expect(run()).resolves.toBeUndefined();

    expect(getInputMock).toHaveBeenCalledTimes(4);
    expect(getInputMock.mock.calls.map((c) => c[0])).toEqual([
      "token",
      "username",
      "varName",
      "teams",
    ]);

    expect(getOctokitMock).toHaveBeenCalledTimes(1);
    expect(getOctokitMock).toHaveBeenCalledWith("THE TOKEN");

    expect(octokit.graphql.mock.calls[0][0]).toMatchSnapshot("Query");

    expect(setOutputMock).toHaveBeenCalledTimes(4);
    expect(setOutputMock.mock.calls.map((c) => c.join(": "))).toMatchSnapshot(
      "Output"
    );

    expect(infoMock).toHaveBeenCalledTimes(1);
    expect(infoMock).toHaveBeenCalledWith(
      "Found User user1 is member of team bar"
    );

    expect(setFailedMock).not.toHaveBeenCalled();
  });

  it("Should fail on error", async () => {
    octokit.graphql.mockRejectedValue(new Error("The FOO"));

    await expect(run()).resolves.toBeUndefined();

    expect(getInputMock).toHaveBeenCalledTimes(4);
    expect(getInputMock.mock.calls.map((c) => c[0])).toEqual([
      "token",
      "username",
      "varName",
      "teams",
    ]);

    expect(getOctokitMock).toHaveBeenCalledTimes(1);
    expect(getOctokitMock).toHaveBeenCalledWith("THE TOKEN");

    expect(octokit.graphql).toHaveBeenCalledTimes(1);

    expect(setOutputMock).not.toHaveBeenCalled();
    expect(infoMock).not.toHaveBeenCalled();

    expect(setFailedMock).toHaveBeenCalledTimes(1);
    expect(setFailedMock).toHaveBeenCalledWith("The FOO");
  });

  it("Should report negative", async () => {
    octokit.graphql.mockResolvedValue({
      non: { bar: { nodes: [] } },
      foo: {
        bar: {
          nodes: [
            {
              name: "non",
              members: { nodes: [{ name: "user666" }] },
            },
          ],
        },
      },
    });

    await expect(run()).resolves.toBeUndefined();

    expect(getInputMock).toHaveBeenCalledTimes(4);
    expect(getInputMock.mock.calls.map((c) => c[0])).toEqual([
      "token",
      "username",
      "varName",
      "teams",
    ]);

    expect(getOctokitMock).toHaveBeenCalledTimes(1);
    expect(getOctokitMock).toHaveBeenCalledWith("THE TOKEN");

    expect(octokit.graphql.mock.calls[0][0]).toMatchSnapshot("Query");

    expect(setOutputMock).toHaveBeenCalledTimes(4);
    expect(setOutputMock.mock.calls.map((c) => c.join(": "))).toMatchSnapshot(
      "Output"
    );

    expect(infoMock).toHaveBeenCalledTimes(1);
    expect(infoMock).toHaveBeenCalledWith(
      "Users user1,user2 not member of foo/bar or foo/baz or baz/bar or baz/bar"
    );

    expect(setFailedMock).not.toHaveBeenCalled();
  });
});

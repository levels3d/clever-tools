'use strict';

const fs = require('fs');

const _ = require('lodash');
const Bacon = require('baconjs');
const git = require('isomorphic-git');
const { autocomplete } = require('cliparse');

const slugify = require('slugify');
const { findPath } = require('./fs-utils.js');
const { loadOAuthConf } = require('./configuration.js');

async function getRepo () {
  const dir = await findPath('.', '.git');
  return { fs, dir };
}

async function addRemote (remoteName, url) {
  const repo = await getRepo();
  const safeRemoteName = slugify(remoteName);
  const allRemotes = await git.listRemotes({ ...repo });
  const existingRemote = _.find(allRemotes, { remote: safeRemoteName });
  if (existingRemote == null) {
    return git.addRemote({ ...repo, remote: safeRemoteName, url });
  }
}

function resolveFullCommitId (commitId) {
  if (commitId == null) {
    return Bacon.constant(null);
  }
  const fullCommitIdPromise = getRepo()
    .then((repo) => git.expandOid({ ...repo, oid: commitId }));
  return Bacon.fromPromise(fullCommitIdPromise)
    .flatMapError((e) => {
      if (e.code === 'ShortOidNotFound') {
        return new Bacon.Error(`Commit id ${commitId} is ambiguous`);
      }
      return e;
    });
}

async function getRemoteCommit (remoteUrl) {
  const repo = await getRepo();
  const tokens = await loadOAuthConf().toPromise();
  const remoteInfos = await git.getRemoteInfo({
    ...repo,
    username: tokens.token,
    password: tokens.secret,
    url: remoteUrl,
  });
  return _.get(remoteInfos, 'refs.heads.master');
}

async function getFullBranch (branchName) {
  const repo = await getRepo();
  if (branchName === '') {
    return git.currentBranch({ ...repo, fullname: true });
  }
  return git.expandRef({ ...repo, ref: branchName });
};

async function getBranchCommit (refspec) {
  const repo = await getRepo();
  return git.resolveRef({ ...repo, ref: refspec });
}

async function push (remoteUrl, branchRefspec, force) {
  const repo = await getRepo();
  const tokens = await loadOAuthConf().toPromise();
  try {
    const push = await git.push({
      ...repo,
      username: tokens.token,
      password: tokens.secret,
      url: remoteUrl,
      ref: branchRefspec,
      remoteRef: 'master',
      force,
    });
    if (push.errors != null) {
      throw new Error(push.errors.join(', '));
    }
    return push;
  }
  catch (e) {
    if (e.code === 'PushRejectedNonFastForward') {
      throw new Error('Push rejected because it was not a simple fast-forward. Use "--force" to override.');
    }
    throw e;
  }
}

function completeBranches () {
  return getRepo()
    .then((repo) => git.listBranches(repo))
    .then(autocomplete.words);
}

module.exports = {
  addRemote,
  resolveFullCommitId,
  getRemoteCommit,
  getFullBranch,
  getBranchCommit,
  push,
  completeBranches,
};

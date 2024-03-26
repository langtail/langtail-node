## Setting up the environment

This repository uses [`pnpm`](https://pnpm.io/).

To set up the repository, run:

```bash
pnpm
pnpm build
```

This will install all the required dependencies and build output files to `dist/`.

## Using the repository from source

If you’d like to use the repository from source, you can either install from git or link to a cloned repository:

To install via git:

```bash
npm install git+ssh://git@github.com:langtail/langtail-node.git
```

Alternatively, to link a local copy of the repo:

```bash
# Clone
git clone https://www.github.com/langtail/langtail-node
cd langtail-node

# With pnpm
pnpm link
cd ../my-package
pnpm link langtail

# With pnpm
pnpm link --global
cd ../my-package
pnpm link -—global langtail
```

## Running tests

```bash
pnpm run test
```

## Linting and formatting

This repository uses [prettier](https://www.npmjs.com/package/prettier) and
[eslint](https://www.npmjs.com/package/eslint) to format the code in the repository.

To check types run:

```bash
pnpm ts
```

To format all the code run:

```bash
pnpm format
```

## Publishing and releases

Releases are done manually for now.

### Publish with a GitHub workflow

You can release to package managers by using [the `Publish NPM` GitHub action](https://www.github.com/langtail/langtail-node/actions/workflows/publish-npm.yml). This requires a setup organization or repository secret to be set up.

### Publish manually

If you need to manually release a package, you can run the `bin/publish-npm` script with an `NPM_TOKEN` set on
the environment.

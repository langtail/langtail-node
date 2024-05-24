## Setting up the environment

This repository uses [`pnpm`](https://pnpm.io/).

To set up the repository, run:

```bash
pnpm install
pnpm build
```

This will install all the required dependencies and build output files to `dist/`.

## Using the repository from source

You can link a local copy of the repo:

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

When you push a new tag (`vX.Y.Z`), Github Action will automatically publish this version.

Also create a release from the tag in Github so the Changes are easily visible in https://github.com/langtail/langtail-node/releases

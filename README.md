# Deploy Notes Action

A GitHub Action that automatically generates human-readable deploy notes for pull requests. The action uses DeepSeek AI to create clear, actionable test steps and launch requirements.

## Features

- Generates clear, human-readable deploy notes
- Focuses on concrete, executable test steps
- Automatically commits notes to your PR
- Adds deploy notes as PR comments
- Saves deploy notes to a consistent location in your repository

## Setup Instructions for All Repositories

### 1. Add the workflow file

For each repository where you want to use this action, create a file at:
`.github/workflows/generate-deploy-notes.yml`

With the following content:

```yaml
name: Generate Deploy Notes

on:
  pull_request:
    types: [opened, synchronize, reopened, labeled]
    branches:
      - main

permissions:
  contents: write
  pull-requests: write

jobs:
  generate-deploy-notes:
    runs-on: ubuntu-latest
    # Only run if the PR has the 'needs-deploy-note' label or is being merged into main
    if: ${{ github.event.pull_request.base.ref == 'main' && (contains(github.event.pull_request.labels.*.name, 'needs-deploy-note') || github.event.action == 'opened') }}
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Generate Deploy Note
        uses: blaze-xyz/deploy-notes-action@v1.0.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deepseek-api-key: ${{ secrets.DEEPSEEK_API_KEY }}
          pr-number: ${{ github.event.pull_request.number }}
          repository: ${{ github.repository }}
```

### 2. Add the DeepSeek API Key

Add your DeepSeek API key to GitHub repository secrets as `DEEPSEEK_API_KEY`.

You can do this by:
1. Go to your repository on GitHub
2. Click on "Settings" → "Secrets and variables" → "Actions"
3. Click "New repository secret"
4. Name: `DEEPSEEK_API_KEY`
5. Value: Your DeepSeek API key

### 3. Create Directory for Deploy Notes (Optional)

For consistency, you may want to create a directory in each repository where deploy notes will be stored:

```
mkdir -p dev-utils/deployNotes
```

And add a placeholder README to it:

```
# Deploy Notes

This directory contains automated deploy notes for pull requests.
```

## Triggering Deploy Notes Generation

The action will run automatically in these cases:
- When a PR is opened against the main branch
- When a PR is updated (new commits pushed)
- When a PR is labeled with 'needs-deploy-note'

## Inputs

| Input | Description | Required |
|-------|-------------|----------|
| `github-token` | GitHub token for API access | Yes |
| `deepseek-api-key` | DeepSeek API key | Yes |
| `pr-number` | Pull request number | Yes |
| `repository` | Repository name with owner | Yes |

## Output Format

The action generates deploy notes in the following format:

```markdown
### [PR Title](PR URL)

**Test Script**

1. Simple, concrete action
2. Expected result in plain language

**Launch Requirements**

- Concrete setup steps
- No subjective requirements
```

## Development

To modify this action:

1. Clone this repository
2. Make your changes
3. Create a new version tag:
   ```bash
   git tag -a v1.x.x -m "Description of changes"
   git push origin v1.x.x
   ```
4. Update all workflows to use the new version

## License

MIT


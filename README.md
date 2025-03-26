# Deploy Notes Action

A GitHub Action that automatically generates human-readable deploy notes for pull requests. The action uses DeepSeek AI to create clear, actionable test steps and launch requirements.

## Features

- Generates clear, human-readable deploy notes
- Focuses on concrete, executable test steps
- Automatically commits notes to your PR
- Adds deploy notes as PR comments
- Saves deploy notes to a consistent location in your repository

## Usage

1. Create a workflow file in your repository (e.g., `.github/workflows/deploy-notes.yml`):

```yaml
name: Generate Deploy Notes

on:
  pull_request:
    types: [opened, synchronize, reopened, labeled]
    branches:
      - main

jobs:
  generate-deploy-notes:
    runs-on: ubuntu-latest
    if: ${{ github.event.pull_request.base.ref == 'main' && (contains(github.event.pull_request.labels.*.name, 'needs-deploy-note') || github.event.action == 'opened') }}
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3
        
      - name: Generate Deploy Note
        uses: your-org/deploy-notes-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deepseek-api-key: ${{ secrets.DEEPSEEK_API_KEY }}
          pr-number: ${{ github.event.pull_request.number }}
          repository: ${{ github.repository }}
```

2. Add your DeepSeek API key to your repository secrets as `DEEPSEEK_API_KEY`

3. The action will now:
   - Run on new PRs
   - Run when PRs are updated
   - Run when PRs are labeled with 'needs-deploy-note'

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

1. Clone this repository
2. Install dependencies: `cd action && npm install`
3. Make your changes
4. Test locally by setting up environment variables:
   ```bash
   export GITHUB_TOKEN=your_token
   export DEEPSEEK_API_KEY=your_key
   export PR_NUMBER=123
   export REPO_OWNER=your-org
   export REPO_NAME=your-repo
   ```

## License

MIT


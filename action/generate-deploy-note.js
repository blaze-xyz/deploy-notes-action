const axios = require("axios");
const { Octokit } = require("@octokit/rest");
const fs = require("fs");
const path = require("path");

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// PR details from environment variables
const prNumber = process.env.PR_NUMBER;
const [repoOwner, repoName] = process.env.REPOSITORY.split("/");

async function main() {
  try {
    console.log(`Generating deploy note for PR #${prNumber}`);

    // Fetch PR details
    const { data: pr } = await octokit.pulls.get({
      owner: repoOwner,
      repo: repoName,
      pull_number: prNumber,
    });

    // Fetch PR files
    const { data: files } = await octokit.pulls.listFiles({
      owner: repoOwner,
      repo: repoName,
      pull_number: prNumber,
    });

    // Fetch PR commits
    const { data: commits } = await octokit.pulls.listCommits({
      owner: repoOwner,
      repo: repoName,
      pull_number: prNumber,
    });

    // Extract commit messages
    const commitMessages = commits.map((commit) => commit.commit.message);

    // Get list of changed files
    const changedFiles = files.map((file) => file.filename);

    // Prepare context for DeepSeek API
    const context = {
      pr_title: pr.title,
      pr_body: pr.body || "",
      pr_number: prNumber,
      pr_url: pr.html_url,
      commit_messages: commitMessages,
      changed_files: changedFiles,
      branch_name: pr.head.ref,
      head_sha: pr.head.sha,
    };

    // Call DeepSeek API to generate deploy note
    const deployNote = await generateDeployNoteWithDeepSeek(context);

    // Save and commit the deploy note to the PR branch
    await saveAndCommitDeployNote(prNumber, deployNote, context);

    // Comment on the PR
    await commentOnPR(prNumber, deployNote);

    console.log("Deploy note generated successfully!");
  } catch (error) {
    console.error("Error generating deploy note:", error);
    process.exit(1);
  }
}

async function generateDeployNoteWithDeepSeek(context) {
  try {
    const prompt = `
    You are an expert developer tasked with creating a deploy note for a pull request.
    Your goal is to create simple, concrete test steps that can be executed without interpretation.
    
    IMPORTANT GUIDELINES:
    1. Write test steps that are mechanically executable - no thinking or interpretation should be needed
    2. Use simple, human language - avoid technical jargon unless absolutely necessary
    3. Each test step should be concrete and verifiable (e.g. "Click the submit button" not "Ensure the form validates")
    4. Remove any steps that require subjective interpretation
    5. Don't include steps that can't be clearly tested
    6. Focus on what a real human would actually test, not theoretical validations
    
    Here's the information about the PR:
    - Title: ${context.pr_title}
    - PR Number: ${context.pr_number}
    - PR URL: ${context.pr_url}
    - Branch: ${context.branch_name}
    
    Commit messages:
    ${context.commit_messages.join("\n")}
    
    Changed files:
    ${context.changed_files.join("\n")}
    
    PR description:
    ${context.pr_body || "No description provided"}
    
    Based on this information, generate a deploy note in the following format:
    
    ### [PR Title](PR URL)
    
    **Test Script**
    
    1. [Simple, concrete action]
    2. [Expected result in plain language]
    
    **Launch Requirements**
    
    - List only concrete, necessary setup steps
    - If no special requirements, just say "No special requirements"
    
    EXAMPLES:
    Good test steps:
    - "Click the 'Submit' button"
    - "Check that the success message appears"
    - "Enter 'test@example.com' in the email field"
    
    Bad test steps (avoid these):
    - "Verify system validation"
    - "Check that the localization works"
    - "Ensure proper data handling"
    `;

    // Check if we have an API key
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY is required");
    }

    const response = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model: "deepseek-reasoner",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that generates deploy notes for pull requests.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error(
      "Error calling DeepSeek API:",
      error.response?.data || error.message
    );
    throw new Error("Failed to generate deploy note with DeepSeek API");
  }
}

async function saveAndCommitDeployNote(prNumber, content, context) {
  try {
    // Path to the deploy note file
    const filePath = `dev-utils/deployNotes/${prNumber}.md`;

    console.log(`Checking for existing deploy note: ${filePath}`);

    // Get the current file content if it exists (to check if we need to update)
    let currentContent = "";
    let sha = null;
    try {
      const { data } = await octokit.repos.getContent({
        owner: repoOwner,
        repo: repoName,
        path: filePath,
        ref: context.branch_name,
      });

      if (data.content) {
        currentContent = Buffer.from(data.content, "base64").toString();
        sha = data.sha;
        console.log("Found existing deploy note");
      }
    } catch (error) {
      if (error.status === 404) {
        console.log("No existing deploy note found, will create new one");
      } else {
        console.error("Error checking for existing deploy note:", error);
        throw error;
      }
    }

    // If content is the same, no need to commit
    if (currentContent === content) {
      console.log("Deploy note content unchanged, exiting successfully");
      return;
    }

    // Create or update the file in the repository
    const commitMessage = `Add deploy note for PR #${prNumber}`;

    const params = {
      owner: repoOwner,
      repo: repoName,
      path: filePath,
      message: commitMessage,
      content: Buffer.from(content).toString("base64"),
      branch: context.branch_name,
      committer: {
        name: "GitHub Actions",
        email: "actions@github.com",
      },
      author: {
        name: "GitHub Actions",
        email: "actions@github.com",
      },
    };

    // Only include sha if the file exists
    if (sha) {
      params.sha = sha;
    }

    await octokit.repos.createOrUpdateFileContents(params);
    console.log(`Deploy note committed to branch: ${context.branch_name}`);

    // Also comment on the PR
    await commentOnPR(prNumber, content);
    console.log("Added deploy note as PR comment");
  } catch (error) {
    console.error("Error handling deploy note:", error);
    throw error;
  }
}

async function commentOnPR(prNumber, deployNote) {
  const comment = `
## Deploy Note Generated

A deploy note has been automatically generated for this PR:

\`\`\`markdown
${deployNote}
\`\`\`

This note has been saved to \`dev-utils/deployNotes/${prNumber}.md\` and committed to this PR branch.
`;

  await octokit.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    issue_number: prNumber,
    body: comment,
  });

  console.log("Comment added to PR");
}

// Run the main function
main();

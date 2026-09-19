const GITHUB_ISSUE_BODY_LIMIT = 7000;

const clip = (value, max) => {
  if (!value) {
    return "";
  }
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}\n…(truncated)`;
};

export default ({
  sentryErrorId = "",
  errorMessage = "",
  stack = "",
  componentStack = "",
  url = "",
  userAgent = "",
  gitSha = "",
}) => {
  const body = `### What happened

A runtime error crashed the app.

### Error

\`\`\`
${clip(errorMessage, 500)}
\`\`\`

### Stack

\`\`\`
${clip(stack, 2500)}
\`\`\`

### Component stack

\`\`\`
${clip(componentStack, 1500)}
\`\`\`

### Context

- URL: ${url}
- User agent: ${userAgent}
- Git SHA: ${gitSha || "unknown"}
- Sentry event: ${sentryErrorId || "none"}
`;

  return clip(body.trim(), GITHUB_ISSUE_BODY_LIMIT);
};

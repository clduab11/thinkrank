# Contributing to ThinkRank

Thank you for your interest in contributing to ThinkRank! We welcome contributions from the community to help improve our AI content detection gaming platform.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. We are committed to providing a welcoming and inclusive environment for all contributors.

## Getting Started

1. **Fork the repository** to your GitHub account
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/thinkrank.git
   cd thinkrank
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/thinkrank/thinkrank.git
   ```
4. **Create a new branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Process

### 1. Setting Up Your Environment

Follow the setup instructions in our README.md to get your development environment ready. Ensure you have:
- Node.js 20+
- Docker and Docker Compose
- PostgreSQL 15+
- Redis 7+

### 2. Making Changes

- Write clean, readable code following our style guides
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass before submitting

### 3. Code Style

We use automated tools to maintain code quality:

```bash
# Run linting
npm run lint

# Run type checking
npm run typecheck

# Format code
npm run format
```

### 4. Testing

All contributions must include appropriate tests:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific service tests
npm run test:frontend
npm run test:auth
npm run test:game
```

Aim for at least 80% test coverage on new code.

### 5. Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, missing semicolons, etc.)
- `refactor:` Code refactoring without changing functionality
- `perf:` Performance improvements
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Example:
```bash
git commit -m "feat: add confidence slider to challenge card"
```

### 6. Pull Request Process

1. **Update your branch** with the latest upstream changes:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Push your changes** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request** on GitHub with:
   - A clear title and description
   - Reference to any related issues
   - Screenshots or demos if applicable
   - Information about breaking changes

4. **Address review feedback** promptly and professionally

## What to Work On

### Good First Issues

Look for issues labeled `good first issue` for beginner-friendly tasks.

### Priority Areas

- **Frontend Components**: React components with TypeScript and tests
- **API Endpoints**: New features for our microservices
- **AI Detection**: Improvements to detection algorithms
- **Documentation**: API docs, tutorials, and guides
- **Performance**: Optimizations for better user experience
- **Testing**: Increasing test coverage and quality

### Feature Requests

Before implementing a new feature:
1. Check existing issues and discussions
2. Open an issue to discuss your proposal
3. Wait for maintainer feedback before starting work

## Testing Guidelines

### Unit Tests

- Test individual functions and components in isolation
- Use mocking for external dependencies
- Aim for comprehensive edge case coverage

### Integration Tests

- Test interactions between services
- Verify API contracts
- Test database operations

### E2E Tests

- Test complete user workflows
- Verify critical paths work correctly
- Run in CI/CD pipeline

## Documentation

Update documentation when you:
- Add new features
- Change API endpoints
- Modify configuration options
- Update dependencies

Documentation locations:
- API docs: `/docs/api`
- User guides: `/docs/guides`
- Code comments: In-line with code

## Review Process

Pull requests require:
- Passing all automated tests
- Code review from at least one maintainer
- No merge conflicts
- Updated documentation

Reviews focus on:
- Code quality and maintainability
- Test coverage and quality
- Performance implications
- Security considerations
- User experience impact

## Security

If you discover a security vulnerability:
1. **Do NOT** open a public issue
2. Email security@thinkrank.io with details
3. Allow time for us to address the issue before disclosure

## Recognition

Contributors are recognized in:
- Our README.md contributors section
- Release notes for significant contributions
- Our website's contributors page

## Questions?

- Check our [documentation](https://docs.thinkrank.io)
- Join our [Discord community](https://discord.gg/thinkrank)
- Open a [GitHub Discussion](https://github.com/thinkrank/thinkrank/discussions)

Thank you for contributing to ThinkRank! Together, we're building a platform that helps people understand and identify AI-generated content.
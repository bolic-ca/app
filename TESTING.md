# Testing

Run the component and integration suite:

```sh
npm test
```

Run the enforced coverage checks:

```sh
npm run test:coverage
```

Tests use React Native Testing Library with real application providers and
in-memory AsyncStorage. Router calls and device-only Expo APIs are mocked at
their platform boundaries.

## iPhone release smoke check

Automated component tests do not perform native iOS hit-testing. Before a
release, keep the remaining manual check short:

1. Create a program, add an exercise, and make it active.
2. Start a workout, add and edit a set, then complete it.
3. Confirm the completed workout appears in history and stats.
4. Verify scrolling, keyboard avoidance, modal gestures, and icon-only touch
   targets on one supported iPhone.
5. Exercise import/export once when those native dependencies change.

Native Live Activities and drag-to-reorder behavior also require an iPhone or
macOS-hosted iOS automation.

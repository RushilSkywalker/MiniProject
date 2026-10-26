# Verification record

E-commerce demo update verified locally on 26 October 2026. Initial installation and browser checks were performed on 25 October 2026.

- `npm ci`: passed using the committed lockfile.
- `npm test`: 52 tests passed in four suites (Vitest 4.1.12).
- `npm run typecheck`: passed, also run as part of the build.
- `npm run build`: passed, frontend Vite 7.3.7 and TypeScript backend output.
- `npm audit`: zero known vulnerabilities reported at verification time.
- The updated HTTP demo tests verify exact product matches, price/rating sorting, verified review results, stock exclusion, row caps, and removal of the old college examples.
- Initial-version development and compiled-app browser checks verified submission, clarification, results, parameter expansion and copy. The catalog update was checked through the HTTP tests and production build; browser inspection was not repeated.
- UI inspected in the in-app browser's narrow 467px viewport. Mobile layout and output were visually checked; desktop responsiveness was checked in source, not through a separate desktop screenshot. A separate interface review found no material issue in that limited scope; copy status announcement and mobile textarea sizing were improved.

Mock boundaries: OpenAI and Neo4j behavior in the integration tests is mocked. No real OpenAI request, live database query, or seed operation was performed. External connectivity, model access, database permissions, real-schema compatibility, live timeout behavior, and live answer correctness still need verification once credentials and schema are supplied.

Demo results are computed from fictional fixtures. No accuracy percentages, performance benchmarks, or successful live-integration claims are made. Displayed elapsed time measures a request, not a benchmark.

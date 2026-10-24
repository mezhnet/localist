// Wird vor jeder Testdatei geladen (siehe test.setupFiles in vite.config.ts).
// Testing Library räumt nach jedem Test das gerenderte DOM wieder auf, damit
// sich Tests nicht gegenseitig beeinflussen.
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);

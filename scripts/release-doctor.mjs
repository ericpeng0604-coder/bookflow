#!/usr/bin/env node

import {
  inspectReleaseEnvironment,
  printReleaseEnvironment,
} from "./lib/release-environment.mjs";

printReleaseEnvironment(inspectReleaseEnvironment());

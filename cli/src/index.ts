#!/usr/bin/env node
import { program } from "commander";
import prompts from "prompts";
import pc from "picocolors";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ComponentFile = {
  name: string;
  url: string;
};

type Component = {
  name: string;
  description: string;
  files: ComponentFile[];
  dependencies: string[];
  devDependencies?: string[];
};

type Registry = {
  components: Component[];
};

const DEFAULT_REGISTRY_URLS = [
  "https://raw.githubusercontent.com/abhraneeldhar7/whitepapper/master/registry/registry.json",
];

function getRegistryCandidates(): string[] {
  const envUrl = process.env.WHITEPAPPER_REGISTRY_URL?.trim();
  if (envUrl) {
    return [envUrl, ...DEFAULT_REGISTRY_URLS.filter((url) => url !== envUrl)];
  }

  return DEFAULT_REGISTRY_URLS;
}

async function loadLocalRegistryFallback(): Promise<Registry | null> {
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFilePath);

  // Works for both ts source (cli/src) and published dist (cli/dist).
  const candidates = [
    path.resolve(currentDir, "../../registry/registry.json"),
    path.resolve(currentDir, "../../../registry/registry.json"),
    path.resolve(process.cwd(), "registry/registry.json"),
  ];

  for (const filePath of candidates) {
    try {
      const text = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(text) as Registry;
      if (Array.isArray(parsed.components)) {
        console.log(pc.yellow(`Using local registry fallback: ${filePath}`));
        return parsed;
      }
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

async function fetchRegistry(): Promise<Registry> {
  const errors: string[] = [];

  for (const url of getRegistryCandidates()) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        errors.push(`${url} -> HTTP ${response.status}`);
        continue;
      }

      const parsed = (await response.json()) as Registry;
      if (!Array.isArray(parsed.components)) {
        errors.push(`${url} -> Invalid registry payload`);
        continue;
      }

      return parsed;
    } catch (error) {
      errors.push(`${url} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const local = await loadLocalRegistryFallback();
  if (local) {
    return local;
  }

  throw new Error(
    `Could not reach registry. Tried:\n${errors.map((line) => `  - ${line}`).join("\n")}`,
  );
}

function sanitizeRelativePath(fileName: string): string {
  const normalized = fileName.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter((segment) => segment && segment !== "." && segment !== "..");
  return segments.join(path.sep);
}

async function writeComponentFiles(component: Component, outdir: string): Promise<void> {
  await fs.mkdir(outdir, { recursive: true });

  for (const file of component.files) {
    const response = await fetch(file.url);
    if (!response.ok) {
      console.log(pc.red(`x Failed to fetch ${file.name}`));
      continue;
    }

    const content = await response.text();
    const safeRelative = sanitizeRelativePath(file.name);
    const destination = path.join(outdir, safeRelative);

    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, content, "utf8");
    console.log(pc.green(`+ ${destination}`));
  }
}

function printInstallHint(component: Component): void {
  const deps = Array.from(new Set(component.dependencies ?? []));
  const devDeps = Array.from(new Set(component.devDependencies ?? []));

  if (deps.length) {
    console.log(pc.cyan(`\nInstall deps:`));
    console.log(`  npm install ${deps.join(" ")}`);
  }

  if (devDeps.length) {
    console.log(pc.cyan(`Install dev deps:`));
    console.log(`  npm install -D ${devDeps.join(" ")}`);
  }
}

program.name("whitepapper").description("Add reusable Whitepapper components to your project").version("0.1.0");

program
  .command("list")
  .description("List all components in the Whitepapper registry")
  .action(async () => {
    const registry = await fetchRegistry();

    if (!registry.components.length) {
      console.log(pc.yellow("No components are currently published."));
      return;
    }

    for (const component of registry.components) {
      const title = component.name.padEnd(20, " ");
      console.log(`${pc.bold(title)} ${pc.dim(component.description)}`);
    }
  });

program
  .command("add [components...]")
  .description("Add one or more components from the registry")
  .option("-o, --outdir <dir>", "directory to write files into", "src/components/ui")
  .action(async (componentNames: string[] = [], options: { outdir: string }) => {
    const registry = await fetchRegistry();
    let toInstall = componentNames;

    if (!toInstall.length) {
      const answer = await prompts({
        type: "multiselect",
        name: "picked",
        message: "Which components do you want to add?",
        choices: registry.components.map((component) => ({
          title: component.name,
          description: component.description,
          value: component.name,
        })),
      });

      toInstall = (answer.picked ?? []) as string[];
    }

    if (!toInstall.length) {
      console.log(pc.yellow("No components selected."));
      return;
    }

    for (const requestedName of toInstall) {
      const component = registry.components.find((entry) => entry.name === requestedName);

      if (!component) {
        console.log(pc.red(`x Unknown component: ${requestedName}`));
        continue;
      }

      console.log(pc.blue(`\nInstalling ${component.name}...`));
      await writeComponentFiles(component, options.outdir);
      printInstallHint(component);
    }

    console.log(pc.green("\nDone."));
  });

program.parseAsync().catch((error) => {
  console.error(pc.red(`\n${error instanceof Error ? error.message : String(error)}`));
  process.exitCode = 1;
});

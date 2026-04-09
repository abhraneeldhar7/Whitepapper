#!/usr/bin/env node
import { program } from "commander";
import prompts from "prompts";
import pc from "picocolors";
import fs from "node:fs/promises";
import path from "node:path";

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

const REGISTRY_URL =
  "https://raw.githubusercontent.com/abhraneeldhar7/Whitepapper/main/registry/registry.json";

async function fetchRegistry(): Promise<Registry> {
  const response = await fetch(REGISTRY_URL);
  if (!response.ok) {
    throw new Error(`Could not reach registry at ${REGISTRY_URL}`);
  }

  return (await response.json()) as Registry;
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
  .option("-o, --outdir <dir>", "directory to write files into", "src/components")
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
  process.exit(1);
});

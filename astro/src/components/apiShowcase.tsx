"use client";

import { useState } from "react";
import { Check, Copy, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, copyToClipboardWithToast } from "@/lib/utils";
import { getDevCollection, getDevPaper, getDevProject } from "@/lib/api/dev";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

const DEV_API_BASE_URL = `${String(import.meta.env.PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "")}/dev`;

type IdentifierType = "id" | "slug";
type Language = "typescript" | "python";

type EndpointVariable = {
    name: string;
    label: string;
    type: string;
    required: boolean;
    placeholder: string;
};

type EndpointConfig = {
    id: "project" | "collection" | "paper";
    name: string;
    method: "GET";
    path: string;
    description: string;
    hasIdentifierOptions: boolean;
    identifierOptions: Array<{ value: IdentifierType; label: string }>;
    variables: EndpointVariable[];
    sampleVariables: Record<string, string>;
    code: Record<Language, string>;
};

function getEndpointVariables(endpoint: EndpointConfig, identifierType: IdentifierType): EndpointVariable[] {
    return endpoint.variables.map((variable) => {
        if (variable.name !== "identifier") {
            return variable;
        }

        if (endpoint.id === "collection") {
            return identifierType === "slug"
                ? { ...variable, label: "Collection Slug", placeholder: "getting-started" }
                : { ...variable, label: "Collection ID", placeholder: "collection-id" };
        }

        if (endpoint.id === "paper") {
            return identifierType === "slug"
                ? { ...variable, label: "Paper Slug", placeholder: "introducing-whitepapper" }
                : { ...variable, label: "Paper ID", placeholder: "paper-id" };
        }

        return variable;
    });
}

function getInitialVariables(endpoint: EndpointConfig): Record<string, string> {
    return endpoint.variables.reduce<Record<string, string>>((accumulator, variable) => {
        accumulator[variable.name] = endpoint.sampleVariables[variable.name] ?? "";
        return accumulator;
    }, {});
}

const ENDPOINTS: EndpointConfig[] = [
    {
        id: "project",
        name: "Project details",
        method: "GET",
        path: "/project",
        description: "Get project details, public collections, and published standalone papers",
        variables: [
            { name: "apiKey", label: "API Key", type: "text", required: true, placeholder: "your-api-key" },
        ],
        sampleVariables: {
            apiKey: "wp_live_your_project_key",
        },
        hasIdentifierOptions: false,
        identifierOptions: [],
        code: {
            typescript: `const response = await fetch("__DEV_API_BASE_URL__/project", {
  method: "GET",
  headers: {
    "x-api-key": API_KEY,
    "Content-Type": "application/json",
  },
});

const data = await response.json();
console.log(data);`,
            python: `import requests

response = requests.get("__DEV_API_BASE_URL__/project", headers={
    "x-api-key": API_KEY,
    "Content-Type": "application/json",
})

data = response.json()
print(data)`,
        },
    },
    {
        id: "collection",
        name: "Collection details",
        method: "GET",
        path: "/collection",
        description: "Get collection details and its published papers",
        hasIdentifierOptions: true,
        identifierOptions: [
            { value: "id", label: "By ID" },
            { value: "slug", label: "By Slug" },
        ],
        variables: [
            { name: "apiKey", label: "API Key", type: "text", required: true, placeholder: "your-api-key" },
            { name: "identifier", label: "Collection ID", type: "text", required: true, placeholder: "collection-id" },
        ],
        sampleVariables: {
            apiKey: "wp_live_your_project_key",
            identifier: "getting-started",
        },
        code: {
            typescript: `const response = await fetch("__DEV_API_BASE_URL__/collection?QUERY_KEY=COLLECTION_ID", {
  method: "GET",
  headers: {
    "x-api-key": API_KEY,
    "Content-Type": "application/json",
  },
});

const data = await response.json();
console.log(data);`,
            python: `import requests

response = requests.get("__DEV_API_BASE_URL__/collection?QUERY_KEY=COLLECTION_ID", headers={
    "x-api-key": API_KEY,
    "Content-Type": "application/json",
})

data = response.json()
print(data)`,
        },
    },
    {
        id: "paper",
        name: "Paper details",
        method: "GET",
        path: "/paper",
        description: "Get paper details with associated project and collection info (if public)",
        hasIdentifierOptions: true,
        identifierOptions: [
            { value: "id", label: "By ID" },
            { value: "slug", label: "By Slug" },
        ],
        variables: [
            { name: "apiKey", label: "API Key", type: "text", required: true, placeholder: "your-api-key" },
            { name: "identifier", label: "Paper ID", type: "text", required: true, placeholder: "paper-id" },
        ],
        sampleVariables: {
            apiKey: "wp_live_your_project_key",
            identifier: "introducing-whitepapper",
        },
        code: {
            typescript: `const response = await fetch("__DEV_API_BASE_URL__/paper?QUERY_KEY=PAPER_ID", {
  method: "GET",
  headers: {
    "x-api-key": API_KEY,
    "Content-Type": "application/json",
  },
});

const data = await response.json();
console.log(data);`,
            python: `import requests

response = requests.get("__DEV_API_BASE_URL__/paper?QUERY_KEY=PAPER_ID", headers={
    "x-api-key": API_KEY,
    "Content-Type": "application/json",
})

data = response.json()
print(data)`,
        },
    },
];


// Helper to replace placeholder in code
const replaceCodePlaceholders = (code: string, variables: Record<string, string>, identifierType: string | null, identifierValue: string, endpointId: string) => {
    let updatedCode = code;

    updatedCode = updatedCode.replace(/__DEV_API_BASE_URL__/g, DEV_API_BASE_URL);

    // Replace API_KEY placeholder
    if (variables.apiKey) {
        updatedCode = updatedCode.replace(/API_KEY/g, `"${variables.apiKey}"`);
    }

    // Replace identifier placeholder based on type
    if (identifierType && (endpointId === "collection" || endpointId === "paper")) {
        updatedCode = updatedCode.replace(/QUERY_KEY/g, identifierType === "id" ? "id" : "slug");
    }

    if (identifierType && identifierValue) {
        if (endpointId === "collection") {
            if (identifierType === "id") {
                updatedCode = updatedCode.replace(/(id|slug)=COLLECTION_ID/g, `id=${identifierValue}`);
                updatedCode = updatedCode.replace(/COLLECTION_ID/g, identifierValue);
            } else if (identifierType === "slug") {
                updatedCode = updatedCode.replace(/(id|slug)=COLLECTION_ID/g, `slug=${identifierValue}`);
                updatedCode = updatedCode.replace(/COLLECTION_ID/g, identifierValue);
            }
        } else if (endpointId === "paper") {
            if (identifierType === "id") {
                updatedCode = updatedCode.replace(/(id|slug)=PAPER_ID/g, `id=${identifierValue}`);
                updatedCode = updatedCode.replace(/PAPER_ID/g, identifierValue);
            } else if (identifierType === "slug") {
                updatedCode = updatedCode.replace(/(id|slug)=PAPER_ID/g, `slug=${identifierValue}`);
                updatedCode = updatedCode.replace(/PAPER_ID/g, identifierValue);
            }
        }
    }

    return updatedCode;
};

type ApiShowcaseProps = {
    hideRunSection?: boolean;
};

export function ApiShowcase({ hideRunSection = false }: ApiShowcaseProps) {
    const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointConfig>(ENDPOINTS[0]);
    const [language, setLanguage] = useState<Language>("typescript");
    const [identifierType, setIdentifierType] = useState<IdentifierType>("id");
    const [variables, setVariables] = useState<Record<string, string>>(() => getInitialVariables(ENDPOINTS[0]));
    const [response, setResponse] = useState<{ type: "success" | "error"; data: any } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const visibleVariables = getEndpointVariables(selectedEndpoint, identifierType);

    const handleEndpointChange = (endpoint: EndpointConfig) => {
        setSelectedEndpoint(endpoint);
        const initialVars = getInitialVariables(endpoint);
        setVariables(initialVars);
        setResponse(null);
        if (endpoint.hasIdentifierOptions) {
            setIdentifierType("id");
        }
    };

    const handleIdentifierTypeChange = (type: IdentifierType) => {
        setIdentifierType(type);
        setVariables((prev) => ({
            ...prev,
            identifier: type === "slug"
                ? selectedEndpoint.sampleVariables.identifier ?? prev.identifier ?? ""
                : prev.identifier ?? "",
        }));
    };

    const handleVariableChange = (name: string, value: string) => {
        setVariables((prev) => ({ ...prev, [name]: value }));
    };

    const handleCopyCode = async () => {
        let code = selectedEndpoint.code[language];
        code = replaceCodePlaceholders(
            code,
            variables,
            selectedEndpoint.hasIdentifierOptions ? identifierType : null,
            variables.identifier || "",
            selectedEndpoint.id
        );
        const ok = await copyToClipboardWithToast(code, "Code copied.", "Unable to copy code.");
        if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const getCurrentCode = () => {
        let code = selectedEndpoint.code[language];
        code = replaceCodePlaceholders(
            code,
            variables,
            selectedEndpoint.hasIdentifierOptions ? identifierType : null,
            variables.identifier || "",
            selectedEndpoint.id
        );
        return code;
    };

    const handleRunRequest = async () => {
        const missingVars = visibleVariables.filter(
            (v) => v.required && !variables[v.name]
        );
        if (missingVars.length > 0) {
            setResponse({
                type: "error",
                data: { error: `Missing required variables: ${missingVars.map((v) => v.label).join(", ")}` },
            });
            return;
        }

        setIsLoading(true);
        setResponse(null);

        try {
            let data: unknown;

            if (selectedEndpoint.id === "project") {
                data = await getDevProject(variables.apiKey);
            } else if (selectedEndpoint.id === "collection") {
                data = await getDevCollection(variables.apiKey, identifierType, variables.identifier);
            } else {
                data = await getDevPaper(variables.apiKey, identifierType, variables.identifier);
            }

            setResponse({ type: "success", data });
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : "Network error occurred";
            try {
                const parsed = JSON.parse(errorMessage);
                setResponse({ type: "error", data: parsed });
            } catch {
                setResponse({ type: "error", data: { error: errorMessage } });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const currentCode = getCurrentCode();

    return (
        <div className="w-full">
            <div className="flex flex-wrap items-center gap-2">
                {ENDPOINTS.map((endpoint) => (
                    <Button
                        key={endpoint.id}
                        size="sm"
                        variant={endpoint.id == selectedEndpoint.id ? "default" : "ghost"}
                        onClick={() => handleEndpointChange(endpoint)}
                    >
                        {endpoint.name.split(" ")[0]}
                     <span className="md:block hidden">{endpoint.name.split(" ")[1]}</span>
                    </Button>
                ))}
            </div>


            <p className="mt-3 max-w-[720px] text-sm leading-6 text-muted-foreground">{selectedEndpoint.description}</p>

            <div className={`overflow-hidden relative rounded-lg border bg-muted mt-2 ${language == "typescript" ? "h-[260px]" : "h-[240px]"} transition-all duration-300`}>
                <div
                    className={cn(
                        "flex gap-1 transition-all duration-300 ease-in-out absolute top-2 left-2 z-2",
                        selectedEndpoint.hasIdentifierOptions
                            ? "translate-y-[0px]"
                            : "translate-y-[-50px]")}>
                    <Button

                        variant={identifierType === "id" ? "default" : "secondary"}
                        size="xs"
                        onClick={() => handleIdentifierTypeChange("id")}>
                        By ID
                    </Button>
                    <Button

                        variant={identifierType === "slug" ? "default" : "secondary"}
                        size="xs"
                        onClick={() => handleIdentifierTypeChange("slug")}>
                        By Slug
                    </Button>

                </div>

                <ScrollArea>
                    <ScrollBar orientation="horizontal" />
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-2 right-2 z-2"
                        onClick={handleCopyCode}
                    >
                        {copied ? <Check className="p-[1px]" /> : <Copy className="p-[1px]" />}
                    </Button>

                    <pre className="p-4 pt-12 overflow-x-auto text-sm">
                        <code>{currentCode}</code>
                    </pre>
                </ScrollArea>
            </div>

            <div className="mt-2 flex gap-2">
                <Button variant={language == "typescript" ? "secondary" : "ghost"} onClick={() => { setLanguage("typescript") }}>Typescript</Button>
                <Button variant={language == "python" ? "secondary" : "ghost"} onClick={() => { setLanguage("python") }}>Python</Button>
            </div>

            {!hideRunSection && (
                <div className="space-y-4 mt-5">
                    <h3 className="text-sm font-semibold text-foreground">Variables</h3>
                    <div className="space-y-3">
                        {visibleVariables.map((variable) => (
                            <div
                                key={variable.name}
                                className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center"
                            >
                                <Label htmlFor={variable.name} className="text-sm font-medium text-muted-foreground">
                                    {variable.label}
                                    {variable.required && <span className="text-destructive ml-1">*</span>}
                                </Label>
                                <div className="md:col-span-2">
                                    <Input
                                        id={variable.name}
                                        type={variable.type}
                                        placeholder={variable.placeholder}
                                        value={variables[variable.name] || ""}
                                        onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                                        className="font-mono text-sm"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-10 flex justify-end">
                        <Button loading={isLoading} onClick={handleRunRequest} disabled={isLoading} className="w-full md:w-auto">
                            <PlayIcon /> Run
                        </Button>
                    </div>
                </div>
            )}

            {!hideRunSection && response && (
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Response</h3>
                    <div
                        className={cn(
                            "rounded-lg border p-4 overflow-x-auto",
                            response.type === "error"
                                ? "bg-destructive/10 border-destructive/30"
                                : "bg-muted/30"
                        )}
                    >
                        <pre
                            className={cn(
                                "text-sm font-mono whitespace-pre-wrap break-words",
                                response.type === "error" && "text-destructive"
                            )}
                        >
                            {(() => {
                                try {
                                    return JSON.stringify(response.data ?? { message: "No response payload." }, null, 2);
                                } catch {
                                    return String(response.data);
                                }
                            })()}
                        </pre>
                    </div>
                </div>
            )}
        </div >
    );
}
